import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import type { ChatPart, StreamEvent } from "@/lib/chat-types";
import type { ToolArgs } from "@/lib/agent.server";

const Body = z.object({ text: z.string().trim().min(1).max(4000) });
const MODEL = "nvidia/nemotron-3.5-super-vl:free";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
};

function friendlyError(status?: number): string {
  if (status === 402)
    return "O limite ou saldo da conta OpenRouter foi atingido. Tente novamente mais tarde.";
  if (status === 429)
    return "O modelo está temporariamente limitado. Aguarde uns segundos e tente de novo.";
  return "Não consegui responder agora. Tente novamente.";
}

function historyToMessages(rows: { role: string; parts: Json }[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const row of rows) {
    const parts = (Array.isArray(row.parts) ? row.parts : []) as unknown as ChatPart[];
    if (row.role === "user") {
      const text = parts
        .map((p) =>
          p.type === "text" ? p.text : p.type === "file" ? `[Anexo: ${p.filename}]` : "",
        )
        .filter(Boolean)
        .join("\n");
      if (text) messages.push({ role: "user", content: text });
      continue;
    }
    const assistantText = parts
      .filter((p): p is Extract<ChatPart, { type: "text" }> => p.type === "text" && !!p.text.trim())
      .map((p) => p.text)
      .join("\n");
    const calls = parts.filter((p): p is Extract<ChatPart, { type: "tool" }> => p.type === "tool");
    if (calls.length) {
      messages.push({
        role: "assistant",
        content: assistantText || null,
        tool_calls: calls.map((p) => ({
          id: p.toolCallId,
          type: "function",
          function: { name: p.name, arguments: JSON.stringify(p.input ?? {}) },
        })),
      });
      for (const p of calls) {
        messages.push({
          role: "tool",
          tool_call_id: p.toolCallId,
          content: JSON.stringify(
            p.state === "output-error" ? { erro: p.errorText } : (p.output ?? null),
          ),
        });
      }
    } else if (assistantText) {
      messages.push({ role: "assistant", content: assistantText });
    }
    for (const p of parts) {
      if (p.type === "document") {
        const d = p.document;
        messages.push({
          role: "assistant",
          content: `[Documento "${d.nome_arquivo}" lido: empresa ${d.empresa ?? "?"}, valor ${d.valor_extraido ?? "?"}, data ${d.data_extraida ?? "?"}, categoria sugerida ${d.categoria_sugerida ?? "?"}. Estado: ${d.estado}${d.transaction_id ? `, transacao_id ${d.transaction_id}` : ""}.]`,
        });
      }
    }
  }
  return messages;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { userClientFromRequest } = await import("@/lib/supabase-user.server");
        const { agentTools, runTool, systemPrompt, todayLisbon } =
          await import("@/lib/agent.server");
        const auth = await userClientFromRequest(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid body", { status: 400 });
        const apiKey = process.env["OPENROUTER_API_KEY"];
        if (!apiKey) return new Response("OPENROUTER_API_KEY não configurada", { status: 503 });
        const { db, userId } = auth;
        const text = parsed.data.text;

        const [{ data: profile }, { data: history, error: hErr }] = await Promise.all([
          db
            .from("profiles")
            .select("nome,receita_mensal,objetivos,partilha,moeda")
            .eq("id", userId)
            .maybeSingle(),
          db
            .from("chat_messages")
            .select("role,parts,created_at")
            .order("created_at", { ascending: false })
            .limit(40),
        ]);
        if (hErr) return new Response("History unavailable", { status: 500 });

        const { data: userRow, error: uErr } = await db
          .from("chat_messages")
          .insert({
            user_id: userId,
            role: "user",
            parts: [{ type: "text", text }] as unknown as Json,
          })
          .select("id")
          .single();
        if (uErr) return new Response("Could not save message", { status: 500 });

        const messages: ChatMessage[] = [
          {
            role: "system",
            content: systemPrompt({
              nome: profile?.nome,
              receita: profile?.receita_mensal == null ? null : Number(profile.receita_mensal),
              objetivos: profile?.objetivos,
              partilha: profile?.partilha,
              moeda: profile?.moeda ?? "EUR",
              hoje: todayLisbon(),
            }),
          },
          ...historyToMessages([...(history ?? [])].reverse()),
          { role: "user", content: text },
        ];
        const tools = agentTools.map(({ type: _type, name, description, parameters }) => ({
          type: "function" as const,
          function: { name, description, parameters },
        }));
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (event: StreamEvent) =>
              controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
            send({ type: "user-saved", id: userRow.id });
            const parts: ChatPart[] = [];
            try {
              for (let round = 0; round < 6; round++) {
                const response = await fetch(OPENROUTER_URL, {
                  method: "POST",
                  signal: request.signal,
                  headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://fina-leveza.vercel.app",
                    "X-OpenRouter-Title": "Fina Leveza",
                  },
                  body: JSON.stringify({
                    model: MODEL,
                    messages,
                    tools,
                    tool_choice: "auto",
                    stream: true,
                    max_tokens: 1200,
                  }),
                });
                if (!response.ok || !response.body) {
                  const error = new Error(
                    `OpenRouter request failed: ${response.status}`,
                  ) as Error & { status?: number };
                  error.status = response.status;
                  throw error;
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                let textBuf = "";
                const calls = new Map<number, { id: string; name: string; arguments: string }>();
                const processLine = (line: string) => {
                  if (!line.startsWith("data: ")) return;
                  const payload = line.slice(6);
                  if (payload === "[DONE]") return;
                  let chunk: {
                    choices?: {
                      delta?: {
                        content?: string | null;
                        tool_calls?: {
                          index: number;
                          id?: string;
                          function?: { name?: string; arguments?: string };
                        }[];
                      };
                    }[];
                  };
                  try {
                    chunk = JSON.parse(payload);
                  } catch {
                    return;
                  }
                  const delta = chunk.choices?.[0]?.delta;
                  if (delta?.content) {
                    textBuf += delta.content;
                    send({ type: "text-delta", delta: delta.content });
                  }
                  for (const call of delta?.tool_calls ?? []) {
                    const existing = calls.get(call.index) ?? { id: "", name: "", arguments: "" };
                    if (call.id) existing.id = call.id;
                    if (call.function?.name) existing.name += call.function.name;
                    if (call.function?.arguments) existing.arguments += call.function.arguments;
                    calls.set(call.index, existing);
                  }
                };
                while (true) {
                  const { done, value } = await reader.read();
                  buffer += decoder.decode(value, { stream: !done });
                  const lines = buffer.split("\n");
                  buffer = lines.pop() ?? "";
                  lines.forEach(processLine);
                  if (done) break;
                }
                if (buffer.trim()) processLine(buffer.trim());

                const toolCalls = [...calls.values()].filter((call) => call.id && call.name);
                if (textBuf) {
                  parts.push({ type: "text", text: textBuf });
                  messages.push({
                    role: "assistant",
                    content: textBuf,
                    ...(toolCalls.length
                      ? {
                          tool_calls: toolCalls.map((call) => ({
                            id: call.id,
                            type: "function" as const,
                            function: { name: call.name, arguments: call.arguments || "{}" },
                          })),
                        }
                      : {}),
                  });
                  if (toolCalls.length) send({ type: "text-delta", delta: "\n\n" });
                } else if (toolCalls.length) {
                  messages.push({
                    role: "assistant",
                    content: null,
                    tool_calls: toolCalls.map((call) => ({
                      id: call.id,
                      type: "function",
                      function: { name: call.name, arguments: call.arguments || "{}" },
                    })),
                  });
                }
                if (!toolCalls.length) break;
                for (const call of toolCalls) {
                  let args: Record<string, Json> = {};
                  try {
                    args = JSON.parse(call.arguments || "{}");
                  } catch {
                    args = {};
                  }
                  send({ type: "tool-start", toolCallId: call.id, name: call.name, input: args });
                  let output: unknown;
                  let errorText: string | undefined;
                  try {
                    output = await runTool(db, userId, call.name, args as ToolArgs);
                  } catch (err) {
                    errorText = err instanceof Error ? err.message : "Erro ao executar";
                  }
                  send(
                    errorText
                      ? { type: "tool-result", toolCallId: call.id, errorText }
                      : { type: "tool-result", toolCallId: call.id, output: output as Json },
                  );
                  parts.push(
                    errorText
                      ? {
                          type: "tool",
                          toolCallId: call.id,
                          name: call.name,
                          input: args,
                          state: "output-error",
                          errorText,
                        }
                      : {
                          type: "tool",
                          toolCallId: call.id,
                          name: call.name,
                          input: args,
                          state: "output-available",
                          output: (output ?? null) as Json,
                        },
                  );
                  messages.push({
                    role: "tool",
                    tool_call_id: call.id,
                    content: JSON.stringify(errorText ? { erro: errorText } : (output ?? null)),
                  });
                }
              }
              const { data: saved, error } = await db
                .from("chat_messages")
                .insert({ user_id: userId, role: "assistant", parts: parts as unknown as Json })
                .select("id")
                .single();
              if (error) console.error("save assistant message failed", error);
              send({ type: "done", id: saved?.id ?? crypto.randomUUID() });
            } catch (err) {
              console.error("chat error", err);
              if (parts.length)
                await db
                  .from("chat_messages")
                  .insert({ user_id: userId, role: "assistant", parts: parts as unknown as Json });
              const status = (err as { status?: number })?.status;
              send({ type: "error", message: friendlyError(status) });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "application/x-ndjson; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
