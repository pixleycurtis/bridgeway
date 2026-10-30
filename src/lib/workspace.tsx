import type React from "react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { readSettings, type FirmSettings } from "./firm-settings";

export type Firm = Database["public"]["Tables"]["firms"]["Row"];
export type Member = Database["public"]["Tables"]["firm_members"]["Row"];
export type FirmRole = Database["public"]["Enums"]["firm_role"];

export const ROLE_LABELS: Record<FirmRole, string> = {
  admin: "Admin",
  analyst: "Analyst",
  broker: "Broker",
  property_manager: "Property manager",
  legal: "Legal counsel",
};

interface Ctx {
  user: User;
  firm: Firm | null;
  me: Member | null;
  logoUrl: string | null;
  isAdmin: boolean;
  settings: FirmSettings;
  justCreated: boolean;
  refreshFirm: () => Promise<void>;
  signOut: () => Promise<void>;
}
const g = globalThis as unknown as { __bridgewayWsCtx?: React.Context<Ctx | null> };
const WsCtx = (g.__bridgewayWsCtx ??= createContext<Ctx | null>(null));

export async function signedLogo(path: string | null) {
  if (!path) return null;
  const { data } = await supabase.storage.from("firm-assets").createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl ?? null;
}

export function WorkspaceProvider({ user, children }: { user: User; children: ReactNode }) {
  const [firm, setFirm] = useState<Firm | null>(null);
  const [me, setMe] = useState<Member | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFirm = useCallback(async () => {
    const { data: m } = await supabase.from("firm_members").select("*").eq("user_id", user.id).maybeSingle();
    setMe(m);
    if (!m) return;
    const { data: f } = await supabase.from("firms").select("*").eq("id", m.firm_id).maybeSingle();
    setFirm(f);
    setLogoUrl(await signedLogo(f?.logo_path ?? null));
  }, [user.id]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("ensure_membership");
      if (error) { setError(error.message); return; }
      if ((data as { party_only?: boolean } | null)?.party_only) { window.location.replace("/work"); return; }
      setJustCreated(Boolean((data as { created?: boolean } | null)?.created));
      await refreshFirm();
      setReady(true);
    })();
  }, [refreshFirm]);

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = "/auth"; };

  if (error) return <div className="p-10 text-sm text-destructive">Couldn't open your workspace: {error}</div>;
  if (!ready) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Opening your workspace…</div>;

  const brand = firm?.brand_color || undefined;
  return (
    <WsCtx.Provider value={{ user, firm, me, logoUrl, isAdmin: me?.role === "admin", settings: readSettings(firm?.settings), justCreated, refreshFirm, signOut }}>
      <div style={brand ? ({ "--primary": brand, "--ring": brand, "--chart-1": brand } as React.CSSProperties) : undefined}>
        {children}
      </div>
    </WsCtx.Provider>
  );
}

export function useWorkspace() {
  const c = useContext(WsCtx);
  if (!c) throw new Error("useWorkspace outside provider");
  return c;
}
