import type { RoutineWithPlans } from "@shared/types";

// Every view renders one routine; the routine selector lives in the page shell.
export type ViewProps = { routine: RoutineWithPlans };
