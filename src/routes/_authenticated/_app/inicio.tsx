import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, FileText, Lightbulb, MessageCircle, Plus, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, EmptyState, Money, PageHeader, Section, TxRow } from "@/components/app/ui-bits";
import { goalsQuery, profileQuery, splitsQuery, transactionsQuery } from "@/lib/queries";
import { buildInsights, currentMonthKey, monthLabel, monthSummary } from "@/lib/period";
import { goalProgress, userShare } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/_app/inicio")({
  head: () => ({
    meta: [
      { title: "Início — Fina" },
      { name: "description", content: "O seu resumo financeiro do mês, num relance." },
      { property: "og:title", content: "Início — Fina" },
      { property: "og:description", content: "O seu resumo financeiro do mês, num relance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([queryClient.ensureQueryData(transactionsQuery), queryClient.ensureQueryData(splitsQuery), queryClient.ensureQueryData(goalsQuery)]),
  component: Home,
});

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? "Boa noite" : h < 12 ? "Bom dia" : h < 20 ? "Boa tarde" : "Boa noite";
}

const quick = [
  { label: "Registar gasto", icon: Plus, q: "Gastei " },
  { label: "Enviar fatura", icon: FileText, q: "" , upload: true },
  { label: "Nova meta", icon: Target, q: "Quero criar uma meta para " },
  { label: "Dividir conta", icon: Users, q: "Divide a conta de " },
];

function Home() {
  const { data: profile } = useSuspenseQuery(profileQuery);
  const { data: txs } = useSuspenseQuery(transactionsQuery);
  const { data: splits } = useSuspenseQuery(splitsQuery);
  const { data: goals } = useSuspenseQuery(goalsQuery);
  const moeda = profile?.moeda ?? "EUR";
  const key = currentMonthKey();
  const m = monthSummary(txs, splits, key);
  const insight = buildInsights(txs, splits, goals)[0];
  const first = profile?.nome?.split(" ")[0] ?? "";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`${greeting()}${first ? `, ${first}` : ""} 👋`} subtitle={`Resumo de ${monthLabel(key, "long")}`} settings />

      <Section className="mt-3">
        <div className="animate-rise relative overflow-hidden rounded-3xl bg-hero p-6 text-primary-foreground shadow-lift">
          <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-highlight/20 blur-2xl" />
          <p className="text-sm text-primary-foreground/75">Saldo do mês</p>
          <Money value={m.saldo} moeda={moeda} className="mt-1 block font-display text-4xl font-bold" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-primary-foreground/10 p-3">
              <p className="flex items-center gap-1 text-xs text-primary-foreground/75"><ArrowUpRight className="size-3.5 text-highlight" /> Receitas</p>
              <Money value={m.receitas} moeda={moeda} className="mt-0.5 block text-lg font-semibold" />
            </div>
            <div className="rounded-2xl bg-primary-foreground/10 p-3">
              <p className="flex items-center gap-1 text-xs text-primary-foreground/75"><ArrowDownRight className="size-3.5 text-highlight" /> Despesas</p>
              <Money value={m.despesas} moeda={moeda} className="mt-0.5 block text-lg font-semibold" />
            </div>
          </div>
        </div>
      </Section>

      <Section className="mt-6">
        <div className="grid grid-cols-4 gap-2">
          {quick.map(({ label, icon: Icon, q, upload }) => (
            <Link key={label} to="/chat" search={upload ? { anexar: true } : { q }} className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3 text-center shadow-soft transition-transform active:scale-95">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-primary"><Icon className="size-5" /></span>
              <span className="text-[11px] font-semibold leading-tight text-foreground">{label}</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section className="mt-6">
        <Card className="flex items-start gap-3 bg-highlight/25 shadow-none">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-highlight text-highlight-foreground"><Lightbulb className="size-5" /></span>
          <p className="text-sm font-medium text-foreground">{insight?.text}</p>
        </Card>
      </Section>

      {goals.length > 0 && (
        <Section title="As suas metas" className="mt-8" action={<Link to="/metas" className="text-sm font-semibold text-sky">Ver todas</Link>}>
          <div className="grid gap-3 sm:grid-cols-2">
            {goals.slice(0, 2).map((g) => {
              const p = goalProgress(g);
              return (
                <Card key={g.id} className="p-4">
                  <div className="flex items-baseline justify-between">
                    <p className="font-semibold">{g.nome}</p>
                    <span className="text-sm font-bold text-primary tabular">{p.percent}%</span>
                  </div>
                  <Progress value={p.percent} className="mt-3 h-2.5" />
                  <p className="mt-2 text-xs text-muted-foreground"><Money value={p.atual} moeda={moeda} /> de <Money value={p.alvo} moeda={moeda} /></p>
                </Card>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Últimos movimentos" className="mt-8" action={txs.length > 0 ? <Link to="/painel" className="text-sm font-semibold text-sky">Painel</Link> : undefined}>
        {txs.length === 0 ? (
          <EmptyState title="Ainda sem movimentos" text='Diga à Fina algo como "Gastei 40€ no supermercado" e ela regista por si.' cta={<Button asChild><Link to="/chat" search={{ q: "Gastei 40€ no supermercado" }}>Experimentar</Link></Button>} />
        ) : (
          <Card className="py-1">
            <ul className="divide-y">
              {txs.slice(0, 6).map((t) => <TxRow key={t.id} tx={t} moeda={moeda} share={t.tipo === "despesa" ? userShare(t, splits) : undefined} />)}
            </ul>
          </Card>
        )}
      </Section>

      <Section className="mt-8 hidden lg:block">
        <Button asChild size="xl" className="w-full"><Link to="/chat"><MessageCircle /> Falar com a Fina</Link></Button>
      </Section>
    </div>
  );
}
