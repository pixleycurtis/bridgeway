import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
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
