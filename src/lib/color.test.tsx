import { describe, expect, it } from "vitest";
import { COURSE_COLORS, courseColor, courseColorAt, courseColorPosition } from "./color";

describe("courseColor", () => {
  it("leaves palette colors effectively unchanged", () => {
    for (const { value } of COURSE_COLORS) {
      const out = courseColor(value);
      const diff = [1, 3, 5].map((i) => Math.abs(parseInt(out.slice(i, i + 2), 16) - parseInt(value.slice(i, i + 2), 16)));
      expect(Math.max(...diff)).toBeLessThanOrEqual(3);
    }
  });

  it("lifts very dark accents and tames neon ones", () => {
    expect(courseColor("#000080")).not.toBe("#000080");
    expect(courseColor("#C8F135")).not.toBe("#C8F135");
  });

  it("passes through values it cannot parse", () => {
    expect(courseColor("rebeccapurple")).toBe("rebeccapurple");
  });
});

describe("hue slider", () => {
  it("round-trips a position through a color and back", () => {
    for (const t of [0, 0.1, 0.37, 0.5, 0.82, 1]) {
      expect(courseColorPosition(courseColorAt(t))).toBeCloseTo(t, 1);
    }
  });

  it("never lands on the reserved lime", () => {
    // The brand lime sits at ~121°, inside the excluded band, so it snaps to an end
    const t = courseColorPosition("#CDF426");
    expect(t === 0 || t === 1).toBe(true);
  });
});
