import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getCutoffDateTime,
  isPastCutoff,
  msUntilCutoff,
  formatCountdown,
  startOfWeekInTz,
} from "@/lib/time";

const ART = "America/Argentina/Buenos_Aires"; // UTC-3, sin DST

afterEach(() => {
  vi.restoreAllMocks();
});

// ──────────────────────────────────────────────────────────────────────────────
// getCutoffDateTime
// ──────────────────────────────────────────────────────────────────────────────
describe("getCutoffDateTime", () => {
  // base = 2024-01-15 al mediodía UTC (lunes)
  const base = new Date("2024-01-15T12:00:00Z");

  it("14:00 ART → 17:00 UTC", () => {
    const result = getCutoffDateTime(base, ART, "14:00");
    expect(result.toISOString()).toBe("2024-01-15T17:00:00.000Z");
  });

  it("18:00 ART → 21:00 UTC", () => {
    const result = getCutoffDateTime(base, ART, "18:00");
    expect(result.toISOString()).toBe("2024-01-15T21:00:00.000Z");
  });

  it("formato HH:MM:SS (postgres time) funciona igual que HH:MM", () => {
    const withSeconds = getCutoffDateTime(base, ART, "14:00:00");
    const withoutSeconds = getCutoffDateTime(base, ART, "14:00");
    expect(withSeconds.getTime()).toBe(withoutSeconds.getTime());
  });

  it("00:00 ART → 03:00 UTC del mismo día", () => {
    const result = getCutoffDateTime(base, ART, "00:00");
    expect(result.toISOString()).toBe("2024-01-15T03:00:00.000Z");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// isPastCutoff
// ──────────────────────────────────────────────────────────────────────────────
describe("isPastCutoff", () => {
  const base = new Date("2024-01-15T12:00:00Z");

  it("now=16:00 UTC, cutoff=14:00 ART (17:00 UTC) → false (antes del corte)", () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2024-01-15T16:00:00Z").getTime());
    expect(isPastCutoff(base, ART, "14:00")).toBe(false);
  });

  it("now=18:00 UTC, cutoff=14:00 ART (17:00 UTC) → true (pasó el corte)", () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2024-01-15T18:00:00Z").getTime());
    expect(isPastCutoff(base, ART, "14:00")).toBe(true);
  });

  it("now=20:00 UTC, cutoff=18:00 ART (21:00 UTC) → false (antes del corte)", () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2024-01-15T20:00:00Z").getTime());
    expect(isPastCutoff(base, ART, "18:00")).toBe(false);
  });

  it("now=22:00 UTC, cutoff=18:00 ART (21:00 UTC) → true (pasó el corte)", () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2024-01-15T22:00:00Z").getTime());
    expect(isPastCutoff(base, ART, "18:00")).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// msUntilCutoff
// ──────────────────────────────────────────────────────────────────────────────
describe("msUntilCutoff", () => {
  const base = new Date("2024-01-15T12:00:00Z");

  it("1 hora antes del corte → 3_600_000 ms", () => {
    // cutoff 14:00 ART = 17:00 UTC; now = 16:00 UTC
    vi.spyOn(Date, "now").mockReturnValue(new Date("2024-01-15T16:00:00Z").getTime());
    expect(msUntilCutoff(base, ART, "14:00")).toBe(3_600_000);
  });

  it("1 hora después del corte → -3_600_000 ms (negativo)", () => {
    // cutoff 14:00 ART = 17:00 UTC; now = 18:00 UTC
    vi.spyOn(Date, "now").mockReturnValue(new Date("2024-01-15T18:00:00Z").getTime());
    expect(msUntilCutoff(base, ART, "14:00")).toBe(-3_600_000);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// formatCountdown
// ──────────────────────────────────────────────────────────────────────────────
describe("formatCountdown", () => {
  it("ms ≤ 0 → '00:00:00'", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(-1)).toBe("00:00:00");
  });

  it("1h 1m 1s → '01:01:01'", () => {
    expect(formatCountdown(3_661_000)).toBe("01:01:01");
  });

  it("23h 59m 59s → '23:59:59'", () => {
    expect(formatCountdown(86_399_000)).toBe("23:59:59");
  });

  it("exactamente 1 hora → '01:00:00'", () => {
    expect(formatCountdown(3_600_000)).toBe("01:00:00");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// startOfWeekInTz
// ──────────────────────────────────────────────────────────────────────────────
describe("startOfWeekInTz", () => {
  it("miércoles ART → lunes 00:00 ART = lunes 03:00 UTC", () => {
    // 2024-01-17 es miércoles; en ART el lunes de esa semana es 2024-01-15
    const wednesday = new Date("2024-01-17T15:00:00Z");
    const result = startOfWeekInTz(wednesday, ART);
    expect(result.toISOString()).toBe("2024-01-15T03:00:00.000Z");
  });

  it("lunes ART → mismo lunes 00:00 ART = lunes 03:00 UTC", () => {
    const monday = new Date("2024-01-15T10:00:00Z");
    const result = startOfWeekInTz(monday, ART);
    expect(result.toISOString()).toBe("2024-01-15T03:00:00.000Z");
  });
});
