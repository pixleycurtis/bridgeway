import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Keystone" },
      { name: "description", content: "Sign in with your work email to open your firm's Keystone workspace." },
      { property: "og:title", content: "Sign in — Keystone" },
      { property: "og:description", content: "Sign in with your work email to open your firm's Keystone workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) nav({ to: "/" }); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (s) nav({ to: "/" }); });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (mode === "up") setSent(true);
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error(r.error.message ?? "Google sign-in failed");
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground md:flex">
        <div className="font-display text-3xl text-sidebar-accent-foreground">Keystone</div>
        <div>
          <p className="font-display text-4xl leading-tight text-sidebar-accent-foreground">Every deliverable a buyer sends, written from the numbers.</p>
          <p className="mt-4 max-w-md text-sm text-sidebar-foreground/70">Reconcile the broker's pitch against the books, underwrite as a team, and send lenders and sellers documents on your own letterhead.</p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">Sign in with your work email and you'll land in your firm's workspace.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use your work email — colleagues at the same company share one workspace.</p>
          {sent ? (
            <div className="mt-6 rounded-md border bg-card p-4 text-sm">Check <b>{email}</b> for a confirmation link, then come back and sign in.</div>
          ) : (
            <>
              <Button variant="outline" className="mt-6 w-full" onClick={google}>Continue with Google</Button>
              <div className="my-4 text-center text-xs text-muted-foreground">or</div>
              <form onSubmit={submit} className="space-y-3">
                <Input type="email" required placeholder="you@yourfirm.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input type="password" required minLength={8} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button type="submit" className="w-full" disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</Button>
              </form>
              <button className="mt-4 text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
                {mode === "in" ? "New to Keystone? Create an account" : "Already have an account? Sign in"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
