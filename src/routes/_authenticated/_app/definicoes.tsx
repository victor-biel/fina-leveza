import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, Section } from "@/components/app/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/_app/definicoes")({
  head: () => ({
    meta: [
      { title: "Definições — Fina" },
      { name: "description", content: "O seu perfil e a sua conta na Fina." },
      { property: "og:title", content: "Definições — Fina" },
      { property: "og:description", content: "O seu perfil e a sua conta na Fina." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Definicoes,
});

function Definicoes() {
  const { data: profile } = useSuspenseQuery(profileQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  const rows: [string, string][] = [
    ["Nome", profile?.nome ?? "—"],
    ["Email", profile?.email ?? "—"],
    ["Receita mensal", profile?.receita_mensal != null ? `${Number(profile.receita_mensal)} €` : "—"],
    ["Objetivos", profile?.objetivos ?? "—"],
    ["Partilha com", profile?.partilha ?? "—"],
    ["Lembretes", profile?.notificacoes ? "Sim" : "Não"],
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Definições" />
      <Section className="mt-3">
        <Card className="py-1">
          <dl className="divide-y">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
            ))}
          </dl>
        </Card>
        <Button variant="outline" className="mt-6 w-full" onClick={signOut}><LogOut /> Terminar sessão</Button>
      </Section>
    </div>
  );
}
