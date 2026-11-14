import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { BottomNav, SideNav } from "@/components/app/app-nav";
import { profileQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app")({
  beforeLoad: async ({ context }) => {
    const profile = await context.queryClient.ensureQueryData(profileQuery);
    if (!profile?.onboarded) throw redirect({ to: "/onboarding" });
  },
  component: AppShell,
});

function AppShell() {
  const { pathname } = useLocation();
  const isChat = pathname.startsWith("/chat");
  return (
    <div className="flex min-h-screen bg-background">
      <SideNav />
      <div className={cn("min-w-0 flex-1", !isChat && "pb-28 lg:pb-10")}>
        <Outlet />
      </div>
      {!isChat && <BottomNav />}
    </div>
  );
}
