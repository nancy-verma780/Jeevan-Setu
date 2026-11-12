import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/en";
import { hi } from "@/lib/i18n/hi";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value) ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe("translations", () => {
  it("Hindi has exactly the English keys", () => {
    expect(keys(hi).sort()).toEqual(keys(en).sort());
  });
  it("first-aid lists have the same number of steps", () => {
    for (const injury of Object.keys(en.firstAid.steps) as Array<keyof typeof en.firstAid.steps>) {
      expect(hi.firstAid.steps[injury].length).toBe(en.firstAid.steps[injury].length);
    }
  });
  it("interpolation placeholders match", () => {
    const placeholders = (s: string) => (s.match(/{{\w+}}/g) ?? []).sort().join();
    const flat = (o: object, p = ""): Array<[string, string]> =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [[`${p}${k}`, v] as [string, string]] : v && typeof v === "object" && !Array.isArray(v) ? flat(v, `${p}${k}.`) : []));
    const hiMap = new Map(flat(hi));
    for (const [key, value] of flat(en)) {
      expect(placeholders(hiMap.get(key) ?? ""), key).toBe(placeholders(value));
    }
  });
});
