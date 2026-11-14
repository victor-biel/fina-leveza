import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, EmptyState, Money, PageHeader, Section } from "@/components/app/ui-bits";
import { goalsQuery, profileQuery } from "@/lib/queries";
import { goalProgress } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/_app/metas")({
  head: () => ({
    meta: [
      { title: "Metas — Fina" },
      { name: "description", content: "Acompanhe as suas metas de poupança e quanto falta para lá chegar." },
      { property: "og:title", content: "Metas — Fina" },
      { property: "og:description", content: "Acompanhe as suas metas de poupança e quanto falta para lá chegar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(goalsQuery),
  component: Metas,
});

const fmt = (iso: string) => new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso + "T12:00:00"));

function Metas() {
  const { data: profile } = useSuspenseQuery(profileQuery);
  const { data: goals } = useSuspenseQuery(goalsQuery);
  const moeda = profile?.moeda ?? "EUR";
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Metas" subtitle="O que está a construir" settings />
      <Section className="mt-3">
        {goals.length === 0 ? (
          <EmptyState title="Ainda sem metas" text='Diga à Fina, por exemplo, "Quero poupar 2000€ para férias até agosto".' cta={<Button asChild><Link to="/chat" search={{ q: "Quero criar uma meta para " }}>Criar meta</Link></Button>} />
        ) : (
          <div className="grid gap-3">
            {goals.map((g) => {
              const p = goalProgress(g);
              return (
                <Card key={g.id}>
                  <div className="flex items-baseline justify-between">
                    <p className="font-display text-lg font-semibold">{g.nome}</p>
                    <span className="font-bold text-primary tabular">{p.percent}%</span>
                  </div>
                  <Progress value={p.percent} className="mt-3 h-2.5" />
                  <p className="mt-2 text-sm text-muted-foreground"><Money value={p.atual} moeda={moeda} /> de <Money value={p.alvo} moeda={moeda} /> · prazo {fmt(g.prazo)}</p>
                  {p.falta > 0 && <p className="mt-1 text-sm">Poupe cerca de <Money value={p.poupancaMensal} moeda={moeda} className="font-semibold" /> por mês para chegar a tempo.</p>}
                </Card>
              );
            })}
            <Button asChild variant="outline"><Link to="/chat" search={{ q: "Adiciona 50€ à meta " }}>Adicionar dinheiro a uma meta</Link></Button>
          </div>
        )}
      </Section>
    </div>
  );
}
