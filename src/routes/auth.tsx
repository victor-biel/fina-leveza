import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import "@lovable.dev/cloud-auth-js/styles.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FinaLogo } from "@/components/app/brand";
import { GoogleButton } from "@/components/app/google-button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Entrar — Fina" },
      {
        name: "description",
        content: "Entre ou crie a sua conta na Fina, o seu assistente financeiro.",
      },
      { property: "og:title", content: "Entrar — Fina" },
      { property: "og:description", content: "Entre ou crie a sua conta na Fina." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safePath(p?: string) {
  if (!p) return "/inicio";
  try {
    const u = new URL(p, window.location.origin);
    if (u.origin !== window.location.origin) return "/inicio";
    return u.pathname + u.search;
  } catch {
    return "/inicio";
  }
}

type Mode = "entrar" | "criar" | "recuperar";

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: safePath(redirect), replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((e, session) => {
      if (e === "SIGNED_IN" && session) navigate({ to: safePath(redirect), replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "criar") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/inicio", data: { nome } },
        });
        if (error) throw error;
        if (!data.session)
          setSent("Enviámos um email de confirmação. Abra-o para ativar a sua conta.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent(
          "Se existir uma conta com este email, receberá um link para definir uma nova palavra-passe.",
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(
        msg.includes("Invalid login")
          ? "Email ou palavra-passe incorretos."
          : msg.includes("already registered")
            ? "Este email já tem conta. Experimente entrar."
            : msg || "Algo correu mal. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function oauth(provider: "google" | "lovable") {
    try {
      if (provider === "google") {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        return;
      }

      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/auth`,
      });
      if (result.error) throw result.error;
    } catch {
      toast.error(
        "Não foi possível iniciar o login com Google. Verifique a configuração OAuth e tente novamente.",
      );
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-soft">
      <header className="mx-auto w-full max-w-md px-5 py-6">
        <Link to="/">
          <FinaLogo />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-10">
        <div className="animate-rise rounded-3xl bg-card p-6 shadow-soft">
          <h1 className="text-2xl font-bold text-foreground">
            {mode === "entrar"
              ? "Bem-vindo de volta"
              : mode === "criar"
                ? "Criar a sua conta"
                : "Recuperar acesso"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "recuperar"
              ? "Indique o seu email e enviamos um link."
              : "Leva menos de um minuto."}
          </p>

          {sent ? (
            <div className="mt-6 rounded-2xl bg-accent p-4 text-sm text-accent-foreground">
              {sent}
            </div>
          ) : (
            <>
              {mode !== "recuperar" && (
                <div className="mt-6 space-y-3">
                  <GoogleButton onClick={() => oauth("google")} />
                  <button
                    type="button"
                    className="lovable-auth-button w-full"
                    onClick={() => oauth("lovable")}
                  >
                    Continue with Lovable
                  </button>
                  <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" /> ou com email{" "}
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </div>
              )}
              <form onSubmit={submit} className="mt-4 space-y-4">
                {mode === "criar" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="nome">Como se chama?</Label>
                    <Input
                      id="nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="O seu nome"
                      className="h-11 rounded-xl"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@exemplo.pt"
                    className="h-11 rounded-xl"
                  />
                </div>
                {mode !== "recuperar" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Palavra-passe</Label>
                      {mode === "entrar" && (
                        <button
                          type="button"
                          className="text-xs font-medium text-sky hover:underline"
                          onClick={() => setMode("recuperar")}
                        >
                          Esqueceu-se?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      autoComplete={mode === "criar" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                )}
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" />}
                  {mode === "entrar" ? "Entrar" : mode === "criar" ? "Criar conta" : "Enviar link"}
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "entrar" ? (
              <>
                Ainda não tem conta?{" "}
                <button
                  className="font-semibold text-primary hover:underline"
                  onClick={() => {
                    setMode("criar");
                    setSent(null);
                  }}
                >
                  Criar conta
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button
                  className="font-semibold text-primary hover:underline"
                  onClick={() => {
                    setMode("entrar");
                    setSent(null);
                  }}
                >
                  Entrar
                </button>
              </>
            )}
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Os seus dados estão protegidos e são só seus.
        </p>
      </main>
    </div>
  );
}
