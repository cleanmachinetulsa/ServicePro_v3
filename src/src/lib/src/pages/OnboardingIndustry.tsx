// src/pages/OnboardingIndustry.tsx

import React, { useState } from "react";
import IndustrySelectionStep from "../components/onboarding/IndustrySelectionStep";
import {
  buildIndustryConfig,
  saveIndustryConfigToServer,
  type NormalizedIndustryConfig
} from "../lib/industryConfig";

// ---------- PHASE 2: AUTO-FILL SERVICES + AI PROFILE ---------- //

/**
 * This describes the shape of service records you will create
 * in your DB from the industry config.
 *
 * You can adapt the field names to match your actual schema.
 */
export type ServiceBootstrapRecord = {
  tenantId: string;
  externalId: string; // comes from industry config service id
  name: string;
  description: string;
  isUpsell: boolean;
  isPremium: boolean;
  basePriceHint?: string;
  defaultDurationMinutes?: number;
  categoryTag: string; // e.g. "service" | "add_on"
  active: boolean;
};

/**
 * AI bootstrap payload: this can be stored as the initial
 * "AI profile" for the tenant (system prompt + style notes).
 */
export type AiBootstrapPayload = {
  tenantId: string;
  systemPrompt: string;
  styleNotes: {
    smsTone: string;
    emailTone: string;
  };
  industryMetadata: {
    industryId: string;
    industryLabel: string;
    category: string;
    featureIds: string[];
  };
};

/**
 * Build service records from the normalized industry config.
 * This is exactly what you'd insert into your Services table
 * when a new tenant completes onboarding.
 */
function buildServiceBootstrapPayload(
  tenantId: string,
  config: NormalizedIndustryConfig
): ServiceBootstrapRecord[] {
  return config.services.map((svc) => {
    const isUpsell = svc.kind === "upsell";

    return {
      tenantId,
      externalId: svc.id,
      name: svc.label,
      description: svc.description,
      isUpsell,
      isPremium: !!svc.isPremium,
      basePriceHint: svc.basePriceHint,
      defaultDurationMinutes: svc.defaultDurationMinutes,
      categoryTag: isUpsell ? "add_on" : "service",
      active: true
    };
  });
}

/**
 * Build an AI profile seed from the industry config.
 * This is the "brain" the AI starts with before the user
 * customizes anything.
 */
function buildAiBootstrapPayload(
  tenantId: string,
  config: NormalizedIndustryConfig
): AiBootstrapPayload {
  const { aiPersona, industryId, industryLabel, category, featureIds } = config;

  const serviceNames = config.services
    .filter((s) => s.kind === "primary")
    .map((s) => s.label);

  const upsellNames = config.services
    .filter((s) => s.kind === "upsell")
    .map((s) => s.label);

  const systemPrompt = [
    `You are the AI assistant for a ${industryLabel} business using the ServicePro platform.`,
    `Industry category: ${category}.`,
    featureIds.length
      ? `Enabled feature groups: ${featureIds.join(", ")}.`
      : `No extra feature groups enabled.`,
    "",
    `Core services you should know about (these are the main things they sell):`,
    serviceNames.length ? `- ${serviceNames.join("\n- ")}` : "- (none defined)",
    "",
    upsellNames.length
      ? `Upsells and add-ons you may suggest when relevant (never pushy, always logical):\n- ${upsellNames.join(
          "\n- "
        )}`
      : "There are no explicit upsells defined for this account.",
    "",
    `General behavior:`,
    `- Be ${aiPersona.shortTagline.toLowerCase()}.`,
    `- Always keep messages short, clear, and helpful.`,
    `- If you need info you don’t have (dates, times, photos, vehicle details, etc.), ask concise follow-up questions.`,
    `- Use plain language, not corporate talk, and sound like a real human from a small, premium service business.`,
    "",
    `Scheduling philosophy:`,
    `- Protect the owner's time. Avoid promising impossible dates/times.`,
    `- Ask the minimum number of questions to confirm what they want.`,
    `- If you’re not sure, offer 2–3 concrete options, not a huge list.`,
    "",
    `When talking about pricing:`,
    `- Use ranges based on "typical" or "starting at" from the basePriceHint, not exact quotes (unless the system later gives you exact prices).`,
    `- Never invent new services that aren't in the list above.`
  ].join("\n");

  return {
    tenantId,
    systemPrompt,
    styleNotes: {
      smsTone: aiPersona.smsTone,
      emailTone: aiPersona.emailTone
    },
    industryMetadata: {
      industryId,
      industryLabel,
      category,
      featureIds
    }
  };
}

/**
 * Stub: this is where you will actually call your backend
 * to write the service + AI bootstrap into the DB.
 *
 * For now it only logs the payload so you can SEE what you're getting.
 */
async function saveBootstrapToServer(params: {
  tenantId: string;
  config: NormalizedIndustryConfig;
  services: ServiceBootstrapRecord[];
  aiProfile: AiBootstrapPayload;
}): Promise<void> {
  const { tenantId, config, services, aiProfile } = params;

  // 🔧 Replace this with your real API call(s), e.g.:
  // await fetch("/api/onboarding/bootstrap", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ tenantId, config, services, aiProfile })
  // });

  console.log("[Onboarding] Would bootstrap tenant from industry config:", {
    tenantId,
    config,
    services,
    aiProfile
  });
}

// ---------- PAGE COMPONENT ---------- //

const OnboardingIndustryPage: React.FC = () => {
  const [industryId, setIndustryId] = useState<string | null>(null);
  const [featureIds, setFeatureIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugConfigJson, setDebugConfigJson] = useState<string | null>(null);
  const [debugBootstrapJson, setDebugBootstrapJson] = useState<string | null>(
    null
  );

  // TODO: replace this with however you get the current tenant id in your app
  const tenantId = "demo-tenant-id";

  const handleContinue = async () => {
    setError(null);

    if (!industryId) {
      setError("Pick an industry first.");
      return;
    }

    const config = buildIndustryConfig({
      industryId,
      selectedFeatureIds: featureIds
    });

    if (!config) {
      setError("Something went wrong building the industry config.");
      return;
    }

    // Build auto-fill payloads
    const servicesPayload = buildServiceBootstrapPayload(tenantId, config);
    const aiPayload = buildAiBootstrapPayload(tenantId, config);

    // Debug: let you SEE exactly what would be saved
    setDebugConfigJson(JSON.stringify(config, null, 2));
    setDebugBootstrapJson(
      JSON.stringify(
        {
          services: servicesPayload,
          aiProfile: aiPayload
        },
        null,
        2
      )
    );

    try {
      setIsSaving(true);

      // 1) Save the core industry config
      await saveIndustryConfigToServer({ tenantId, config });

      // 2) Save the auto-fill services + AI profile
      await saveBootstrapToServer({
        tenantId,
        config,
        services: servicesPayload,
        aiProfile: aiPayload
      });

      // 3) Move to next onboarding step (TODO: hook your router here)
      // e.g. navigate("/onboarding/services");
    } catch (e: any) {
      console.error(e);
      setError("Could not save settings. Try again or check the console.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 24,
        background:
          "radial-gradient(circle at top left, rgba(0,0,0,0.04), rgba(255,255,255,1))"
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 16
        }}
      >
        <div
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 0.12,
            opacity: 0.7
          }}
        >
          Onboarding · Step 1
        </div>

        <IndustrySelectionStep
          selectedIndustryId={industryId}
          selectedFeatureIds={featureIds}
          onChange={({ industryId, selectedFeatureIds }) => {
            setIndustryId(industryId);
            setFeatureIds(selectedFeatureIds);
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 16
          }}
        >
          <div style={{ fontSize: 12.5, opacity: 0.8 }}>
            When you click <strong>Save & continue</strong>, we will:
            <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
              <li>Store this tenant’s industry + feature groups</li>
              <li>
                Auto-build service & upsell records for their Services/Packages
                page
              </li>
              <li>
                Seed an AI profile with the right tone and industry knowledge
              </li>
            </ul>
          </div>

          <button
            type="button"
            disabled={!industryId || isSaving}
            onClick={handleContinue}
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: !industryId || isSaving ? "not-allowed" : "pointer",
              opacity: !industryId || isSaving ? 0.6 : 1,
              background:
                "linear-gradient(135deg, rgba(0,122,255,1), rgba(0,180,255,1))",
              color: "#fff",
              boxShadow: "0 8px 18px rgba(0,122,255,0.35)"
            }}
          >
            {isSaving ? "Saving…" : "Save & continue"}
          </button>
        </div>

        {error && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 8,
              backgroundColor: "rgba(255,0,0,0.05)",
              border: "1px solid rgba(255,0,0,0.2)",
              fontSize: 12.5,
              color: "#b00020"
            }}
          >
            {error}
          </div>
        )}

        {/* Debug previews so you can SEE what you're getting.
            You can delete these blocks once your backend is wired. */}
        {debugConfigJson && (
          <div
            style={{
              marginTop: 16,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.1)",
              backgroundColor: "#0b1020",
              color: "#f5f7ff",
              padding: 12,
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas"
            }}
          >
            <div
              style={{
                marginBottom: 6,
                opacity: 0.8
              }}
            >
              <strong>Debug · Normalized industry config</strong>
            </div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {debugConfigJson}
            </pre>
          </div>
        )}

        {debugBootstrapJson && (
          <div
            style={{
              marginTop: 12,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.1)",
              backgroundColor: "#050812",
              color: "#f5f7ff",
              padding: 12,
              fontSize: 12,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas"
            }}
          >
            <div
              style={{
                marginBottom: 6,
                opacity: 0.8
              }}
            >
              <strong>Debug · Service & AI bootstrap payload</strong>
            </div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {debugBootstrapJson}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingIndustryPage;
