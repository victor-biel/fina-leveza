import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage, ChatPart } from "./chat-types";

async function uid() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Sessão expirada");
  return id;
}

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const id = await uid();
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const transactionsQuery = queryOptions({
  queryKey: ["transactions"],
  queryFn: async () => {
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .gte("data", since.toISOString().slice(0, 10))
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return data.map((t) => ({ ...t, valor: Number(t.valor) }));
  },
});

export const splitsQuery = queryOptions({
  queryKey: ["splits"],
  queryFn: async () => {
    const { data, error } = await supabase.from("expense_splits").select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) throw error;
    return data.map((s) => ({ ...s, valor: Number(s.valor), percentual: Number(s.percentual) }));
  },
});

export const goalsQuery = queryOptions({
  queryKey: ["goals"],
  queryFn: async () => {
    const { data, error } = await supabase.from("goals").select("*").order("prazo");
    if (error) throw error;
    return data;
  },
});

export const groupsQuery = queryOptions({
  queryKey: ["groups"],
  queryFn: async () => {
    const { data, error } = await supabase.from("split_groups").select("*, group_members(*)").order("created_at");
    if (error) throw error;
    return data;
  },
});

export const chatQuery = queryOptions({
  queryKey: ["chat"],
  queryFn: async (): Promise<ChatMessage[]> => {
    const { data, error } = await supabase.from("chat_messages").select("id,role,parts,created_at").order("created_at", { ascending: false }).limit(150);
    if (error) throw error;
    return data.reverse().map((m) => ({ id: m.id, role: m.role as ChatMessage["role"], parts: m.parts as unknown as ChatPart[], created_at: m.created_at }));
  },
  staleTime: Infinity,
});

export const documentQuery = (id: string) =>
  queryOptions({
    queryKey: ["document", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("uploaded_documents").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const financeKeys = [["transactions"], ["splits"], ["goals"], ["groups"]] as const;
