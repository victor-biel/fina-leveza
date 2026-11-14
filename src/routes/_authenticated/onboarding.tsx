import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { FinaMark } from "@/components/app/brand";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Boas-vindas — Fina" },
      { name: "description", content: "Conte à Fina um pouco sobre si para começar." },
      { property: "og:title", content: "Boas-vindas — Fina" },
      { property: "og:description", content: "Conte à Fina um pouco sobre si para começar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

const OBJETIVOS = ["Controlar gastos", "Fundo de emergência", "Férias", "Comprar casa", "Pagar dívidas", "Investir"];
const RECEITAS = [800, 1200, 1800, 2500];

function Chip({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-all",
        active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground hover:border-sky",
      )}
    >
      {active && <Check className="size-4" />}
      {children}
    </button>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useQuery(profileQuery);
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState("");
  const [receita, setReceita] = useState("");
  const [objetivos, setObjetivos] = useState<string[]>([]);
  const [pessoas, setPessoas] = useState<string[]>([]);
  const [novaPessoa, setNovaPessoa] = useState("");
  const [grupo, setGrupo] = useState("Casa");
  const [notificacoes, setNotificacoes] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.nome && !nome) setNome(profile.nome);
  }, [profile?.nome]); // eslint-disable-line react-hooks/exhaustive-deps

  const first = nome.trim().split(" ")[0];
  const steps = [
    { q: "Olá! Eu sou a Fina 👋 Como gostaria que eu o tratasse?", ok: nome.trim().length > 0 },
    { q: `Prazer, ${first}! Quanto recebe por mês, mais ou menos?`, ok: true, hint: "Não precisa de ser exato. Pode saltar." },
    { q: "O que gostaria de conseguir com a sua vida financeira?", ok: true, hint: "Escolha quantos quiser." },
    { q: "Partilha despesas com alguém? (casa, família, colegas)", ok: true, hint: "Eu crio um grupo para dividir contas automaticamente." },
    { q: "Quer que eu lhe envie lembretes e dicas de vez em quando?", ok: notificacoes !== null },
  ];
  const current = steps[step]!;

  function addPessoa() {
    const n = novaPessoa.trim();
    if (n && !pessoas.includes(n)) setPessoas([...pessoas, n]);
    setNovaPessoa("");
  }

  async function finish() {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const id = auth.user!.id;
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id,
          email: auth.user!.email ?? null,
          nome: nome.trim(),
          receita_mensal: receita ? Number(receita) : null,
          objetivos: objetivos.join(", ") || null,
          partilha: pessoas.join(", ") || null,
          notificacoes: !!notificacoes,
          onboarded: true,
        });
      if (error) throw error;
      if (pessoas.length) {
        const { data: g, error: gErr } = await supabase.from("split_groups").insert({ user_id: id, nome: grupo.trim() || "Casa" }).select("id").single();
        if (gErr) throw gErr;
        const { error: mErr } = await supabase.from("group_members").insert([
          { user_id: id, group_id: g.id, nome: nome.trim(), is_self: true },
          ...pessoas.map((p) => ({ user_id: id, group_id: g.id, nome: p })),
        ]);
        if (mErr) throw mErr;
      }
      await qc.invalidateQueries();
      navigate({ to: "/inicio", replace: true });
    } catch {
      toast.error("Não consegui guardar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (!current.ok) return;
    if (step === steps.length - 1) finish();
    else setStep(step + 1);
  }

  return (
    <div className="flex min-h-screen flex-col bg-soft">
      <div className="mx-auto w-full max-w-lg px-5 pt-6">
        <div className="flex items-center gap-3">
          {step > 0 ? (
            <Button variant="ghost" size="icon-sm" onClick={() => setStep(step - 1)} aria-label="Voltar"><ArrowLeft /></Button>
          ) : <span className="size-8" />}
          <Progress value={((step + 1) / steps.length) * 100} className="h-2 flex-1" aria-label={`Passo ${step + 1} de ${steps.length}`} />
          <span className="w-10 text-right text-xs font-medium text-muted-foreground tabular">{step + 1}/{steps.length}</span>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pb-8 pt-10">
        <div key={step} className="animate-rise flex items-start gap-3">
          <FinaMark className="size-11 shrink-0" />
          <div className="rounded-3xl rounded-tl-md bg-card p-4 shadow-soft">
            <p className="font-display text-lg font-semibold leading-snug text-foreground">{current.q}</p>
            {current.hint && <p className="mt-1 text-sm text-muted-foreground">{current.hint}</p>}
          </div>
        </div>

        <form
          key={`a${step}`}
          className="animate-rise mt-8 flex flex-1 flex-col [animation-delay:120ms]"
          onSubmit={(e) => { e.preventDefault(); next(); }}
        >
          <div className="flex-1">
            {step === 0 && (
              <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="O seu nome" className="h-14 rounded-2xl text-lg" />
            )}
            {step === 1 && (
              <div className="space-y-4">
                <div className="relative">
                  <Input autoFocus inputMode="decimal" value={receita} onChange={(e) => setReceita(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Ex.: 1500" className="h-14 rounded-2xl pr-12 text-lg tabular" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">€</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {RECEITAS.map((r) => <Chip key={r} active={receita === String(r)} onClick={() => setReceita(String(r))}>{r} €</Chip>)}
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="flex flex-wrap gap-2">
                {OBJETIVOS.map((o) => (
                  <Chip key={o} active={objetivos.includes(o)} onClick={() => setObjetivos(objetivos.includes(o) ? objetivos.filter((x) => x !== o) : [...objetivos, o])}>{o}</Chip>
                ))}
              </div>
            )}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input autoFocus value={novaPessoa} onChange={(e) => setNovaPessoa(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPessoa(); } }} placeholder="Nome (ex.: Ana)" className="h-12 rounded-2xl" />
                  <Button type="button" variant="secondary" size="icon" className="h-12 w-12 rounded-2xl" onClick={addPessoa} aria-label="Adicionar pessoa"><Plus /></Button>
                </div>
                {pessoas.length > 0 && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {pessoas.map((p) => (
                        <span key={p} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground">
                          {p}
                          <button type="button" aria-label={`Remover ${p}`} onClick={() => setPessoas(pessoas.filter((x) => x !== p))}><X className="size-3.5" /></button>
                        </span>
                      ))}
                    </div>
                    <label className="block text-sm font-medium text-foreground">
                      Nome do grupo
                      <Input value={grupo} onChange={(e) => setGrupo(e.target.value)} className="mt-1.5 h-11 rounded-xl" />
                    </label>
                  </>
                )}
              </div>
            )}
            {step === 4 && (
              <div className="flex flex-wrap gap-2">
                <Chip active={notificacoes === true} onClick={() => setNotificacoes(true)}>Sim, quero</Chip>
                <Chip active={notificacoes === false} onClick={() => setNotificacoes(false)}>Agora não</Chip>
              </div>
            )}
          </div>

          <div className="mt-8 flex gap-3">
            {(step === 1 || step === 2 || step === 3) && (
              <Button type="button" variant="ghost" size="lg" onClick={() => { if (step === 3) setPessoas([]); setStep(step + 1); }}>
                {step === 3 ? "Só eu" : "Saltar"}
              </Button>
            )}
            <Button type="submit" size="xl" className="flex-1" disabled={!current.ok || saving}>
              {step === steps.length - 1 ? "Começar" : "Continuar"} <ArrowRight />
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
