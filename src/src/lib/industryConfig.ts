// src/lib/industryConfig.ts

import {
  INDUSTRY_PACKS,
  type IndustryPack,
  type ServiceTemplate,
  type AIPersona
} from "../config/industryPacks";

/**
 * This is the normalized shape you can store in your DB as the
 * tenant's "industry configuration".
 *
 * It flattens out the industry pack into a single object with:
 *  - industry meta
 *  - selected feature groups
 *  - service & upsell templates
 *  - AI persona defaults
 */
export type NormalizedIndustryConfig = {
  industryId: string;
  industrySlug: string;
  industryLabel: string;
  category: string;
  featureIds: string[];
  createdAt: string; // ISO timestamp
  services: Array<{
    id: string;
    label: string;
    description: string;
    basePriceHint?: string;
    defaultDurationMinutes?: number;
    isPremium?: boolean;
    kind: "primary" | "upsell";
  }>;
  aiPersona: AIPersona;
};

/**
 * Lookup helper: find an industry pack by id.
 */
export function getIndustryPackById(id: string): IndustryPack | undefined {
  return INDUSTRY_PACKS.find((p) => p.id === id);
}

/**
 * Returns the default feature IDs for a pack based on enabledByDefault.
 */
export function getDefaultFeatureIds(pack: IndustryPack): string[] {
  return pack.featureToggles
    .filter((t) => t.enabledByDefault)
    .map((t) => t.id);
}

/**
 * Normalize services + upsells into a flat list with a "kind" field.
 */
function normalizeServices(
  pack: IndustryPack
): NormalizedIndustryConfig["services"] {
  const primary: NormalizedIndustryConfig["services"] =
    pack.defaultPrimaryServices.map((svc: ServiceTemplate) => ({
      id: svc.id,
      label: svc.label,
      description: svc.description,
      basePriceHint: svc.basePriceHint,
      defaultDurationMinutes: svc.defaultDurationMinutes,
      isPremium: svc.isPremium,
      kind: "primary" as const
    }));

  const upsells: NormalizedIndustryConfig["services"] =
    pack.defaultUpsellServices.map((up: ServiceTemplate) => ({
      id: up.id,
      label: up.label,
      description: up.description,
      basePriceHint: up.basePriceHint,
      defaultDurationMinutes: up.defaultDurationMinutes,
      isPremium: up.isPremium,
      kind: "upsell" as const
    }));

  return [...primary, ...upsells];
}

/**
 * Main helper: builds a normalized config object from:
 *  - industryId (must match INDUSTRY_PACKS)
 *  - optional selectedFeatureIds (if empty, uses pack defaults)
 */
export function buildIndustryConfig(params: {
  industryId: string;
  selectedFeatureIds?: string[];
}): NormalizedIndustryConfig | null {
  const { industryId, selectedFeatureIds } = params;
  const pack = getIndustryPackById(industryId);
  if (!pack) return null;

  const featureIds =
    selectedFeatureIds && selectedFeatureIds.length > 0
      ? selectedFeatureIds
      : getDefaultFeatureIds(pack);

  return {
    industryId: pack.id,
    industrySlug: pack.slug,
    industryLabel: pack.label,
    category: pack.category,
    featureIds,
    createdAt: new Date().toISOString(),
    services: normalizeServices(pack),
    aiPersona: pack.aiPersona
  };
}

/**
 * Optional: a stub you can wire to your backend.
 *
 * For now it just logs the payload. You can replace the inside later
 * with a fetch() or axios() call to your API.
 */
export async function saveIndustryConfigToServer(opts: {
  tenantId: string;
  config: NormalizedIndustryConfig;
}): Promise<void> {
  const { tenantId, config } = opts;

  // 🔧 TODO: replace this with your real API call
  // Example:
  // await fetch("/api/onboarding/industry-config", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ tenantId, config })
  // });

  console.log("[Onboarding] Would save industry config for tenant:", {
    tenantId,
    config
  });
}
