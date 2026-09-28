import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSharedFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ dealId: z.string().uuid(), path: z.string().min(1).max(1024) }).parse(input))
  .handler(async ({ data, context }) => {
    // Both checks run as the viewer. Never sign an arbitrary path supplied by the browser.
    const { data: deal, error: dealError } = await context.supabase.from("deals").select("id, firm_id").eq("id", data.dealId).maybeSingle();
    if (dealError || !deal) throw new Error("You do not have access to this deal");
    if (!data.path.startsWith(`${deal.firm_id}/${deal.id}/`)) throw new Error("File not available to you");
    const { data: file, error: fileError } = await context.supabase.from("deal_files")
      .select("id").eq("deal_id", data.dealId).eq("path", data.path).maybeSingle();
    if (fileError) throw new Error("File not available to you");
    if (!file) {
      // Older uploads were attached to a request without a metadata row.
      const { data: request, error: requestError } = await context.supabase.from("deal_dd_items")
        .select("id").eq("deal_id", data.dealId).eq("file_path", data.path).maybeSingle();
      if (requestError || !request) throw new Error("File not available to you");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signError } = await supabaseAdmin.storage.from("deal-files").createSignedUrl(data.path, 3600);
    if (signError || !signed?.signedUrl) throw new Error("Could not open this file");
    return { url: signed.signedUrl };
  });