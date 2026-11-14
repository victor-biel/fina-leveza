import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { streamResponse, GatewayError, type ResponsesInputItem } from "@lovable.dev/ai-gateway";
import type { Json } from "@/integrations/supabase/types";
import type { ChatPart, StreamEvent } from "@/lib/chat-types";
import type { ToolArgs } from "@/lib/agent.server";

const Body = z.object({ text: z.string().trim().min(1).max(4000) });

function friendlyError(e: unknown): string {
  if (e instanceof GatewayError) {
    if (e.code === "payment_required" || e.httpStatus === 402) return "Os créditos de IA esgotaram. Tente novamente mais tarde.";
    if (e.httpStatus === 429) return "Muitos pedidos de uma vez. Aguarde uns segundos e tente de novo.";
  }
  return "Não consegui responder agora. Tente novamente.";
}

function historyToInput(rows: { role: string; parts: Json }[]): ResponsesInputItem[] {
  const items: ResponsesInputItem[] = [];
  for (const row of rows) {
    const parts = (Array.isArray(row.parts) ? row.parts : []) as unknown as ChatPart[];
    if (row.role === "user") {
      const text = parts
        .map((p) => (p.type === "text" ? p.text : p.type === "file" ? `[Anexo: ${p.filename}]` : ""))
        .filter(Boolean)
        .join("\n");
      if (text) items.push({ role: "user", content: text });
      continue;
    }
    for (const p of parts) {
      if (p.type === "text" && p.text.trim()) items.push({ role: "assistant", content: p.text });
      else if (p.type === "tool" && p.state !== "input-available") {
        items.push({ type: "function_call", call_id: p.toolCallId, name: p.name, arguments: JSON.stringify(p.input ?? {}) });
        items.push({ type: "function_call_output", call_id: p.toolCallId, output: JSON.stringify(p.state === "output-error" ? { erro: p.errorText } : p.output ?? null) });
      } else if (p.type === "document") {
        const d = p.document;
        items.push({
          role: "assistant",
          content: `[Documento "${d.nome_arquivo}" lido: empresa ${d.empresa ?? "?"}, valor ${d.valor_extraido ?? "?"}, data ${d.data_extraida ?? "?"}, categoria sugerida ${d.categoria_sugerida ?? "?"}. Estado: ${d.estado}${d.transaction_id ? `, transacao_id ${d.transaction_id}` : ""}.]`,
        });
      }
    }
  }
  return items;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { userClientFromRequest } = await import("@/lib/supabase-user.server");
        const { agentTools, runTool, systemPrompt, todayLisbon } = await import("@/lib/agent.server");
        const auth = await userClientFromRequest(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid body", { status: 400 });
        const { db, userId } = auth;
        const text = parsed.data.text;

        const [{ data: profile }, { data: history, error: hErr }] = await Promise.all([
          db.from("profiles").select("nome,receita_mensal,objetivos,partilha,moeda").eq("id", userId).maybeSingle(),
          db.from("chat_messages").select("role,parts,created_at").order("created_at", { ascending: false }).limit(40),
        ]);
        if (hErr) return new Response("History unavailable", { status: 500 });

        const { data: userRow, error: uErr } = await db
          .from("chat_messages")
          .insert({ user_id: userId, role: "user", parts: [{ type: "text", text }] as unknown as Json })
          .select("id")
          .single();
        if (uErr) return new Response("Could not save message", { status: 500 });

        const input: ResponsesInputItem[] = [...historyToInput([...(history ?? [])].reverse()), { role: "user", content: text }];
        const instructions = systemPrompt({
          nome: profile?.nome,
          receita: profile?.receita_mensal == null ? null : Number(profile.receita_mensal),
          objetivos: profile?.objetivos,
          partilha: profile?.partilha,
          moeda: profile?.moeda ?? "EUR",
          hoje: todayLisbon(),
        });

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (e: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
            send({ type: "user-saved", id: userRow.id });
            const parts: ChatPart[] = [];
            try {
              for (let round = 0; round < 6; round++) {
                const s = await streamResponse({ model: "openai/gpt-6-astra", instructions, input, tools: agentTools }, { signal: request.signal });
                let textBuf = "";
                const calls: { call_id: string; name: string; arguments: string }[] = [];
                for await (const ev of s) {
                  const e = ev as { type: string; delta?: string; item?: { type: string; call_id: string; name: string; arguments: string } };
                  if (e.type === "response.output_text.delta" && e.delta) {
                    textBuf += e.delta;
                    send({ type: "text-delta", delta: e.delta });
                  } else if (e.type === "response.output_item.done" && e.item?.type === "function_call") {
                    calls.push({ call_id: e.item.call_id, name: e.item.name, arguments: e.item.arguments });
                  }
                }
                if (textBuf) {
                  parts.push({ type: "text", text: textBuf });
                  input.push({ role: "assistant", content: textBuf });
                  if (calls.length) send({ type: "text-delta", delta: "\n\n" });
                }
                if (!calls.length) break;
                for (const c of calls) {
                  let args: Record<string, unknown> = {};
                  try {
                    args = JSON.parse(c.arguments || "{}");
                  } catch {
                    args = {};
                  }
                  send({ type: "tool-start", toolCallId: c.call_id, name: c.name, input: args });
                  let output: unknown;
                  let errorText: string | undefined;
                  try {
                    output = await runTool(db, userId, c.name, args as ToolArgs);
                  } catch (err) {
                    errorText = err instanceof Error ? err.message : "Erro ao executar";
                  }
                  send(errorText ? { type: "tool-result", toolCallId: c.call_id, errorText } : { type: "tool-result", toolCallId: c.call_id, output: output as Json });
                  parts.push(errorText ? { type: "tool", toolCallId: c.call_id, name: c.name, input: args as Record<string, Json>, state: "output-error", errorText } : { type: "tool", toolCallId: c.call_id, name: c.name, input: args as Record<string, Json>, state: "output-available", output: (output ?? null) as Json });
                  input.push({ type: "function_call", call_id: c.call_id, name: c.name, arguments: c.arguments || "{}" });
                  input.push({ type: "function_call_output", call_id: c.call_id, output: JSON.stringify(errorText ? { erro: errorText } : output ?? null) });
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
              if (parts.length) {
                await db.from("chat_messages").insert({ user_id: userId, role: "assistant", parts: parts as unknown as Json });
              }
              send({ type: "error", message: friendlyError(err) });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
