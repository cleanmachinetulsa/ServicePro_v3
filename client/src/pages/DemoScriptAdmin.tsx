import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface DemoStep {
  sender: "customer" | "ai";
  text: string;
  toolCalls?: string[];
  delayMs?: number;
}

interface LoadResponse {
  script: DemoStep[];
  isCustomized: boolean;
  defaultScript: DemoStep[];
}

export default function DemoScriptAdminPage() {
  const { toast } = useToast();
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCustomized, setIsCustomized] = useState(false);
  const [defaultScript, setDefaultScript] = useState<DemoStep[]>([]);

  useEffect(() => {
    fetch("/api/admin/demo-script", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: LoadResponse) => {
        setRaw(JSON.stringify(d.script, null, 2));
        setIsCustomized(d.isCustomized);
        setDefaultScript(d.defaultScript);
      })
      .catch((e) => toast({ title: "Failed to load demo script", description: String(e.message || e), variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  async function save() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      toast({ title: "Invalid JSON", description: String((e as Error).message), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/demo-script", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: parsed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const d = await res.json();
      setIsCustomized(!!d.isCustomized);
      toast({ title: "Demo script saved" });
    } catch (e) {
      toast({ title: "Save failed", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefault() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/demo-script", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRaw(JSON.stringify(defaultScript, null, 2));
      setIsCustomized(false);
      toast({ title: "Reset to default demo script" });
    } catch (e) {
      toast({ title: "Reset failed", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-3xl p-4">
      <Card>
        <CardHeader>
          <CardTitle>Demo script editor</CardTitle>
          <p className="text-sm text-muted-foreground">
            This script powers your public /demo/&lt;tenant&gt; page. Each step has a sender
            (<code>customer</code> or <code>ai</code>), <code>text</code>, optional
            <code> toolCalls</code> array, and optional <code>delayMs</code>.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">
                {isCustomized ? "Currently using your custom script." : "Currently using the default platform script."}
              </div>
              <Textarea
                data-testid="demo-script-editor"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={22}
                className="font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button onClick={save} disabled={saving} data-testid="demo-script-save">
                  {saving ? "Saving…" : "Save script"}
                </Button>
                <Button variant="outline" onClick={resetToDefault} disabled={saving} data-testid="demo-script-reset">
                  Reset to default
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
