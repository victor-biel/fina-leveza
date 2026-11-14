import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Check, FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { confirmDocument, discardDocument } from "@/lib/documents.functions";
import { CATEGORIAS, formatMoney } from "@/lib/finance";
import { chatQuery, documentQuery } from "@/lib/queries";
import type { ChatMessage, ChatPart, DocumentDTO } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

type ToolPart = Extract<ChatPart, { type: "tool" }>;
type O = Record<string, any>;

function money(v: unknown) {
  return formatMoney(Number(v ?? 0));
}

const RUNNING: Record<string, string> = {
  registar_transacao: "A registar…",
  apagar_transacao: "A apagar…",
  consultar_financas: "A consultar as suas finanças…",
  criar_meta: "A criar a meta…",
  contribuir_meta: "A atualizar a meta…",
  listar_metas: "A ver as suas metas…",
  criar_grupo: "A criar o grupo…",
  editar_grupo: "A atualizar o grupo…",
  listar_grupos: "A ver os grupos…",
  dividir_despesa: "A dividir a conta…",
  acertar_contas: "A acertar contas…",
};

function doneLabel(name: string, out: O | null): string {
  const o = out ?? {};
  switch (name) {
    case "registar_transacao":
      return `${o["tipo"] === "receita" ? "Receita" : "Despesa"} registada: ${o["descricao"] ?? o["categoria"]} · ${money(o["valor"])}`;
    case "apagar_transacao":
      return "Transação apagada";
    case "consultar_financas":
      return "Consultei as suas finanças";
    case "criar_meta":
      return `Meta criada: ${o["nome"]}`;
    case "contribuir_meta":
      return `Meta "${o["nome"]}" atualizada · ${o["percent"]}%`;
    case "listar_metas":
      return "Vi as suas metas";
    case "criar_grupo":
      return `Grupo criado: ${o["nome"]}`;
    case "editar_grupo":
      return `Grupo "${o["grupo"]}" atualizado`;
    case "listar_grupos":
      return "Vi os grupos e saldos";
    case "dividir_despesa":
      return `Conta dividida · ${money(o["total"])}`;
    case "acertar_contas":
      return `Contas acertadas com ${o["pessoa"]}`;
    default:
      return "Feito";
  }
}

export function ToolPill({ part }: { part: ToolPart }) {
  const out = (part.output && typeof part.output === "object" && !Array.isArray(part.output) ? part.output : null) as O | null;
  const shares = part.name === "dividir_despesa" && out && Array.isArray(out["parcelas"]) ? (out["parcelas"] as O[]) : null;
  return (
    <div className="my-1">
      <div
        className={cn(
          "inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
          part.state === "output-error" ? "bg-expense-soft text-expense" : part.state === "output-available" ? "bg-income-soft text-income" : "bg-accent text-primary",
        )}
      >
        {part.state === "input-available" ? <Loader2 className="size-3.5 animate-spin" /> : part.state === "output-error" ? <AlertCircle className="size-3.5" /> : <Check className="size-3.5" />}
        <span className="truncate">
          {part.state === "input-available" ? RUNNING[part.name] ?? "A tratar…" : part.state === "output-error" ? part.errorText ?? "Não consegui fazer isto" : doneLabel(part.name, out)}
        </span>
      </div>
      {shares && (
        <ul className="mt-2 space-y-1 rounded-2xl bg-card p-3 text-sm shadow-soft">
          {shares.map((s) => (
            <li key={String(s["nome"])} className="flex justify-between gap-4">
              <span>{s["is_self"] ? `${s["nome"]} (você)` : String(s["nome"])} <span className="text-muted-foreground">· {s["percentual"]}%</span></span>
              <span className="font-semibold tabular">{money(s["valor"])}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FilePill({ filename }: { filename: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl bg-primary-foreground/15 px-3 py-2 text-sm font-medium">
      <FileText className="size-4" /> {filename}
    </span>
  );
}

function updateDocPart(qc: ReturnType<typeof useQueryClient>, messageId: string, docId: string, patch: Partial<DocumentDTO>) {
  let updated: ChatPart[] | null = null;
  qc.setQueryData<ChatMessage[]>(chatQuery.queryKey, (prev) =>
    (prev ?? []).map((m) => {
      if (m.id !== messageId) return m;
      const parts = m.parts.map((p) => (p.type === "document" && p.document.id === docId ? { ...p, document: { ...p.document, ...patch } } : p));
      updated = parts;
      return { ...m, parts };
    }),
  );
  return updated as ChatPart[] | null;
}

export function DocumentCard({ doc, messageId, moeda }: { doc: DocumentDTO; messageId: string; moeda: string }) {
  const qc = useQueryClient();
  const confirmFn = useServerFn(confirmDocument);
  const discardFn = useServerFn(discardDocument);
  const { data: fresh } = useQuery(documentQuery(doc.id));
  const estado = (fresh?.estado as DocumentDTO["estado"] | undefined) ?? doc.estado;
  const [valor, setValor] = useState(doc.valor_extraido != null ? String(doc.valor_extraido) : "");
  const [categoria, setCategoria] = useState(doc.categoria_sugerida ?? "Contas");
  const [data, setData] = useState(doc.data_extraida ?? new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState([doc.empresa, doc.tipo_despesa].filter(Boolean).join(" · ") || doc.nome_arquivo);
  const [busy, setBusy] = useState<"confirm" | "discard" | null>(null);

  const v = Number(valor.replace(",", "."));
  const valid = v > 0 && /^\d{4}-\d{2}-\d{2}$/.test(data) && categoria.length > 0;

  async function confirm() {
    if (!valid) return;
    setBusy("confirm");
    try {
      const res = await confirmFn({ data: { id: doc.id, messageId, valor: v, categoria, data, descricao: descricao.slice(0, 200) } });
      updateDocPart(qc, messageId, doc.id, { estado: "confirmado", transaction_id: res.transactionId, valor_extraido: v, categoria_sugerida: categoria });
      if (res.message) qc.setQueryData<ChatMessage[]>(chatQuery.queryKey, (prev) => [...(prev ?? []), res.message!]);
      qc.invalidateQueries({ queryKey: ["document", doc.id] });
      ["transactions", "splits"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui registar.");
    } finally {
      setBusy(null);
    }
  }

  async function discard() {
    setBusy("discard");
    try {
      await discardFn({ data: { id: doc.id } });
      const parts = updateDocPart(qc, messageId, doc.id, { estado: "descartado" });
      if (parts) await supabase.from("chat_messages").update({ parts: parts as unknown as Json }).eq("id", messageId);
      qc.invalidateQueries({ queryKey: ["document", doc.id] });
    } catch {
      toast.error("Não consegui descartar.");
    } finally {
      setBusy(null);
    }
  }

  if (estado !== "pendente") {
    return (
      <div className="my-2 flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
        <span className={cn("flex size-9 items-center justify-center rounded-xl", estado === "confirmado" ? "bg-income-soft text-income" : "bg-muted text-muted-foreground")}>
          {estado === "confirmado" ? <Check className="size-4" /> : <X className="size-4" />}
        </span>
        <div className="min-w-0 text-sm">
          <p className="truncate font-semibold">{doc.empresa ?? doc.nome_arquivo}</p>
          <p className="text-muted-foreground">
            {estado === "confirmado" ? `Registada · ${formatMoney(Number(fresh?.valor_extraido ?? doc.valor_extraido ?? 0), moeda)}` : "Descartada"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-2 rounded-3xl border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary"><FileText className="size-5" /></span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{doc.empresa ?? "Empresa desconhecida"}</p>
          <p className="truncate text-xs text-muted-foreground">{doc.nome_arquivo}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`v-${doc.id}`}>Valor (€)</Label>
          <Input id={`v-${doc.id}`} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`d-${doc.id}`}>Data</Label>
          <Input id={`d-${doc.id}`} type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Categoria</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger aria-label="Categoria"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor={`n-${doc.id}`}>Descrição</Label>
          <Input id={`n-${doc.id}`} value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={200} />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={discard} disabled={!!busy}>
          {busy === "discard" ? <Loader2 className="animate-spin" /> : <X />} Descartar
        </Button>
        <Button className="flex-1" onClick={confirm} disabled={!valid || !!busy}>
          {busy === "confirm" ? <Loader2 className="animate-spin" /> : <Check />} Confirmar despesa
        </Button>
      </div>
    </div>
  );
}
