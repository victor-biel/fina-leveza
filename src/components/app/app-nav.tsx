import { Link } from "@tanstack/react-router";
import { Home, MessageCircle, PieChart, Target, Users, Settings } from "lucide-react";
import { FinaLogo } from "./brand";
import { cn } from "@/lib/utils";

const items = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/painel", label: "Painel", icon: PieChart },
  { to: "/chat", label: "Fina", icon: MessageCircle, primary: true },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/partilhas", label: "Partilhas", icon: Users },
] as const;

export function BottomNav() {
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur safe-bottom lg:hidden">
      <ul className="mx-auto flex max-w-lg items-end justify-around px-2 pt-1.5">
        {items.map(({ to, label, icon: Icon, ...rest }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="group flex flex-col items-center gap-1 py-1 text-[11px] font-medium text-muted-foreground"
              activeProps={{ className: "text-primary", "aria-current": "page" }}
            >
              {"primary" in rest ? (
                <span className="-mt-6 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lift transition-transform group-active:scale-95">
                  <Icon className="size-6" />
                </span>
              ) : (
                <Icon className="size-[22px]" />
              )}
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SideNav() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card px-4 py-6 lg:flex">
      <Link to="/inicio" className="px-2"><FinaLogo /></Link>
      <ul className="mt-8 space-y-1">
        {[...items, { to: "/definicoes", label: "Definições", icon: Settings }].map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground")}
              activeProps={{ className: "bg-accent text-primary", "aria-current": "page" }}
            >
              <Icon className="size-5" />
              {label === "Fina" ? "Falar com a Fina" : label}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
