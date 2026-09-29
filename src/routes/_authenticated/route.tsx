import { createFileRoute, Outlet, redirect, useMatches } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceProvider } from "@/lib/workspace";
import { DealsProvider } from "@/lib/deals-store";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const { user } = Route.useRouteContext();
  // Decide from the rendered matches (not the URL), so the layout and the page
  // below it always agree — even mid-navigation between /work and firm pages.
  const isWork = useMatches({ select: (ms) => ms.some((m) => m.routeId.startsWith("/_authenticated/work")) });
  // Outside parties' pages run without a firm workspace.
  if (isWork) return <Outlet />;
  return (
    <WorkspaceProvider user={user}>
      <DealsProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </DealsProvider>
    </WorkspaceProvider>
  );
}
