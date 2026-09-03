import { describe, expect, it } from "vitest";
import { formatStopwatch } from "@/lib/temporal";

describe("formatStopwatch", () => {
  it("always pads to mm:ss, where formatSeconds would drop the seconds", () => {
    expect(formatStopwatch(0)).toBe("00:00");
    expect(formatStopwatch(9)).toBe("00:09");
    expect(formatStopwatch(90)).toBe("01:30");
    expect(formatStopwatch(15 * 60)).toBe("15:00");
  });

  it("only grows an hours field once there are hours", () => {
    expect(formatStopwatch(3599)).toBe("59:59");
    expect(formatStopwatch(3600)).toBe("1:00:00");
    expect(formatStopwatch(4032)).toBe("1:07:12");
  });

  // The clock is fed `Temporal.Duration#total("second")`, which is fractional.
  it("truncates rather than rounds, so the reading never runs ahead of the clock", () => {
    expect(formatStopwatch(59.9)).toBe("00:59");
  });

  it("keeps a sign for the negative case rather than silently flipping it", () => {
    expect(formatStopwatch(-90)).toBe("-01:30");
  });
});
