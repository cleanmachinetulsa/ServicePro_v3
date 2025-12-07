import { DashboardWidget } from "@/../../shared/schema";

export const SIMPLE_MODE_WIDGETS = [
  "monthly-stats",
  "calendar", 
  "schedule",
  "quick-actions",
];

export const DEFAULT_WIDGET_CATALOG: DashboardWidget[] = [
  {
    id: "monthly-stats",
    position: { x: 0, y: 0 },
    size: { width: 12, height: 1 },
    visible: true,
    order: 0,
  },
  {
    id: "calendar",
    position: { x: 0, y: 1 },
    size: { width: 8, height: 6 },
    visible: true,
    order: 1,
  },
  {
    id: "daily-insights",
    position: { x: 8, y: 1 },
    size: { width: 4, height: 3 },
    visible: true,
    order: 2,
  },
  {
    id: "quick-actions",
    position: { x: 8, y: 4 },
    size: { width: 4, height: 3 },
    visible: true,
    order: 3,
  },
  {
    id: "schedule",
    position: { x: 0, y: 7 },
    size: { width: 8, height: 4 },
    visible: true,
    order: 4,
  },
  {
    id: "cash-collections",
    position: { x: 8, y: 7 },
    size: { width: 4, height: 2 },
    visible: true,
    order: 5,
  },
  {
    id: "deposit-history",
    position: { x: 8, y: 9 },
    size: { width: 4, height: 2 },
    visible: true,
    order: 6,
  },
];

export const DEFAULT_LAYOUT_VERSION = 1;

export function reconcileLayoutWithCatalog(
  savedWidgets: DashboardWidget[] | undefined,
  catalog: DashboardWidget[] = DEFAULT_WIDGET_CATALOG
): DashboardWidget[] {
  if (!savedWidgets || savedWidgets.length === 0) {
    return catalog;
  }

  const savedWidgetMap = new Map(savedWidgets.map((w) => [w.id, w]));
  const reconciledWidgets: DashboardWidget[] = [];

  catalog.forEach((catalogWidget) => {
    const savedWidget = savedWidgetMap.get(catalogWidget.id);
    if (savedWidget) {
      reconciledWidgets.push(savedWidget);
    } else {
      reconciledWidgets.push(catalogWidget);
    }
  });

  return reconciledWidgets;
}
