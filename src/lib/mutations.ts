// Direct edits from the pages (goals, settling up, profile). RLS scopes every row to the signed-in user.
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { round2, validateGoal, type GoalInput } from "./finance";

export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function createGoal(g: GoalInput) {
  const err = validateGoal(g, todayLocal());
  if (err) throw new Error(err);
  const { error } = await supabase
    .from("goals")
    .insert({ nome: g.nome.trim(), valor_objetivo: round2(g.valor_objetivo), prazo: g.prazo, valor_atual: round2(g.valor_atual ?? 0) });
  if (error) throw new Error("Não consegui criar a meta.");
}

export async function addToGoal(id: string, atual: number, valor: number) {
  if (!(valor > 0)) throw new Error("Indique um valor maior que zero.");
  const { error } = await supabase.from("goals").update({ valor_atual: round2(atual + valor) }).eq("id", id);
  if (error) throw new Error("Não consegui atualizar a meta.");
}

export async function deleteGoal(id: string) {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw new Error("Não consegui apagar a meta.");
}

/** Marks everything owed between the user and this person as settled. */
export async function settleWith(pessoa: string) {
  const nome = pessoa.trim();
  const a = await supabase.from("expense_splits").update({ liquidado: true }).ilike("membro", nome).eq("is_self", false).eq("liquidado", false);
  if (a.error) throw new Error("Não consegui acertar as contas.");
  const { data: paid } = await supabase.from("transactions").select("id").ilike("pago_por", nome);
  if (paid?.length) {
    const b = await supabase.from("expense_splits").update({ liquidado: true }).in("transaction_id", paid.map((t) => t.id)).eq("is_self", true).eq("liquidado", false);
    if (b.error) throw new Error("Não consegui acertar as contas.");
  }
}

export async function updateProfile(id: string, patch: TablesUpdate<"profiles">) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw new Error("Não consegui guardar as alterações.");
}
