import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FinaLogo } from "@/components/app/brand";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova palavra-passe — Fina" },
      { name: "description", content: "Defina uma nova palavra-passe para a sua conta Fina." },
      { property: "og:title", content: "Nova palavra-passe — Fina" },
      { property: "og:description", content: "Defina uma nova palavra-passe para a sua conta Fina." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setReady(true);
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => data.session && setReady(true));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível atualizar. O link pode ter expirado.");
      return;
    }
    toast.success("Palavra-passe atualizada!");
    navigate({ to: "/inicio", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-soft px-5 py-8">
      <FinaLogo className="mb-8" />
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-soft">
        <h1 className="text-2xl font-bold">Nova palavra-passe</h1>
        {ready ? (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw">Escolha uma palavra-passe</Label>
              <Input id="pw" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>Guardar</Button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Abra esta página através do link que enviámos para o seu email.</p>
        )}
      </div>
    </div>
  );
}
