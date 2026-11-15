import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Tables } from "@/integrations/supabase/types";
import { Card, EmptyState, Money, PageHeader, Section } from "@/components/app/ui-bits";
import { goalsQuery, profileQuery } from "@/lib/queries";
import { goalProgress, parseAmount } from "@/lib/finance";
import { addToGoal, createGoal, deleteGoal, todayLocal } from "@/lib/mutations";

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

type Goal = Tables<"goals">;

function NewGoalDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [prazo, setPrazo] = useState("");
  const [atual, setAtual] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const valor_objetivo = parseAmount(valor);
    const valor_atual = atual.trim() ? parseAmount(atual) : 0;
    if (Number.isNaN(valor_objetivo) || Number.isNaN(valor_atual)) { toast.error("Escreva os valores só com números, por exemplo 2000 ou 12,50."); return; }
    setSaving(true);
    try {
      await createGoal({ nome, valor_objetivo, prazo, valor_atual });
      toast.success("Meta criada!");
      setNome(""); setValor(""); setPrazo(""); setAtual("");
      onDone();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui criar a meta.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova meta</DialogTitle>
          <DialogDescription>Para o que quer poupar e até quando?</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5"><Label htmlFor="g-nome">Nome</Label><Input id="g-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Férias" maxLength={60} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label htmlFor="g-valor">Valor (€)</Label><Input id="g-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="2000" required /></div>
            <div className="grid gap-1.5"><Label htmlFor="g-prazo">Prazo</Label><Input id="g-prazo" type="date" min={todayLocal()} value={prazo} onChange={(e) => setPrazo(e.target.value)} required /></div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="g-atual">Já tem poupado (opcional)</Label><Input id="g-atual" inputMode="decimal" value={atual} onChange={(e) => setAtual(e.target.value)} placeholder="0" /></div>
          <DialogFooter><Button type="submit" disabled={saving}>{saving ? "A criar…" : "Criar meta"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddMoneyDialog({ goal, onClose, onDone }: { goal: Goal | null; onClose: () => void; onDone: () => void }) {
  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal) return;
    const v = parseAmount(valor);
    if (Number.isNaN(v) || v <= 0) { toast.error("Indique um valor maior que zero."); return; }
    setSaving(true);
    try {
      await addToGoal(goal.id, Number(goal.valor_atual), v);
      toast.success(`Adicionado à meta ${goal.nome}.`);
      setValor("");
      onDone();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui atualizar a meta.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={!!goal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar dinheiro</DialogTitle>
          <DialogDescription>Quanto vai pôr de lado para {goal?.nome}?</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5"><Label htmlFor="a-valor">Valor (€)</Label><Input id="a-valor" inputMode="decimal" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} placeholder="50" required /></div>
          <DialogFooter><Button type="submit" disabled={saving}>{saving ? "A guardar…" : "Adicionar"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Metas() {
  const { data: profile } = useSuspenseQuery(profileQuery);
  const { data: goals } = useSuspenseQuery(goalsQuery);
  const qc = useQueryClient();
  const moeda = profile?.moeda ?? "EUR";
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState<Goal | null>(null);
  const [removing, setRemoving] = useState<Goal | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: goalsQuery.queryKey });

  async function confirmDelete() {
    if (!removing) return;
    try {
      await deleteGoal(removing.id);
      toast.success("Meta apagada.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui apagar a meta.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Metas"
        subtitle="O que está a construir"
        settings
        action={goals.length > 0 ? <Button size="sm" onClick={() => setCreating(true)}><Plus /> Nova</Button> : undefined}
      />
      <Section className="mt-3">
        {goals.length === 0 ? (
          <EmptyState
            title="Ainda sem metas"
            text='Crie aqui a sua primeira meta, ou diga à Fina, por exemplo, "Quero poupar 2000€ para férias até agosto".'
            cta={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setCreating(true)}><Plus /> Criar meta</Button>
                <Button asChild variant="outline"><Link to="/chat" search={{ q: "Quero criar uma meta para " }}>Pedir à Fina</Link></Button>
              </div>
            }
          />
        ) : (
          <div className="grid gap-3">
            {goals.map((g) => {
              const p = goalProgress(g);
              return (
                <Card key={g.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-lg font-semibold">{g.nome}</p>
                    <span className="font-bold text-primary tabular">{p.percent}%</span>
                  </div>
                  <Progress value={p.percent} className="mt-3 h-2.5" />
                  <p className="mt-2 text-sm text-muted-foreground"><Money value={p.atual} moeda={moeda} /> de <Money value={p.alvo} moeda={moeda} /> · prazo {fmt(g.prazo)}</p>
                  {p.falta > 0 ? (
                    <p className="mt-1 text-sm">Poupe cerca de <Money value={p.poupancaMensal} moeda={moeda} className="font-semibold" /> por mês para chegar a tempo.</p>
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-income">Meta alcançada! 🎉</p>
                  )}
                  <div className="mt-4 flex gap-2">
                    {p.falta > 0 && <Button size="sm" variant="secondary" onClick={() => setAdding(g)}><Plus /> Adicionar dinheiro</Button>}
                    <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" onClick={() => setRemoving(g)} aria-label={`Apagar meta ${g.nome}`}><Trash2 /></Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      <NewGoalDialog open={creating} onOpenChange={setCreating} onDone={refresh} />
      <AddMoneyDialog goal={adding} onClose={() => setAdding(null)} onDone={refresh} />
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar a meta {removing?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>O progresso desta meta deixa de aparecer. Isto não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
