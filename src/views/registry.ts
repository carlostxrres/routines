import { CalendarDays, ChartLine, GitCompareArrows } from "lucide-react";
import { type ComponentType, lazy } from "react";
import type { ViewProps } from "@/views/types";

// Lazy on purpose: Recharts is by far the heaviest thing in the app and none of
// it is needed on the page that matters most — the one being tapped through in
// the middle of a routine.
const ActionsView = lazy(() =>
  import("@/views/actions/ActionsView").then((m) => ({ default: m.ActionsView })),
);
const WeekView = lazy(() => import("@/views/week/WeekView").then((m) => ({ default: m.WeekView })));
const DriftsView = lazy(() =>
  import("@/views/drifts/DriftsView").then((m) => ({ default: m.DriftsView })),
);

export type ViewDefinition = {
  slug: string;
  name: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType<ViewProps>;
};

export const VIEWS: ViewDefinition[] = [
  {
    slug: "actions",
    name: "Acciones",
    description: "Cuánto tarda cada acción, día a día.",
    icon: ChartLine,
    component: ActionsView,
  },
  {
    slug: "week",
    name: "Semana",
    description: "Dónde cae la rutina dentro del día.",
    icon: CalendarDays,
    component: WeekView,
  },
  {
    slug: "drifts",
    name: "Desvíos",
    description: "Plan contra realidad, día a día.",
    icon: GitCompareArrows,
    component: DriftsView,
  },
];

export function getView(slug: string | undefined): ViewDefinition | undefined {
  return VIEWS.find((view) => view.slug === slug);
}
