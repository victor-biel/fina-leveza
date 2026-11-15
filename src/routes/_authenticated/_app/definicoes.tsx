import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { LogOut, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, PageHeader, Section } from "@/components/app/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, parseAmount } from "@/lib/finance";
import { updateProfile } from "@/lib/mutations";
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
  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState("");
  const [receita, setReceita] = useState("");
  const [objetivos, setObjetivos] = useState("");
  const [partilha, setPartilha] = useState("");
  const [notificacoes, setNotificacoes] = useState(false);
  const [saving, setSaving] = useState(false);

  function openEdit() {
    setNome(profile?.nome ?? "");
    setReceita(profile?.receita_mensal != null ? String(Number(profile.receita_mensal)) : "");
    setObjetivos(profile?.objetivos ?? "");
    setPartilha(profile?.partilha ?? "");
    setNotificacoes(!!profile?.notificacoes);
    setEditing(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!nome.trim()) { toast.error("Diga-me como gostaria de ser tratado."); return; }
    const r = receita.trim() ? parseAmount(receita) : null;
    if (r != null && Number.isNaN(r)) { toast.error("Escreva a receita só com números, por exemplo 1500."); return; }
    setSaving(true);
    try {
      await updateProfile(profile.id, {
        nome: nome.trim(),
        receita_mensal: r,
        objetivos: objetivos.trim() || null,
        partilha: partilha.trim() || null,
        notificacoes,
      });
      await qc.invalidateQueries({ queryKey: profileQuery.queryKey });
      toast.success("Perfil atualizado.");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não consegui guardar as alterações.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const rows: [string, string][] = [
    ["Nome", profile?.nome ?? "—"],
    ["Email", profile?.email ?? "—"],
    ["Receita mensal", profile?.receita_mensal != null ? formatMoney(Number(profile.receita_mensal), profile.moeda ?? "EUR") : "—"],
    ["Objetivos", profile?.objetivos ?? "—"],
    ["Partilha com", profile?.partilha ?? "—"],
    ["Lembretes", profile?.notificacoes ? "Sim" : "Não"],
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Definições" action={<Button size="sm" variant="secondary" onClick={openEdit}><Pencil /> Editar</Button>} />
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

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
            <DialogDescription>A Fina usa estes dados para lhe dar dicas mais certeiras.</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="grid gap-4">
            <div className="grid gap-1.5"><Label htmlFor="p-nome">Como quer ser tratado</Label><Input id="p-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} required /></div>
            <div className="grid gap-1.5"><Label htmlFor="p-receita">Receita mensal (€)</Label><Input id="p-receita" inputMode="decimal" value={receita} onChange={(e) => setReceita(e.target.value)} placeholder="1500" /></div>
            <div className="grid gap-1.5"><Label htmlFor="p-obj">Objetivos</Label><Input id="p-obj" value={objetivos} onChange={(e) => setObjetivos(e.target.value)} placeholder="Férias, fundo de emergência" maxLength={300} /></div>
            <div className="grid gap-1.5"><Label htmlFor="p-part">Partilha despesas com</Label><Input id="p-part" value={partilha} onChange={(e) => setPartilha(e.target.value)} placeholder="Ana, Rui" maxLength={300} /></div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border p-3">
              <Label htmlFor="p-notif">Receber lembretes e dicas</Label>
              <Switch id="p-notif" checked={notificacoes} onCheckedChange={setNotificacoes} />
            </div>
            <DialogFooter><Button type="submit" disabled={saving}>{saving ? "A guardar…" : "Guardar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
