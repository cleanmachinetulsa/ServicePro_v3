import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiToolPill } from "@/components/AiToolPill";

interface DemoStep {
  sender: "customer" | "ai";
  text: string;
  toolCalls?: string[];
  delayMs?: number;
}
interface DemoPayload {
  tenantId: string;
  tenantName: string;
  bannerText: string;
  script: DemoStep[];
}

export default function DemoModePage() {
  const params = useParams<{ tenant?: string }>();
  const slug = params.tenant || "";
  const [payload, setPayload] = useState<DemoPayload | null>(null);
  const [shown, setShown] = useState<DemoStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    fetch(`/api/public/demo/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((p: DemoPayload) => { if (!cancelledRef.current) setPayload(p); })
      .catch((e) => { if (!cancelledRef.current) setError(String(e.message || e)); });
    return () => { cancelledRef.current = true; };
  }, [slug]);

  useEffect(() => {
    if (!payload) return;
    setShown([]);
    let cancelled = false;
    (async () => {
      for (const step of payload.script) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, step.delayMs ?? 900));
        if (cancelled) return;
        setShown((prev) => [...prev, step]);
      }
    })();
    return () => { cancelled = true; };
  }, [payload]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <div className="container mx-auto max-w-xl p-4">
        {payload && (
          <div className="mb-3 rounded-md bg-indigo-100 border border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-800 text-center" data-testid="demo-banner">
            {payload.bannerText}
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle>{payload?.tenantName ?? "Demo"} · Live replay</CardTitle>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="space-y-2" data-testid="demo-script">
              {shown.map((step, i) => (
                <div
                  key={i}
                  className={`flex ${step.sender === "customer" ? "justify-end" : "justify-start"}`}
                  data-testid={`demo-step-${i}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      step.sender === "customer"
                        ? "bg-indigo-600 text-white rounded-br-sm"
                        : "bg-gray-100 text-gray-900 rounded-bl-sm"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{step.text}</div>
                    {step.sender === "ai" && step.toolCalls && step.toolCalls.length > 0 && (
                      <div className="mt-1"><AiToolPill toolNames={step.toolCalls} compact /></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
