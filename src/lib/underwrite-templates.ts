import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Model } from "./model/types";
import { useWorkspace } from "./workspace";

export interface UwTemplate { id: string; name: string; modelType: string; config: Model }

/** Firm-wide underwriting templates. */
export function useTemplates() {
  const { firm, user } = useWorkspace();
  const [templates, setTemplates] = useState<UwTemplate[]>([]);
  const reload = useCallback(async () => {
    const { data, error } = await supabase.from("underwrite_templates").select("id, name, model_type, config").order("name");
    if (error) { toast.error(error.message); return; }
    setTemplates((data ?? []).map((r) => ({ id: r.id, name: r.name, modelType: r.model_type, config: r.config as unknown as Model })));
  }, []);
  useEffect(() => { void reload(); }, [reload, firm?.id]);
  const save = async (name: string, modelType: string, config: Model) => {
    if (!firm) return;
    const { error } = await supabase.from("underwrite_templates").insert({ firm_id: firm.id, created_by: user.id, name, model_type: modelType, config: config as never });
    if (error) { toast.error(error.message); return; }
    toast.success(`Template "${name}" saved for your firm`);
    await reload();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("underwrite_templates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setTemplates((ts) => ts.filter((t) => t.id !== id));
  };
  return { templates, save, remove, reload };
}
