import { expect, test } from "@playwright/test";
import { answer, reportRoadAccident, signInCitizen } from "./helpers";

test.use({ geolocation: { latitude: 28.4744, longitude: 77.504 }, permissions: ["geolocation"] });

test("a road-accident report reaches the trauma centre and shows why", async ({ page }) => {
  await signInCitizen(page);
  await reportRoadAccident(page);

  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Tick the box" })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Send request" }).click();

  await expect(page).toHaveURL(/\/requests\/\d+$/);
  await expect(page.getByText("Pari Chowk Trauma Centre").first()).toBeVisible();
  await expect(page.getByText(/Reply due in \d:\d\d/)).toBeVisible();
  await page.getByRole("button", { name: "Why this hospital?" }).click();
  await expect(page.getByText("0.680 × 0.7 = 0.476")).toBeVisible();
  await expect(page.getByText("1.00 × 0.3 = 0.300")).toBeVisible();
  await expect(page.getByRole("link", { name: "Call 112" }).first()).toHaveAttribute("href", "tel:112");
});

test("a danger sign takes over the screen with Call 112", async ({ page }) => {
  await signInCitizen(page);
  await page.getByRole("link", { name: /Report an emergency/ }).click();
  await page.getByRole("radio", { name: "Burn" }).click();
  await page.getByRole("button", { name: /Next: symptoms/ }).click();
  await answer(page, /not breathing/, "Yes");

  const takeover = page.getByRole("alertdialog", { name: "This sounds serious" });
  await expect(takeover).toBeVisible();
  await expect(takeover.getByRole("link", { name: "Call 112" })).toHaveAttribute("href", "tel:112");
  await takeover.getByRole("button", { name: "I tapped Yes by mistake" }).click();
  await expect(takeover).toBeHidden();
  await expect(page.getByRole("radiogroup", { name: /not breathing/ }).getByRole("radio", { checked: true })).toHaveCount(0);
});

test("practice drill shows a ranking and sends nothing", async ({ page }) => {
  await signInCitizen(page, "98765 00011");
  await page.getByRole("button", { name: "Practice" }).click();
  await expect(page.getByText("Practice drill is on.")).toBeVisible();
  await reportRoadAccident(page);
  await page.getByRole("button", { name: "Run practice" }).click();
  await expect(page.getByText("This was a practice drill. Nothing was sent to any hospital.")).toBeVisible();
  await expect(page.getByText("1. Pari Chowk Trauma Centre")).toBeVisible();
  await page.getByRole("button", { name: "Turn off practice" }).click();
  await expect(page.getByText("No requests yet")).toBeVisible();
});

test("Hindi switch translates the home screen", async ({ page }) => {
  await signInCitizen(page);
  await page.getByRole("button", { name: "हिं" }).click();
  await expect(page.getByRole("heading", { name: "क्या डॉक्टरी मदद चाहिए?" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await page.getByRole("button", { name: "EN" }).click();
});

test("nearby hospitals are listed nearest first with directions", async ({ page }) => {
  await signInCitizen(page, "98765 00033");
  await page.getByRole("link", { name: "Hospitals near you" }).click();
  await expect(page.getByRole("heading", { name: "Hospitals near you" }).or(page.getByText("Hospitals near you").first())).toBeVisible();
  const names = page.locator("article span.font-semibold");
  await expect(names.first()).toHaveText("Sector Beta-2 City Hospital");
  await expect(page.getByRole("link", { name: "Directions" }).first()).toHaveAttribute("href", /google\.com\/maps\/dir/);
});
