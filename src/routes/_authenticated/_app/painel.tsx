import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Card, CategoryIcon, EmptyState, Money, PageHeader, Section, TxRow } from "@/components/app/ui-bits";
import { profileQuery, splitsQuery, transactionsQuery } from "@/lib/queries";
import { currentMonthKey, lastMonths, monthKey, monthLabel, monthSummary, prevMonthKey } from "@/lib/period";
import { pctChange, userShare } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/_app/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Fina" },
      { name: "description", content: "Receitas, despesas e gastos por categoria, mês a mês." },
      { property: "og:title", content: "Painel — Fina" },
      { property: "og:description", content: "Receitas, despesas e gastos por categoria, mês a mês." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) => Promise.all([queryClient.ensureQueryData(transactionsQuery), queryClient.ensureQueryData(splitsQuery)]),
  component: Painel,
});

function Painel() {
  const { data: profile } = useSuspenseQuery(profileQuery);
  const { data: txs } = useSuspenseQuery(transactionsQuery);
  const { data: splits } = useSuspenseQuery(splitsQuery);
  const moeda = profile?.moeda ?? "EUR";
  const key = currentMonthKey();
  const m = monthSummary(txs, splits, key);
  const prev = monthSummary(txs, splits, prevMonthKey(key));
  const change = pctChange(m.despesas, prev.despesas);
  const cats = Object.entries(m.porCategoria).sort((a, b) => b[1] - a[1]);
  const months = lastMonths(6).map((k) => ({ k, ...monthSummary(txs, splits, k) }));
  const max = Math.max(1, ...months.map((x) => Math.max(x.receitas, x.despesas)));
  const monthTxs = txs.filter((t) => monthKey(t.data) === key);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Painel" subtitle={`Resumo de ${monthLabel(key, "long")}`} settings />
      <Section className="mt-3">
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4"><p className="text-xs text-muted-foreground">Receitas</p><Money value={m.receitas} moeda={moeda} className="font-semibold text-income" /></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Despesas</p><Money value={m.despesas} moeda={moeda} className="font-semibold" /></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Saldo</p><Money value={m.saldo} moeda={moeda} className="font-semibold text-primary" /></Card>
        </div>
        {change != null && (
          <p className="mt-3 text-sm text-muted-foreground">
            Gastou {Math.abs(change)}% {change >= 0 ? "mais" : "menos"} do que no mês passado.
          </p>
        )}
      </Section>

      <Section title="Últimos 6 meses" className="mt-8">
        <Card>
          <div className="flex h-40 items-end justify-between gap-3">
            {months.map((x) => (
              <div key={x.k} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-32 w-full items-end justify-center gap-1">
                  <div className="w-1/3 rounded-t-md bg-chart-2" style={{ height: `${(x.receitas / max) * 100}%` }} title={`Receitas ${x.receitas}`} />
                  <div className="w-1/3 rounded-t-md bg-chart-1" style={{ height: `${(x.despesas / max) * 100}%` }} title={`Despesas ${x.despesas}`} />
                </div>
                <span className="text-xs text-muted-foreground">{monthLabel(x.k)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-chart-2" /> Receitas</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-chart-1" /> Despesas</span>
          </p>
        </Card>
      </Section>

      <Section title="Por categoria" className="mt-8">
        {cats.length === 0 ? (
          <EmptyState title="Sem despesas este mês" text="Quando registar gastos, vê aqui para onde vai o seu dinheiro." />
        ) : (
          <Card className="space-y-4">
            {cats.map(([cat, v]) => (
              <div key={cat} className="flex items-center gap-3">
                <CategoryIcon categoria={cat} />
                <div className="flex-1">
                  <div className="flex justify-between text-sm"><span className="font-medium">{cat}</span><Money value={v} moeda={moeda} className="font-semibold" /></div>
                  <div className="mt-1.5 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-sky" style={{ width: `${(v / (m.despesas || 1)) * 100}%` }} /></div>
                </div>
              </div>
            ))}
          </Card>
        )}
      </Section>

      {monthTxs.length > 0 && (
        <Section title="Movimentos do mês" className="mt-8">
          <Card className="py-1">
            <ul className="divide-y">
              {monthTxs.map((t) => <TxRow key={t.id} tx={t} moeda={moeda} share={t.tipo === "despesa" ? userShare(t, splits) : undefined} />)}
            </ul>
          </Card>
        </Section>
      )}
    </div>
  );
}
