import type { Json } from "@/integrations/supabase/types";

export type DocumentDTO = {
  id: string;
  nome_arquivo: string;
  empresa: string | null;
  valor_extraido: number | null;
  data_extraida: string | null;
  tipo_despesa: string | null;
  categoria_sugerida: string | null;
  estado: "pendente" | "confirmado" | "descartado";
  transaction_id: string | null;
};

export type ChatPart =
  | { type: "text"; text: string }
  | {
      type: "tool";
      toolCallId: string;
      name: string;
      input: Record<string, Json>;
      state: "input-available" | "output-available" | "output-error";
      output?: Json;
      errorText?: string;
    }
  | { type: "document"; document: DocumentDTO }
  | { type: "file"; filename: string; mediaType: string };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  parts: ChatPart[];
  created_at?: string;
};

export type StreamEvent =
  | { type: "user-saved"; id: string }
  | { type: "text-delta"; delta: string }
  | { type: "tool-start"; toolCallId: string; name: string; input: Record<string, Json> }
  | { type: "tool-result"; toolCallId: string; output?: Json; errorText?: string }
  | { type: "done"; id: string }
  | { type: "error"; message: string };
