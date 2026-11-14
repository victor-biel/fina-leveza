import logo from "@/assets/fina-logo.png";
import { cn } from "@/lib/utils";

export function FinaMark({ className }: { className?: string }) {
  return <img src={logo} alt="" width={440} height={440} className={cn("size-9 select-none", className)} />;
}

export function FinaLogo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <FinaMark className="size-8" />
      <span className={cn("font-display text-xl font-bold tracking-tight", light ? "text-primary-foreground" : "text-primary")}>Fina</span>
    </span>
  );
}
