import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json, Tables } from "@/integrations/supabase/types";
import type { ChatMessage, ChatPart, DocumentDTO } from "./chat-types";
import { CATEGORIAS } from "./finance";

const ExtractInput = z.object({
  filename: z.string().min(1).max(200),
  dataUrl: z
    .string()
    .max(14_000_000)
    .regex(/^data:(application\/pdf|image\/(png|jpeg|webp));base64,/),
});

function toDTO(d: Tables<"uploaded_documents">): DocumentDTO {
  return {
    id: d.id,
    nome_arquivo: d.nome_arquivo,
    empresa: d.empresa,
    valor_extraido: d.valor_extraido == null ? null : Number(d.valor_extraido),
    data_extraida: d.data_extraida,
    tipo_despesa: d.tipo_despesa,
    categoria_sugerida: d.categoria_sugerida,
    estado: d.estado as DocumentDTO["estado"],
    transaction_id: d.transaction_id,
  };
}

export const extractDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data, context }) => {
    const { generateResponse } = await import("@lovable.dev/ai-gateway");
    const { supabase, userId } = context;
    const isPdf = data.dataUrl.startsWith("data:application/pdf");

    const filePart = isPdf
      ? ({ type: "input_file", filename: data.filename, file_data: data.dataUrl } as const)
      : ({ type: "input_image", image_url: data.dataUrl, detail: "high" } as const);

    let extracted: { empresa: string | null; valor: number | null; data: string | null; tipo_despesa: string | null; categoria: string | null; e_documento_financeiro: boolean };
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions:
          "Extrais dados de faturas, contas (água, luz, gás, telecomunicações), recibos e outros documentos financeiros portugueses. Devolve JSON. O valor é o total a pagar em euros. A data é a data da fatura/emissão (AAAA-MM-DD).",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: `Extrai os dados deste documento e devolve JSON. Categorias possíveis: ${CATEGORIAS.join(", ")}.` },
              filePart,
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "documento",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                e_documento_financeiro: { type: "boolean" },
                empresa: { type: ["string", "null"] },
                valor: { type: ["number", "null"] },
                data: { type: ["string", "null"], description: "AAAA-MM-DD" },
                tipo_despesa: { type: ["string", "null"], description: "ex.: Eletricidade, Água, Internet" },
                categoria: { type: ["string", "null"], enum: [...CATEGORIAS, null] },
              },
              required: ["e_documento_financeiro", "empresa", "valor", "data", "tipo_despesa", "categoria"],
            },
          },
        },
      });
      const outText = res.output
        .flatMap((o) => (o.type === "message" ? o.content : []))
        .map((c) => (c.type === "output_text" ? c.text : ""))
        .join("");
      extracted = JSON.parse(outText || "{}");
    } catch (err) {
      console.error("extract failed", err);
      throw new Error("Não consegui ler este documento. Tente outro ficheiro.");
    }

    const { data: doc, error } = await supabase
      .from("uploaded_documents")
      .insert({
        user_id: userId,
        nome_arquivo: data.filename,
        empresa: extracted.empresa,
        valor_extraido: extracted.valor,
        data_extraida: extracted.data && /^\d{4}-\d{2}-\d{2}$/.test(extracted.data) ? extracted.data : null,
        tipo_despesa: extracted.tipo_despesa,
        categoria_sugerida: extracted.categoria ?? "Contas",
      })
      .select("*")
      .single();
    if (error) throw new Error("Não consegui guardar o documento.");
    const dto = toDTO(doc);

    const userParts: ChatPart[] = [{ type: "file", filename: data.filename, mediaType: isPdf ? "application/pdf" : "image" }];
    const intro = extracted.e_documento_financeiro
      ? `Li o documento **${data.filename}**. Confirme se os dados estão certos antes de eu registar a despesa:`
      : `Não tenho a certeza de que **${data.filename}** seja uma fatura. Verifique os dados abaixo:`;
    const assistantParts: ChatPart[] = [{ type: "text", text: intro }, { type: "document", document: dto }];

    const { data: rows, error: mErr } = await supabase
      .from("chat_messages")
      .insert([
        { user_id: userId, role: "user", parts: userParts as unknown as Json },
        { user_id: userId, role: "assistant", parts: assistantParts as unknown as Json, created_at: new Date(Date.now() + 5).toISOString() },
      ])
      .select("id,role,parts,created_at");
    if (mErr) throw new Error("Não consegui guardar a conversa.");
    return { messages: (rows ?? []).map((r) => ({ ...r, parts: r.parts as unknown as ChatPart[] })) as ChatMessage[] };
  });

const ConfirmInput = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid().optional(),
  valor: z.number().positive(),
  categoria: z.string().min(1).max(60),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  descricao: z.string().max(200),
});

export const confirmDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ConfirmInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc } = await supabase.from("uploaded_documents").select("*").eq("id", data.id).maybeSingle();
    if (!doc) throw new Error("Documento não encontrado.");
    if (doc.estado !== "pendente") throw new Error("Este documento já foi tratado.");
    const { data: tx, error } = await supabase
      .from("transactions")
      .insert({ user_id: userId, tipo: "despesa", valor: data.valor, categoria: data.categoria, descricao: data.descricao, data: data.data, origem: "pdf" })
      .select("id")
      .single();
    if (error) throw new Error("Não consegui registar a despesa.");
    await supabase.from("uploaded_documents").update({ estado: "confirmado", transaction_id: tx.id, valor_extraido: data.valor, categoria_sugerida: data.categoria }).eq("id", doc.id);
    if (data.messageId) {
      const { data: msg } = await supabase.from("chat_messages").select("parts").eq("id", data.messageId).maybeSingle();
      if (msg) {
        const updated = (msg.parts as unknown as ChatPart[]).map((p) =>
          p.type === "document" && p.document.id === doc.id
            ? { ...p, document: { ...p.document, estado: "confirmado" as const, transaction_id: tx.id, valor_extraido: data.valor, categoria_sugerida: data.categoria } }
            : p,
        );
        await supabase.from("chat_messages").update({ parts: updated as unknown as Json }).eq("id", data.messageId);
      }
    }
    const valor = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(data.valor);
    const parts: ChatPart[] = [
      {
        type: "text",
        text: `Pronto! Registei **${data.descricao}** de **${valor}** em ${data.categoria} (${data.data}). Quer dividir esta conta com alguém? Diga, por exemplo, "divide pelo grupo Casa".`,
      },
    ];
    const { data: row } = await supabase
      .from("chat_messages")
      .insert({ user_id: userId, role: "assistant", parts: parts as unknown as Json })
      .select("id,role,parts,created_at")
      .single();
    return { transactionId: tx.id, message: row ? ({ ...row, parts: row.parts as unknown as ChatPart[] } as ChatMessage) : null };
  });

export const discardDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("uploaded_documents").update({ estado: "descartado" }).eq("id", data.id).eq("estado", "pendente");
    if (error) throw new Error("Não consegui descartar.");
    return { ok: true };
  });
