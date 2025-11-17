import { useQuery } from "@tanstack/react-query";
import type { HomepageContent } from "@shared/schema";
import { getTemplate } from "@/lib/homeTemplates";

import CurrentTemplate from "@/pages/templates/CurrentTemplate";
import LuminousConcierge from "@/pages/templates/LuminousConcierge";
import DynamicSpotlight from "@/pages/templates/DynamicSpotlight";
import PrestigeGrid from "@/pages/templates/PrestigeGrid";
import NightDriveNeon from "@/pages/templates/NightDriveNeon";
import ExecutiveMinimal from "@/pages/templates/ExecutiveMinimal";
import QuantumConcierge from "@/pages/templates/QuantumConcierge";

const TEMPLATE_COMPONENTS: Record<string, React.ComponentType> = {
  current: CurrentTemplate,
  luminous_concierge: LuminousConcierge,
  dynamic_spotlight: DynamicSpotlight,
  prestige_grid: PrestigeGrid,
  night_drive_neon: NightDriveNeon,
  executive_minimal: ExecutiveMinimal,
  quantum_concierge: QuantumConcierge,
};

export default function HomePage() {
  const { data, isLoading } = useQuery<{ success: boolean; content: HomepageContent }>({
    queryKey: ['/api/homepage-content'],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-blue-950/10 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  const templateId = data?.content?.templateId || 'current';
  const TemplateComponent = TEMPLATE_COMPONENTS[templateId] || CurrentTemplate;

  return <TemplateComponent content={data?.content} />;
}
