import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Deal } from "@/lib/deals-store";
import { usd } from "@/lib/finance";
import { ACCEPT, readForAI } from "@/lib/files";
import { extractFinancials } from "@/lib/ai.functions";
import { useWorkspace } from "@/lib/workspace";

type Extract = Awaited<ReturnType<typeof extractFinancials>>;

export function UploadPanel({ deal, set }: { deal: Deal; set: (p: Partial<Deal>) => void }) {
  const extract = useServerFn(extractFinancials);
  const { user } = useWorkspace();
  const [busy, setBusy] = useState<"om" | "t12" | null>(null);
  const [result, setResult] = useState<{ kind: "om" | "t12"; name: string; data: Extract } | null>(null);

  const onFile = async (kind: "om" | "t12", file: File | undefined) => {
    if (!file) return;
    setBusy(kind);
    try {
      const path = `${deal.firmId}/${deal.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const up = await supabase.storage.from("deal-files").upload(path, file);
      if (up.error) throw up.error;
      const { error: metadataError } = await supabase.from("deal_files").insert({ deal_id: deal.id, kind, name: file.name, path });
      if (metadataError) { await supabase.storage.from("deal-files").remove([path]); throw metadataError; }
      const data = await extract({ data: { ...(await readForAI(file)), kind } });
      setResult({ kind, name: file.name, data });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that file");
    }
    setBusy(null);
    void user;
  };

  const apply = () => {
    if (!result) return;
    const col = result.kind === "om" ? "broker" : "t12";
    const lines = deal.lines.map((l) => ({ ...l, [col]: result.data.values[l.key] ?? l[col], ...(result.kind === "t12" && !l.underwrite ? { underwrite: result.data.values[l.key] ?? 0 } : {}) }));
    const a = { ...deal.assumptions };
    if (result.data.units) a.units = result.data.units;
    if (result.data.price && result.kind === "om") a.price = result.data.price;
    set({ lines, assumptions: a });
    toast.success(`${result.kind === "om" ? "Broker OM" : "T-12"} column filled`);
    setResult(null);
  };

  return (
    <div className="rounded-md border bg-card p-5">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Fill from documents</div>
      <div className="mt-3 grid gap-2">
        {(["om", "t12"] as const).map((k) => (
          <label key={k} className={`flex cursor-pointer items-center justify-between rounded border border-dashed px-3 py-2.5 text-sm hover:border-primary ${busy === k ? "opacity-60" : ""}`}>
            <span>{busy === k ? "Reading…" : k === "om" ? "Upload broker OM" : "Upload T-12"}</span>
            <span className="text-xs text-muted-foreground">Choose file</span>
            <input type="file" accept={ACCEPT} className="hidden" disabled={!!busy} onChange={(e) => { onFile(k, e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        ))}
      </div>
      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-2xl font-normal">What we found in {result?.name}</DialogTitle></DialogHeader>
          {result && (
            <div className="text-sm">
              <table className="w-full">
                <tbody>
                  {deal.lines.map((l) => (
                    <tr key={l.key} className="border-b last:border-0">
                      <td className="py-1.5">{l.label}</td>
                      <td className="num py-1.5 text-right text-muted-foreground">{usd(result.kind === "om" ? l.broker : l.t12)}</td>
                      <td className="num py-1.5 pl-4 text-right font-medium">{usd(result.data.values[l.key] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 text-xs text-muted-foreground">
                {result.data.units ? `Units: ${result.data.units}. ` : ""}{result.data.price ? `Price: ${usd(result.data.price)}. ` : ""}{result.data.notes}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setResult(null)}>Discard</Button>
                <Button onClick={apply}>Fill the {result.kind === "om" ? "Broker OM" : "T-12"} column</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { ShareDialog } from "./deal-room";
