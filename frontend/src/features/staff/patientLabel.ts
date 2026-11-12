import type { TFunction } from "i18next";
import type { Sex } from "@/lib/api/types";

export function patientLabel(t: TFunction, sex: Sex, age: number | null): string {
  const parts = [sex !== "unknown" ? t(`sex.${sex}`) : null, age !== null ? t("staff.ageYears", { age }) : null].filter(Boolean);
  return parts.length ? parts.join(", ") : t("common.notGiven");
}
