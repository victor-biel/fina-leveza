import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowUp, Loader2, Paperclip, Square } from "lucide-react";
import { toast } from "sonner";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { MessageResponse } from "@/components/ai-elements/message";
import { DocumentCard, FilePill, ToolPill } from "@/components/app/chat-parts";
import { FinaMark } from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { extractDocument } from "@/lib/documents.functions";
import { chatQuery, financeKeys, profileQuery } from "@/lib/queries";
import type { ChatMessage, ChatPart, StreamEvent } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

type ChatSearch = { q?: string; anexar?: boolean };

function validateChatSearch(raw: Record<string, unknown>): ChatSearch {
  const out: ChatSearch = {};
  if (typeof raw["q"] === "string") out.q = raw["q"].slice(0, 500);
  if (raw["anexar"] === true || raw["anexar"] === "true") out.anexar = true;
  return out;
}

export const Route = createFileRoute("/_authenticated/_app/chat")({
  validateSearch: validateChatSearch,
  head: () => ({
    meta: [
      { title: "Conversa com a Fina" },
      { name: "description", content: "Registe gastos, crie metas e divida contas a conversar com a Fina." },
      { property: "og:title", content: "Conversa com a Fina" },
      { property: "og:description", content: "Registe gastos, crie metas e divida contas a conversar com a Fina." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(chatQuery),
  component: ChatPage,
});

const SUGGESTIONS = [
  "Gastei 12€ no almoço hoje",
  "Recebi o salário de 1500€",
  "Quanto gastei este mês?",
  "Quero poupar 2000€ para férias até agosto",
  "Divide 90€ do jantar entre mim, Ana e Rui",
];

const MAX_FILE = 10 * 1024 * 1024;

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function ChatPage() {
  const { q, anexar } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: messages } = useSuspenseQuery(chatQuery);
  const { data: profile } = useSuspenseQuery(profileQuery);
  const moeda = profile?.moeda ?? "EUR";
  const extractFn = useServerFn(extractDocument);

  const [text, setText] = useState(q ?? "");
  const [busy, setBusy] = useState<"stream" | "upload" | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [attachHint, setAttachHint] = useState(!!anexar);

  useEffect(() => {
    if (q || anexar) {
      if (q) setText(q);
      navigate({ to: "/chat", search: {}, replace: true });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [q, anexar, navigate]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const setMessages = (fn: (prev: ChatMessage[]) => ChatMessage[]) =>
    qc.setQueryData<ChatMessage[]>(chatQuery.queryKey, (prev) => fn(prev ?? []));

  const patchAssistant = (id: string, fn: (parts: ChatPart[]) => ChatPart[]) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, parts: fn(m.parts) } : m)));

  function refreshFinance() {
    financeKeys.forEach((k) => qc.invalidateQueries({ queryKey: [...k] }));
  }

  async function send(raw: string) {
    const value = raw.trim();
    if (!value || busy) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      navigate({ to: "/auth", search: { redirect: "/chat" } });
      return;
    }
    setText("");
    setAttachHint(false);
    const stamp = Date.now();
    const userId = `local-user-${stamp}`;
    const asstId = `local-asst-${stamp}`;
    setMessages((prev) => [...prev, { id: userId, role: "user", parts: [{ type: "text", text: value }] }, { id: asstId, role: "assistant", parts: [] }]);
    setBusy("stream");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let finalId = asstId;
    let usedTools = false;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: value }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(res.status === 401 ? "Sessão expirada. Entre novamente." : "Não consegui falar com a Fina.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(chunk, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as StreamEvent;
          if (ev.type === "user-saved") {
            setMessages((prev) => prev.map((m) => (m.id === userId ? { ...m, id: ev.id } : m)));
          } else if (ev.type === "text-delta") {
            patchAssistant(finalId, (parts) => {
              const last = parts[parts.length - 1];
              if (last?.type === "text") return [...parts.slice(0, -1), { ...last, text: last.text + ev.delta }];
              return [...parts, { type: "text", text: ev.delta }];
            });
          } else if (ev.type === "tool-start") {
            usedTools = true;
            patchAssistant(finalId, (parts) => [...parts, { type: "tool", toolCallId: ev.toolCallId, name: ev.name, input: ev.input, state: "input-available" }]);
          } else if (ev.type === "tool-result") {
            patchAssistant(finalId, (parts) =>
              parts.map((p) => {
                if (p.type !== "tool" || p.toolCallId !== ev.toolCallId) return p;
                return ev.errorText != null
                  ? { type: "tool", toolCallId: p.toolCallId, name: p.name, input: p.input, state: "output-error", errorText: ev.errorText }
                  : { type: "tool", toolCallId: p.toolCallId, name: p.name, input: p.input, state: "output-available", output: ev.output ?? null };
              }),
            );
          } else if (ev.type === "done") {
            const doneId = ev.id;
            setMessages((prev) => prev.map((m) => (m.id === finalId ? { ...m, id: doneId } : m)));
            finalId = doneId;
          } else if (ev.type === "error") {
            toast.error(ev.message);
            patchAssistant(finalId, (parts) => [...parts, { type: "text", text: `_${ev.message}_` }]);
          }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        const msg = err instanceof Error ? err.message : "Não consegui falar com a Fina.";
        toast.error(msg);
        patchAssistant(finalId, (parts) => (parts.length ? parts : [{ type: "text", text: `_${msg}_` }]));
      }
    } finally {
      setMessages((prev) => prev.filter((m) => !(m.id === finalId && m.parts.length === 0)));
      abortRef.current = null;
      setBusy(null);
      if (usedTools) refreshFinance();
    }
  }

  async function onFile(file: File | undefined) {
    if (!file || busy) return;
    if (!/^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.type)) {
      toast.error("Envie um PDF ou uma imagem (PNG, JPG).");
      return;
    }
    if (file.size > MAX_FILE) {
      toast.error("O ficheiro é demasiado grande (máximo 10 MB).");
      return;
    }
    setAttachHint(false);
    setBusy("upload");
    const tempId = `local-file-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: "user", parts: [{ type: "file", filename: file.name, mediaType: file.type }] }]);
    try {
      const dataUrl = await readAsDataUrl(file);
      const res = await extractFn({ data: { filename: file.name.slice(0, 200), dataUrl } });
      setMessages((prev) => [...prev.filter((m) => m.id !== tempId), ...res.messages]);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error(e instanceof Error ? e.message : "Não consegui ler este documento.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const empty = messages.length === 0;
  const lastAssistant = messages[messages.length - 1];
  const thinking = busy === "stream" && lastAssistant?.role === "assistant" && lastAssistant.parts.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-soft">
      <header className="flex items-center gap-3 border-b bg-card/80 px-4 py-3 backdrop-blur lg:px-8">
        <Button asChild variant="ghost" size="icon-sm" className="lg:hidden">
          <Link to="/inicio" aria-label="Voltar ao início"><ArrowLeft /></Link>
        </Button>
        <FinaMark className="size-9" />
        <div>
          <h1 className="font-display text-base font-semibold leading-tight">Fina</h1>
          <p className="text-xs text-muted-foreground">{busy === "stream" ? "a escrever…" : busy === "upload" ? "a ler o documento…" : "A sua assistente financeira"}</p>
        </div>
      </header>

      <Conversation className="min-h-0">
        <ConversationContent className="mx-auto w-full max-w-2xl gap-5 px-4 py-6">
          {empty && (
            <div className="animate-rise flex flex-col items-center pt-8 text-center">
              <FinaMark className="size-16" />
              <h2 className="mt-4 font-display text-2xl font-semibold">Olá{profile?.nome ? `, ${profile.nome.split(" ")[0]}` : ""}! Em que posso ajudar?</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">Fale comigo como falaria com uma amiga. Eu registo, organizo e explico.</p>
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-3xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-foreground shadow-soft">
                  {m.parts.map((p, i) =>
                    p.type === "text" ? <p key={i} className="whitespace-pre-wrap">{p.text}</p> : p.type === "file" ? <FilePill key={i} filename={p.filename} /> : null,
                  )}
                </div>
              </div>
            ) : m.parts.length === 0 ? null : (
              <div key={m.id} className="flex items-start gap-2.5">
                <FinaMark className="mt-0.5 size-8 shrink-0" />
                <div className="min-w-0 max-w-[88%] text-[15px] text-foreground">
                  {m.parts.map((p, i) =>
                    p.type === "text" ? (
                      <div key={i} className="rounded-3xl rounded-tl-md bg-card px-4 py-2.5 shadow-soft [&_p]:my-1.5">
                        <MessageResponse>{p.text}</MessageResponse>
                      </div>
                    ) : p.type === "tool" ? (
                      <ToolPill key={p.toolCallId} part={p} />
                    ) : p.type === "document" ? (
                      <DocumentCard key={p.document.id} doc={p.document} messageId={m.id} moeda={moeda} />
                    ) : null,
                  )}
                </div>
              </div>
            ),
          )}

          {(thinking || busy === "upload") && (
            <div className="flex items-center gap-2.5" aria-live="polite">
              <FinaMark className="size-8" />
              <div className="flex items-center gap-1 rounded-3xl rounded-tl-md bg-card px-4 py-3.5 shadow-soft">
                {busy === "upload" ? (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> A ler o documento…</span>
                ) : (
                  [0, 1, 2].map((i) => <span key={i} className="size-2 animate-bounce rounded-full bg-sky" style={{ animationDelay: `${i * 120}ms` }} />)
                )}
              </div>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t bg-card/90 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl">
          {empty && !busy && (
            <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="shrink-0 rounded-full border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">
                  {s}
                </button>
              ))}
            </div>
          )}
          {attachHint && !busy && (
            <button type="button" onClick={() => fileRef.current?.click()} className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-highlight/30 p-3 text-left text-sm font-medium">
              <Paperclip className="size-5 text-highlight-foreground" /> Toque aqui para escolher a fatura (PDF ou fotografia)
            </button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
            className="flex items-end gap-2 rounded-3xl border bg-background p-1.5 shadow-soft focus-within:ring-2 focus-within:ring-ring"
          >
            <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={() => fileRef.current?.click()} disabled={!!busy} aria-label="Anexar fatura">
              <Paperclip className="size-5" />
            </Button>
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(text);
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Escreva à Fina…"
              aria-label="Mensagem para a Fina"
              className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[15px] outline-none placeholder:text-muted-foreground"
            />
            {busy === "stream" ? (
              <Button type="button" size="icon" className="shrink-0 rounded-full" onClick={() => abortRef.current?.abort()} aria-label="Parar">
                <Square className="size-4 fill-current" />
              </Button>
            ) : (
              <Button type="submit" size="icon" className={cn("shrink-0 rounded-full", !text.trim() && "opacity-50")} disabled={!text.trim() || !!busy} aria-label="Enviar">
                <ArrowUp className="size-5" />
              </Button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
