import { Link } from "@tanstack/react-router";
import {
  ShoppingCart, Utensils, Home, Receipt, Car, HeartPulse, Gamepad2, ShoppingBag, GraduationCap, Repeat, Circle,
  Briefcase, Laptop, TrendingUp, Gift, Coffee, Settings, type LucideIcon,
} from "lucide-react";
import { FinaMark } from "./brand";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/finance";

const ICONS: Record<string, LucideIcon> = {
  "Alimentação": Coffee,
  Supermercado: ShoppingCart,
  Restaurantes: Utensils,
  Casa: Home,
  Contas: Receipt,
  Transportes: Car,
  "Saúde": HeartPulse,
  Lazer: Gamepad2,
  Compras: ShoppingBag,
  "Educação": GraduationCap,
  "Subscrições": Repeat,
  "Salário": Briefcase,
  Freelance: Laptop,
  Investimentos: TrendingUp,
  Presentes: Gift,
};

export function CategoryIcon({ categoria, tipo, className }: { categoria: string; tipo?: string; className?: string }) {
  const Icon = ICONS[categoria] ?? Circle;
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tipo === "receita" ? "bg-income-soft text-income" : "bg-accent text-primary", className)}>
      <Icon className="size-5" />
    </span>
  );
}

export function PageHeader({ title, subtitle, action, settings }: { title: string; subtitle?: string; action?: React.ReactNode; settings?: boolean }) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pb-2 pt-6 lg:px-10 lg:pt-10">
      <div className="flex items-center gap-3">
        <FinaMark className="size-9 lg:hidden" />
        <div>
          <h1 className="text-2xl font-bold text-foreground lg:text-3xl">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {action}
        {settings && (
          <Link to="/definicoes" aria-label="Definições" className="flex size-10 items-center justify-center rounded-xl bg-card text-muted-foreground shadow-soft hover:text-foreground lg:hidden">
            <Settings className="size-5" />
          </Link>
        )}
      </div>
    </header>
  );
}

export function Section({ title, action, children, className }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("px-5 lg:px-10", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-3xl bg-card p-5 shadow-soft", className)} {...props} />;
}

export function Money({ value, moeda, className, sign }: { value: number; moeda?: string; className?: string; sign?: "+" | "-" }) {
  return (
    <span className={cn("tabular", className)}>
      {sign}
      {formatMoney(value, moeda)}
    </span>
  );
}

export function EmptyState({ title, text, cta }: { title: string; text: string; cta?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed bg-card/60 px-6 py-10 text-center">
      <FinaMark className="size-12 opacity-90" />
      <p className="mt-3 font-display text-lg font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{text}</p>
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}

export function TxRow({ tx, moeda, share }: { tx: { id: string; tipo: string; valor: number; categoria: string; descricao: string | null; data: string }; moeda?: string; share?: number }) {
  const d = new Date(tx.data + "T12:00:00");
  return (
    <li className="flex items-center gap-3 py-3">
      <CategoryIcon categoria={tx.categoria} tipo={tx.tipo} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{tx.descricao || tx.categoria}</p>
        <p className="text-xs text-muted-foreground">
          {tx.categoria} · {new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short" }).format(d)}
          {share != null && share !== tx.valor && <> · a sua parte {formatMoney(share, moeda)}</>}
        </p>
      </div>
      <Money value={tx.valor} moeda={moeda} sign={tx.tipo === "receita" ? "+" : "-"} className={cn("text-sm font-semibold", tx.tipo === "receita" ? "text-income" : "text-foreground")} />
    </li>
  );
}
