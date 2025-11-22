// src/components/onboarding/IndustrySelectionStep.tsx

import React, { useMemo } from "react";
import {
  INDUSTRY_PACKS,
  type IndustryPack,
  type FeatureToggle
} from "../../config/industryPacks";

type IndustrySelectionStepProps = {
  // Currently selected industry id (from your form or state)
  selectedIndustryId: string | null;
  // Currently selected feature toggle ids for that industry
  selectedFeatureIds: string[];
  // Called whenever the user changes industry or toggles
  onChange: (params: {
    industryId: string;
    selectedFeatureIds: string[];
  }) => void;
};

// --- Reusable preview component --- //

type IndustryPackPreviewProps = {
  pack: IndustryPack;
  selectedFeatureIds?: string[];
};

export const IndustryPackPreview: React.FC<IndustryPackPreviewProps> = ({
  pack,
  selectedFeatureIds
}) => {
  const activeFeatureIds = selectedFeatureIds ?? pack.featureToggles
    .filter((t) => t.enabledByDefault)
    .map((t) => t.id);

  const isFeatureActive = (featureId: string) =>
    activeFeatureIds.includes(featureId);

  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.07)",
        padding: 20,
        background:
          "radial-gradient(circle at top left, rgba(0,0,0,0.04), transparent)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: 0.08,
            opacity: 0.7,
            marginBottom: 4
          }}
        >
          Preview
        </div>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            margin: 0
          }}
        >
          {pack.label}
        </h2>
        <div
          style={{
            fontSize: 13,
            opacity: 0.8,
            marginTop: 4
          }}
        >
          Example business: <strong>{pack.exampleBusinessName}</strong>
        </div>
        <p
          style={{
            fontSize: 14,
            marginTop: 8,
            marginBottom: 0,
            opacity: 0.9
          }}
        >
          {pack.description}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
          gap: 16,
          alignItems: "flex-start"
        }}
      >
        {/* Core services */}
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6
            }}
          >
            Core services your app will auto-populate
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              maxHeight: 220,
              overflowY: "auto",
              paddingRight: 4
            }}
          >
            {pack.defaultPrimaryServices.map((svc) => (
              <div
                key={svc.id}
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.07)",
                  padding: 8,
                  background: svc.isPremium
                    ? "linear-gradient(135deg, rgba(255,215,0,0.09), rgba(255,255,255,0.9))"
                    : "rgba(255,255,255,0.9)"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 2
                  }}
                >
                  {svc.isPremium && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 999,
                        backgroundColor: "rgba(0,0,0,0.05)",
                        textTransform: "uppercase",
                        letterSpacing: 0.08
                      }}
                    >
                      Premium
                    </span>
                  )}
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600
                    }}
                  >
                    {svc.label}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    opacity: 0.85
                  }}
                >
                  {svc.description}
                </div>
                {(svc.basePriceHint || svc.defaultDurationMinutes) && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 6,
                      fontSize: 11.5,
                      opacity: 0.8
                    }}
                  >
                    {svc.basePriceHint && (
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: 999,
                          border: "1px solid rgba(0,0,0,0.08)",
                          backgroundColor: "rgba(255,255,255,0.8)"
                        }}
                      >
                        Typical: {svc.basePriceHint}
                      </span>
                    )}
                    {svc.defaultDurationMinutes && (
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: 999,
                          border: "1px solid rgba(0,0,0,0.08)",
                          backgroundColor: "rgba(255,255,255,0.8)"
                        }}
                      >
                        ~{svc.defaultDurationMinutes} min
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Upsells & persona */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 6
              }}
            >
              Smart upsells & add-ons
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: 140,
                overflowY: "auto",
                paddingRight: 4
              }}
            >
              {pack.defaultUpsellServices.map((up) => (
                <div
                  key={up.id}
                  style={{
                    borderRadius: 999,
                    border: "1px dashed rgba(0,0,0,0.12)",
                    padding: "5px 10px",
                    fontSize: 12.5,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  <span>{up.label}</span>
                  {up.basePriceHint && (
                    <span style={{ opacity: 0.7 }}>{up.basePriceHint}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.06)",
              padding: 10,
              backgroundColor: "rgba(0,0,0,0.03)"
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4
              }}
            >
              AI agent persona
            </div>
            <div
              style={{
                fontSize: 12.5,
                marginBottom: 4
              }}
            >
              <strong>Vibe:</strong> {pack.aiPersona.shortTagline}
            </div>
            <div
              style={{
                fontSize: 11.5,
                opacity: 0.85
              }}
            >
              <strong>Texting style:</strong> {pack.aiPersona.smsTone}
              <br />
              <strong>Email style:</strong> {pack.aiPersona.emailTone}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4
              }}
            >
              Active feature groups
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6
              }}
            >
              {pack.featureToggles.map((ft) => {
                const active = isFeatureActive(ft.id);
                return (
                  <span
                    key={ft.id}
                    style={{
                      padding: "4px 9px",
                      borderRadius: 999,
                      fontSize: 11.5,
                      border: active
                        ? "1px solid rgba(0, 122, 255, 0.7)"
                        : "1px solid rgba(0,0,0,0.1)",
                      backgroundColor: active
                        ? "rgba(0, 122, 255, 0.06)"
                        : "rgba(255,255,255,0.9)",
                      opacity: active ? 1 : 0.6
                    }}
                  >
                    {ft.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main onboarding selection step --- //

export const IndustrySelectionStep: React.FC<IndustrySelectionStepProps> = ({
  selectedIndustryId,
  selectedFeatureIds,
  onChange
}) => {
  const selectedPack: IndustryPack | undefined = useMemo(() => {
    if (!selectedIndustryId) return undefined;
    return INDUSTRY_PACKS.find((p) => p.id === selectedIndustryId);
  }, [selectedIndustryId]);

  const handleIndustryClick = (pack: IndustryPack) => {
    const defaultFeatures = pack.featureToggles
      .filter((t) => t.enabledByDefault)
      .map((t) => t.id);

    onChange({
      industryId: pack.id,
      selectedFeatureIds: defaultFeatures
    });
  };

  const handleToggleFeature = (feature: FeatureToggle) => {
    if (!selectedPack) return;

    const currentlySelected = new Set(selectedFeatureIds);
    if (currentlySelected.has(feature.id)) {
      currentlySelected.delete(feature.id);
    } else {
      currentlySelected.add(feature.id);
    }

    onChange({
      industryId: selectedPack.id,
      selectedFeatureIds: Array.from(currentlySelected)
    });
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1.1fr)",
        gap: 20,
        alignItems: "flex-start"
      }}
    >
      {/* LEFT: industry list + toggles */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              margin: 0,
              marginBottom: 4
            }}
          >
            What kind of business is this?
          </h1>
          <p
            style={{
              fontSize: 14,
              margin: 0,
              opacity: 0.8
            }}
          >
            We’ll pre-build services, upsells, and AI behavior for that industry.
            You can tweak everything later. For photography, one studio can handle
            portraits, weddings, events, and real estate inside a single system.
          </p>
        </div>

        {/* Industry grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 10
          }}
        >
          {INDUSTRY_PACKS.map((pack) => {
            const isSelected = pack.id === selectedIndustryId;

            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => handleIndustryClick(pack)}
                style={{
                  textAlign: "left",
                  borderRadius: 12,
                  border: isSelected
                    ? "1.5px solid rgba(0, 122, 255, 0.8)"
                    : "1px solid rgba(0,0,0,0.08)",
                  padding: 10,
                  cursor: "pointer",
                  background: isSelected
                    ? "linear-gradient(135deg, rgba(0,122,255,0.06), #ffffff)"
                    : "#ffffff",
                  boxShadow: isSelected
                    ? "0 8px 18px rgba(0,0,0,0.07)"
                    : "0 1px 4px rgba(0,0,0,0.03)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: 0.08,
                    opacity: 0.7
                  }}
                >
                  {pack.category}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600
                  }}
                >
                  {pack.label}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    opacity: 0.8
                  }}
                >
                  {pack.description.slice(0, 80)}
                  {pack.description.length > 80 ? "…" : ""}
                </div>
              </button>
            );
          })}
        </div>

        {/* Feature toggles for selected industry */}
        {selectedPack && (
          <div
            style={{
              marginTop: 4,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.08)",
              padding: 12,
              backgroundColor: "rgba(248,249,251,0.9)",
              display: "flex",
              flexDirection: "column",
              gap: 10
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 600
              }}
            >
              Feature groups for{" "}
              <span style={{ fontWeight: 700 }}>{selectedPack.label}</span>
            </div>
            <div
              style={{
                fontSize: 12.5,
                opacity: 0.8
              }}
            >
              Turn whole sections of the system on or off. For example, a
              photographer could keep <strong>Portraits + Weddings</strong> but
              disable <strong>Real Estate</strong>, all inside one account—not
              three separate websites.
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8
              }}
            >
              {selectedPack.featureToggles.map((ft) => {
                const active = selectedFeatureIds.includes(ft.id);

                return (
                  <label
                    key={ft.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: 8,
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.08)",
                      backgroundColor: active
                        ? "rgba(0,122,255,0.04)"
                        : "rgba(255,255,255,0.9)",
                      cursor: "pointer"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => handleToggleFeature(ft)}
                      style={{ marginTop: 3 }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600
                        }}
                      >
                        {ft.label}
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          opacity: 0.85
                        }}
                      >
                        {ft.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: live preview */}
      <div>
        {selectedPack ? (
          <IndustryPackPreview
            pack={selectedPack}
            selectedFeatureIds={selectedFeatureIds}
          />
        ) : (
          <div
            style={{
              borderRadius: 16,
              border: "1px dashed rgba(0,0,0,0.12)",
              padding: 20,
              fontSize: 13.5,
              opacity: 0.8
            }}
          >
            Pick an industry on the left to see a live preview of:
            <ul>
              <li>Services that will auto-populate in their account</li>
              <li>Upsells the AI will know how to recommend</li>
              <li>The AI agent’s default tone and persona</li>
              <li>Feature groups they can toggle on and off (like niches)</li>
            </ul>
            This step is what keeps setup from feeling overwhelming, while
            still giving them a “this was made exactly for my type of business”
            experience.
          </div>
        )}
      </div>
    </div>
  );
};

export default IndustrySelectionStep;
