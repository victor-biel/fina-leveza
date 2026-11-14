import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, FileText, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FinaLogo, FinaMark } from "@/components/app/brand";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fina — As suas finanças, numa conversa" },
      { name: "description", content: "Registe gastos, crie metas e divida contas apenas a conversar. Simples, para quem está a começar." },
      { property: "og:title", content: "Fina — As suas finanças, numa conversa" },
      { property: "og:description", content: "Registe gastos, crie metas e divida contas apenas a conversar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const demo = [
  { from: "user", text: "Gastei 15€ em café." },
  { from: "fina", text: "Registado! ☕ 15,00 € em Alimentação, hoje." },
  { from: "user", text: "Divide a luz de 90€ entre mim, Ana e João." },
  { from: "fina", text: "Feito: Victor → 30 €, Ana → 30 €, João → 30 €." },
];

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <div className="min-h-screen bg-hero text-primary-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <FinaLogo light />
        <Button variant="onHero" size="sm" asChild>
          <Link to={signedIn ? "/inicio" : "/auth"}>{signedIn ? "Abrir app" : "Entrar"}</Link>
        </Button>
      </header>

      <main className="mx-auto grid max-w-5xl gap-12 px-5 pb-20 pt-6 md:grid-cols-2 md:items-center md:pt-16">
        <section className="animate-rise">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-semibold">
            <span className="size-1.5 rounded-full bg-highlight" /> Assistente financeiro pessoal
          </p>
          <h1 className="text-4xl font-bold leading-[1.05] md:text-6xl">
            As suas finanças,<br />
            <span className="text-highlight">numa conversa.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-primary-foreground/80">
            Diga o que gastou, envie faturas e divida contas. A Fina organiza tudo por si — sem formulários nem folhas de cálculo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="highlight" size="xl" asChild>
              <Link to={signedIn ? "/inicio" : "/auth"}>
                Começar agora <ArrowRight />
              </Link>
            </Button>
          </div>
          <ul className="mt-10 grid max-w-md grid-cols-3 gap-3 text-sm text-primary-foreground/85">
            <li className="flex flex-col gap-2"><FileText className="size-5 text-highlight" /> Lê faturas em PDF</li>
            <li className="flex flex-col gap-2"><Target className="size-5 text-highlight" /> Metas com previsão</li>
            <li className="flex flex-col gap-2"><Users className="size-5 text-highlight" /> Divide contas</li>
          </ul>
        </section>

        <section aria-label="Exemplo de conversa" className="animate-rise rounded-3xl bg-card p-5 text-card-foreground shadow-lift [animation-delay:150ms]">
          <div className="mb-4 flex items-center gap-3 border-b pb-4">
            <FinaMark className="size-10" />
            <div>
              <p className="font-display font-semibold">Fina</p>
              <p className="text-xs text-muted-foreground">online · responde em segundos</p>
            </div>
          </div>
          <div className="space-y-3">
            {demo.map((m, i) => (
              <div key={i} className={m.from === "user" ? "flex justify-end" : "flex"}>
                <p
                  className={
                    m.from === "user"
                      ? "max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                      : "max-w-[85%] text-sm text-foreground"
                  }
                >
                  {m.text}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
