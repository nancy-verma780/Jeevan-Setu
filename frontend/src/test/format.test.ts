import { describe, expect, it } from "vitest";
import { formatCountdown, formatKm, maskPhone } from "@/lib/format";

describe("format", () => {
  it("formats countdowns as m:ss", () => {
    expect(formatCountdown(125)).toBe("2:05");
    expect(formatCountdown(-3)).toBe("0:00");
  });
  it("formats kilometres to one decimal", () => {
    expect(formatKm(8.0123)).toBe("8.0");
  });
  it("masks phone numbers", () => {
    expect(maskPhone("+919811024521")).toBe("+91 98••• ••521");
  });
});
