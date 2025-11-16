import { useQuery } from "@tanstack/react-query";
import type { HomepageContent } from "@shared/schema";
import { getTemplate } from "@/lib/homeTemplates";

import CurrentTemplate from "./templates/CurrentTemplate";
import LuminousConcierge from "./templates/LuminousConcierge";
import DynamicSpotlight from "./templates/DynamicSpotlight";
import PrestigeGrid from "./templates/PrestigeGrid";
import NightDriveNeon from "./templates/NightDriveNeon";
import ExecutiveMinimal from "./templates/ExecutiveMinimal";

const TEMPLATE_COMPONENTS: Record<string, React.ComponentType> = {
  current: CurrentTemplate,
  luminous_concierge: LuminousConcierge,
  dynamic_spotlight: DynamicSpotlight,
  prestige_grid: PrestigeGrid,
  night_drive_neon: NightDriveNeon,
  executive_minimal: ExecutiveMinimal,
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

  return <TemplateComponent />;
}
