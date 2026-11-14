import { userShare, round2, type TxLike, type SplitLike } from "./finance";

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export function currentMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function prevMonthKey(key: string) {
  const [y = 1970, m = 1] = key.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return currentMonthKey(d);
}

export function monthLabel(key: string, style: "short" | "long" = "short") {
  const [y = 1970, m = 1] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-PT", { month: style }).format(new Date(y, m - 1, 1)).replace(".", "");
}

export function monthSummary(txs: TxLike[], splits: SplitLike[], key: string) {
  let receitas = 0;
  let despesas = 0;
  const porCategoria: Record<string, number> = {};
  for (const t of txs) {
    if (monthKey(t.data) !== key) continue;
    if (t.tipo === "receita") receitas += Number(t.valor);
    else {
      const v = userShare(t, splits);
      despesas += v;
      porCategoria[t.categoria] = (porCategoria[t.categoria] ?? 0) + v;
    }
  }
  return { receitas: round2(receitas), despesas: round2(despesas), saldo: round2(receitas - despesas), porCategoria };
}

export function lastMonths(n: number, from = new Date()) {
  const keys: string[] = [];
  let k = currentMonthKey(from);
  for (let i = 0; i < n; i++) {
    keys.unshift(k);
    k = prevMonthKey(k);
  }
  return keys;
}

/** Simple, friendly insights computed from the user's own data. */
export function buildInsights(txs: TxLike[], splits: SplitLike[], goals: { nome: string; valor_objetivo: number | string; valor_atual: number | string }[]) {
  const cur = currentMonthKey();
  const prev = prevMonthKey(cur);
  const a = monthSummary(txs, splits, cur);
  const b = monthSummary(txs, splits, prev);
  const out: { tone: "warn" | "good" | "info"; text: string }[] = [];
  const cats = Object.entries(a.porCategoria).sort((x, y) => y[1] - x[1]);
  for (const [cat, v] of cats.slice(0, 3)) {
    const before = b.porCategoria[cat] ?? 0;
    if (before > 0) {
      const pct = Math.round(((v - before) / before) * 100);
      if (pct >= 15) {
        out.push({ tone: "warn", text: `Os seus gastos com ${cat.toLowerCase()} aumentaram ${pct}% este mês.` });
        break;
      }
      if (pct <= -15) {
        out.push({ tone: "good", text: `Boa! Gastou menos ${Math.abs(pct)}% em ${cat.toLowerCase()} do que no mês passado.` });
        break;
      }
    }
  }
  for (const g of goals) {
    const pct = Math.round((Number(g.valor_atual) / Number(g.valor_objetivo)) * 100);
    if (pct >= 50 && pct < 100) {
      out.push({ tone: "good", text: `Está a ${pct}% da meta "${g.nome}". Continue assim!` });
      break;
    }
  }
  const subs = a.porCategoria["Subscrições"] ?? 0;
  if (subs > 20) out.push({ tone: "info", text: `Gasta cerca de ${Math.round(subs)}€ por mês em subscrições. Rever as que não usa pode ajudar a poupar.` });
  if (a.receitas > 0 && a.despesas > a.receitas * 0.9)
    out.push({ tone: "warn", text: "As despesas deste mês já estão perto das receitas. Vale a pena abrandar." });
  if (out.length === 0) out.push({ tone: "info", text: "Registe os seus gastos no chat para eu começar a dar-lhe dicas personalizadas." });
  return out;
}
