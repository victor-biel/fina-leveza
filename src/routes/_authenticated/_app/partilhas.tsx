import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Money, PageHeader, Section } from "@/components/app/ui-bits";
import { groupsQuery, profileQuery, splitsQuery, transactionsQuery } from "@/lib/queries";
import { sharedBalances } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/_app/partilhas")({
  head: () => ({
    meta: [
      { title: "Partilhas — Fina" },
      { name: "description", content: "Veja quem lhe deve, a quem deve e os seus grupos de divisão de contas." },
      { property: "og:title", content: "Partilhas — Fina" },
      { property: "og:description", content: "Veja quem lhe deve, a quem deve e os seus grupos de divisão de contas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context: { queryClient } }) =>
    Promise.all([queryClient.ensureQueryData(transactionsQuery), queryClient.ensureQueryData(splitsQuery), queryClient.ensureQueryData(groupsQuery)]),
  component: Partilhas,
});

function Partilhas() {
  const { data: profile } = useSuspenseQuery(profileQuery);
  const { data: txs } = useSuspenseQuery(transactionsQuery);
  const { data: splits } = useSuspenseQuery(splitsQuery);
  const { data: groups } = useSuspenseQuery(groupsQuery);
  const moeda = profile?.moeda ?? "EUR";
  const b = sharedBalances(txs, splits);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Partilhas" subtitle="Contas divididas com outras pessoas" settings />
      <Section className="mt-3">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4"><p className="text-xs text-muted-foreground">Devem-lhe</p><Money value={b.devemAoUtilizador} moeda={moeda} className="text-lg font-semibold text-income" /></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Você deve</p><Money value={b.utilizadorDeve} moeda={moeda} className="text-lg font-semibold text-expense" /></Card>
        </div>
      </Section>
      <Section title="Saldos por pessoa" className="mt-8">
        {b.porPessoa.length === 0 ? (
          <EmptyState title="Tudo acertado" text='Para dividir uma conta, diga à Fina "Divide 90€ do jantar entre mim, Ana e Rui".' cta={<Button asChild><Link to="/chat" search={{ q: "Divide a conta de " }}>Dividir conta</Link></Button>} />
        ) : (
          <Card className="py-1">
            <ul className="divide-y">
              {b.porPessoa.map((p) => (
                <li key={p.nome} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{p.saldo > 0 ? "deve-lhe" : "você deve"} <Money value={Math.abs(p.saldo)} moeda={moeda} /></p>
                  </div>
                  <Button asChild size="sm" variant="secondary"><Link to="/chat" search={{ q: `Acertei as contas com ${p.nome}` }}>Acertar</Link></Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Section>
      <Section title="Grupos" className="mt-8">
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda sem grupos. Peça à Fina: "Cria o grupo Casa comigo e com a Ana, 50% cada".</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((g) => (
              <Card key={g.id} className="p-4">
                <p className="font-semibold">{g.nome}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {g.group_members.map((m) => (
                    <li key={m.id} className="flex justify-between"><span>{m.nome}{m.is_self ? " (você)" : ""}</span>{m.percentual_padrao != null && <span>{Number(m.percentual_padrao)}%</span>}</li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
