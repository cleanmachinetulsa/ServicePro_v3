import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatusPayload {
  tenantId: string;
  tenantName: string;
  smsUptimePct: number;
  lastDeliveryAt: string | null;
  bookingLeadTimeHours: number;
  weatherRisk7d: "unknown" | "low" | "medium" | "high";
  generatedAt: string;
}

function pillColor(pct: number): string {
  if (pct >= 99) return "bg-emerald-500";
  if (pct >= 95) return "bg-amber-500";
  return "bg-red-500";
}

export default function PublicStatusPage() {
  const params = useParams<{ slug?: string }>();
  // Audit T3 Task #23 (review fix): pass the FULL host so the backend can
  // resolve via exact custom-domain match, not a brittle subdomain split.
  const fullHost =
    typeof window !== "undefined" ? window.location.host.toLowerCase() : "";
  const slug = params.slug || fullHost;
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const url = `/api/public/status/${encodeURIComponent(slug)}${
      fullHost && fullHost !== slug ? `?host=${encodeURIComponent(fullHost)}` : `?host=${encodeURIComponent(fullHost)}`
    }`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((p) => { if (!cancelled) setData(p); })
      .catch((e) => { if (!cancelled) setError(String(e.message || e)); });
    return () => { cancelled = true; };
  }, [slug, fullHost]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto max-w-2xl p-6">
        <Card data-testid="public-status-card">
          <CardHeader>
            <CardTitle>{data?.tenantName ?? "Service status"}</CardTitle>
            <p className="text-sm text-muted-foreground">Live operational status — refreshes every minute.</p>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-red-600" data-testid="status-error">{error}</p>}
            {!data && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
            {data && (
              <ul className="divide-y">
                <li className="flex items-center justify-between py-3">
                  <span>SMS delivery (last 24h)</span>
                  <span className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${pillColor(data.smsUptimePct)}`} />
                    <span className="font-semibold">{data.smsUptimePct}%</span>
                  </span>
                </li>
                <li className="flex items-center justify-between py-3">
                  <span>Last AI message delivered</span>
                  <span className="text-sm text-muted-foreground">
                    {data.lastDeliveryAt ? new Date(data.lastDeliveryAt).toLocaleString() : "—"}
                  </span>
                </li>
                <li className="flex items-center justify-between py-3">
                  <span>Avg booking lead time</span>
                  <span className="font-semibold">{data.bookingLeadTimeHours}h</span>
                </li>
                <li className="flex items-center justify-between py-3">
                  <span>7-day weather risk</span>
                  <span className="capitalize text-sm">{data.weatherRisk7d}</span>
                </li>
              </ul>
            )}
            {data && (
              <p className="text-xs text-muted-foreground mt-4">
                Updated {new Date(data.generatedAt).toLocaleTimeString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
