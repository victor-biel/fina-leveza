// Pure finance rules shared by the browser and the server. Keep free of I/O.

export const CATEGORIAS = [
  "Alimentação",
  "Supermercado",
  "Restaurantes",
  "Casa",
  "Contas",
  "Transportes",
  "Saúde",
  "Lazer",
  "Compras",
  "Educação",
  "Subscrições",
  "Outros",
] as const;

export const CATEGORIAS_RECEITA = ["Salário", "Freelance", "Investimentos", "Presentes", "Outros"] as const;

export type Tipo = "receita" | "despesa";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatMoney(n: number, moeda = "EUR"): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: moeda,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export type SplitParticipant = {
  nome: string;
  is_self?: boolean;
  percentual?: number | null;
};

export type SplitShare = {
  nome: string;
  is_self: boolean;
  percentual: number;
  valor: number;
};

export type SplitResult = { ok: true; shares: SplitShare[] } | { ok: false; error: string };

/**
 * Splits a total between participants. Without percentages the split is equal.
 * With percentages, every participant needs one and they must add up to 100%.
 * Cents are distributed so the shares always add up exactly to the total.
 */
export function computeSplit(total: number, participants: SplitParticipant[]): SplitResult {
  if (!(total > 0)) return { ok: false, error: "O valor total tem de ser maior que zero." };
  if (participants.length < 2) return { ok: false, error: "São precisas pelo menos 2 pessoas para dividir." };

  const names = participants.map((p) => p.nome.trim().toLowerCase());
  if (new Set(names).size !== names.length) return { ok: false, error: "Há nomes repetidos na divisão." };

  const withPct = participants.filter((p) => p.percentual != null);
  let pcts: number[];
  if (withPct.length === 0) {
    const base = 100 / participants.length;
    pcts = participants.map(() => base);
  } else {
    if (withPct.length !== participants.length) {
      return { ok: false, error: "Indique a percentagem de todas as pessoas, ou de nenhuma." };
    }
    pcts = participants.map((p) => Number(p.percentual));
    if (pcts.some((p) => p < 0 || p > 100)) return { ok: false, error: "Percentagens têm de estar entre 0% e 100%." };
    const sum = pcts.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > 0.01) {
      return { ok: false, error: `As percentagens somam ${round2(sum)}%, mas têm de somar 100%.` };
    }
  }

  const totalCents = Math.round(total * 100);
  const raw = pcts.map((p) => (totalCents * p) / 100);
  const cents = raw.map((r) => Math.floor(r));
  let remainder = totalCents - cents.reduce((a, b) => a + b, 0);
  // Give leftover cents to the largest fractional parts first.
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) cents[order[k]!.i]! += 1;

  return {
    ok: true,
    shares: participants.map((p, i) => ({
      nome: p.nome.trim(),
      is_self: !!p.is_self,
      percentual: round2(pcts[i]!),
      valor: cents[i]! / 100,
    })),
  };
}

export type TxLike = { id: string; tipo: Tipo | string; valor: number | string; categoria: string; data: string; pago_por?: string | null };
export type SplitLike = {
  transaction_id: string;
  membro: string;
  is_self: boolean;
  valor: number | string;
  liquidado: boolean;
};

/** Expense amount that belongs to the user: their own share when the expense was split. */
export function userShare(tx: TxLike, splits: SplitLike[]): number {
  const own = splits.filter((s) => s.transaction_id === tx.id);
  if (own.length === 0) return Number(tx.valor);
  return own.filter((s) => s.is_self).reduce((a, s) => a + Number(s.valor), 0);
}

export type SharedBalance = {
  pagoPeloUtilizador: number;
  devemAoUtilizador: number;
  utilizadorDeve: number;
  porPessoa: { nome: string; saldo: number }[]; // > 0: person owes the user; < 0: user owes the person
};

export function sharedBalances(txs: TxLike[], splits: SplitLike[]): SharedBalance {
  const byTx = new Map<string, SplitLike[]>();
  for (const s of splits) byTx.set(s.transaction_id, [...(byTx.get(s.transaction_id) ?? []), s]);
  let pago = 0;
  let devem = 0;
  let deve = 0;
  const pessoas = new Map<string, number>();
  for (const tx of txs) {
    const rows = byTx.get(tx.id);
    if (!rows) continue;
    const payer = tx.pago_por?.trim();
    if (!payer) {
      pago += Number(tx.valor);
      for (const s of rows) {
        if (s.is_self || s.liquidado) continue;
        devem += Number(s.valor);
        pessoas.set(s.membro, (pessoas.get(s.membro) ?? 0) + Number(s.valor));
      }
    } else {
      for (const s of rows) {
        if (!s.is_self || s.liquidado) continue;
        deve += Number(s.valor);
        pessoas.set(payer, (pessoas.get(payer) ?? 0) - Number(s.valor));
      }
    }
  }
  return {
    pagoPeloUtilizador: round2(pago),
    devemAoUtilizador: round2(devem),
    utilizadorDeve: round2(deve),
    porPessoa: [...pessoas.entries()]
      .map(([nome, saldo]) => ({ nome, saldo: round2(saldo) }))
      .filter((p) => p.saldo !== 0)
      .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo)),
  };
}

export type GoalLike = { valor_objetivo: number | string; valor_atual: number | string; prazo: string; created_at: string };

function monthsBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
}

export function goalProgress(goal: GoalLike, today = new Date()) {
  const alvo = Number(goal.valor_objetivo);
  const atual = Number(goal.valor_atual);
  const falta = Math.max(0, round2(alvo - atual));
  const percent = alvo > 0 ? Math.min(100, Math.round((atual / alvo) * 100)) : 0;
  const prazo = new Date(goal.prazo + "T12:00:00");
  const mesesRestantes = Math.max(0, monthsBetween(today, prazo));
  const poupancaMensal = falta === 0 ? 0 : round2(falta / Math.max(1, Math.ceil(mesesRestantes)));
  const mesesDecorridos = Math.max(0.5, monthsBetween(new Date(goal.created_at), today));
  const ritmo = atual / mesesDecorridos;
  let previsao: Date | null = null;
  if (falta === 0) previsao = today;
  else if (ritmo > 0) previsao = new Date(today.getTime() + (falta / ritmo) * 30.4375 * 86400000);
  return { alvo, atual, falta, percent, poupancaMensal, previsao, noRitmo: previsao ? previsao <= prazo : false };
}

export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
