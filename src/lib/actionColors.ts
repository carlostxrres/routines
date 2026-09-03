// A routine can have any number of actions, so its palette can't be a fixed
// list of CSS variables like HealthStats' chart highlights. Instead each action
// gets a hue offset from the previous one by the golden angle: however many
// there are, consecutive segments in the timeline stay maximally far apart in
// hue and the sequence never repeats.
//
// Lightness and chroma are fixed, matching the --chart-highlight-* tokens in
// index.css, so an action's colour reads at the same weight in both themes.
const GOLDEN_ANGLE = 137.508;
const LIGHTNESS = 0.7;
const CHROMA = 0.125;

// Free actions — the ones typed into the combobox, outside the plan — are
// deliberately colourless: they should read as "not part of the routine".
// Two shades so that consecutive free actions in a track (e.g. RoundTimeline)
// stay visually distinguishable from one another.
const FREE_ACTION_COLORS = [
  "var(--muted-foreground)",
  "color-mix(in oklch, var(--muted-foreground), var(--foreground) 25%)",
] as const;
export const FREE_ACTION_COLOR = FREE_ACTION_COLORS[0];

export function actionHue(baseHue: number, index: number): number {
  return (baseHue + GOLDEN_ANGLE * index) % 360;
}

export function actionColor(baseHue: number, index: number): string {
  return `oklch(${LIGHTNESS} ${CHROMA} ${actionHue(baseHue, index)})`;
}

// The colour of every planned action of a routine, keyed by id. Built once per
// routine and passed down, so the same action keeps its colour in the plan
// track, the performed track and the charts.
export function actionColorMap(plannedActionIds: string[], baseHue: number): Map<string, string> {
  return new Map(plannedActionIds.map((id, index) => [id, actionColor(baseHue, index)]));
}

// The colour of each segment in a sequence (e.g. a round's performed
// segments), keyed by position. Planned actions get their colour from
// `colors`; free actions alternate between the two FREE_ACTION_COLORS, but
// only when the previous segment was also free, so two of them in a row
// never blend into one block.
export function segmentColors(
  segments: { plannedActionId: string | null }[],
  colors: Map<string, string>,
): string[] {
  let previousWasFree = false;
  return segments.map(({ plannedActionId }) => {
    const plannedColor = plannedActionId ? colors.get(plannedActionId) : undefined;
    if (plannedColor) {
      previousWasFree = false;
      return plannedColor;
    }
    const color = FREE_ACTION_COLORS[previousWasFree ? 1 : 0];
    previousWasFree = true;
    return color;
  });
}
