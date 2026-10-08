import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askDeal } from "@/lib/ai.functions";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What are the biggest risks in this deal right now?",
  "Where is my underwriting most aggressive vs the T-12?",
  "What's still missing before I can close?",
  "Summarize this deal for my investment committee in three sentences.",
];

/** Per-deal Q&A chat with Claude, grounded in the deal's live numbers, findings and checklists. Session-only history. */
export function DealAsk({ dealId }: { dealId: string }) {
  const ask = useServerFn(askDeal);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: q }]);
    try {
      const { answer } = await ask({ data: { dealId, question: q, history: messages.slice(-10) } });
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The assistant couldn't answer");
      setMessages((m) => m.slice(0, -1));
      setInput(q);
    } finally {
      setBusy(false);
      taRef.current?.focus();
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="font-display text-2xl">Ask about this deal</h2>
      <p className="mt-1 text-sm text-muted-foreground">Answers come from this deal's live numbers, findings, and checklists. Nothing is saved.</p>

      <div className="mt-6 space-y-4">
        {messages.length === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => void send(s)}
                className="rounded-lg border bg-card p-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user"
              ? "max-w-[85%] whitespace-pre-wrap rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground"
              : "max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed"}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-muted-foreground">Thinking…</p>}
      </div>

      <form className="mt-6 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <Textarea ref={taRef} value={input} onChange={(e) => setInput(e.target.value)} autoFocus
          placeholder="Ask anything about this deal…" rows={2} className="min-h-0 flex-1"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }} />
        <Button type="submit" disabled={busy || !input.trim()}>Ask</Button>
      </form>
    </div>
  );
}
