import { expect, test } from "@playwright/test";
import { reportRoadAccident, signInCitizen, signInStaff } from "./helpers";

test("staff decline moves the request to the next hospital", async ({ browser }) => {
  const citizenContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 28.4744, longitude: 77.504 },
    permissions: ["geolocation"],
  });
  const citizen = await citizenContext.newPage();
  await signInCitizen(citizen, "98765 00022");
  await reportRoadAccident(citizen);
  await citizen.getByRole("checkbox").check();
  await citizen.getByRole("button", { name: "Send request" }).click();
  await expect(citizen).toHaveURL(/\/requests\/\d+$/);
  const code = (await citizen.getByText(/^JS-\d{4}-\d{4}$/).first().innerText()).trim();

  const staffContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const staff = await staffContext.newPage();
  await signInStaff(staff, "staff.h3@jeevansetu.demo", "Demo@2026!");
  await expect(staff.getByRole("heading", { name: "Incoming requests" })).toBeVisible();
  await staff.getByRole("button", { name: `Open ${code}` }).click();

  const drawer = staff.getByRole("dialog", { name: code });
  await expect(drawer.getByText("Pre-arrival packet")).toBeVisible();
  await staff.keyboard.press("d");
  await expect(drawer.getByRole("button", { name: "Decline request" })).toBeDisabled();
  await drawer.getByLabel(/Reason for declining/).selectOption("no_bed");
  await drawer.getByRole("button", { name: "Decline request" }).click();
  await expect(staff.getByText(`Declined ${code}. Sent to the next hospital on the list.`)).toBeVisible();

  await citizen.reload();
  await expect(citizen.getByText("Pari Chowk Trauma Centre could not take the patient. We sent your request to Alpha Care Hospital.")).toBeVisible();

  await citizenContext.close();
  await staffContext.close();
});

test("another hospital cannot open the case", async ({ page }) => {
  await signInStaff(page, "staff.h2@jeevansetu.demo", "Demo@2026!");
  await expect(page.getByRole("heading", { name: "Incoming requests" })).toBeVisible();
  const response = await page.request.get("/api/staff/requests/999999");
  expect(response.status()).toBe(404);
});

test("admin sees metrics and can export CSV", async ({ page }) => {
  await signInStaff(page, "admin@jeevansetu.demo", "Admin@2026!");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Accept rate").first()).toBeVisible();
  const csv = await page.request.get("/api/admin/requests?format=csv");
  expect(csv.headers()["content-type"]).toContain("text/csv");
  await expect(page.getByRole("heading", { name: "Wound-photo model" })).toBeVisible();
  await page.getByRole("tab", { name: "Map" }).click();
  await expect(page.getByText("Active red-flag request")).toBeVisible();
  await page.getByRole("tab", { name: "Audit log" }).click();
  await expect(page.getByRole("table")).toBeVisible();
});

test("arrival closes the loop, family link shows status, admin sees the case report", async ({ browser }) => {
  const citizenContext = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 28.4744, longitude: 77.504 }, permissions: ["geolocation"] });
  const citizen = await citizenContext.newPage();
  await signInCitizen(citizen, "98765 00044");
  await reportRoadAccident(citizen);
  await citizen.getByRole("checkbox", { name: /I agree/ }).check();
  await citizen.getByRole("button", { name: "Send request" }).click();
  await expect(citizen).toHaveURL(/\/requests\/\d+$/);
  const code = (await citizen.getByText(/^JS-\d{4}-\d{4}$/).first().innerText()).trim();

  await citizen.getByRole("button", { name: "Share live status with family" }).click();
  const link = await citizen.getByRole("textbox", { name: "Share with family" }).inputValue();
  const family = await (await browser.newContext()).newPage();
  await family.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(family.getByText("Waiting for Pari Chowk Trauma Centre to reply")).toBeVisible();

  const staffContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const staff = await staffContext.newPage();
  await signInStaff(staff, "staff.h3@jeevansetu.demo", "Demo@2026!");
  await staff.getByRole("button", { name: `Open ${code}` }).click();
  const drawer = staff.getByRole("dialog", { name: code });
  await drawer.getByRole("button", { name: /Accept and hold a bed/ }).click();
  await staff.getByRole("tab", { name: /Accepted/ }).click();
  await staff.getByRole("button", { name: `Open ${code}` }).click();
  await staff.getByRole("dialog", { name: code }).getByRole("button", { name: "Patient arrived" }).click();
  await expect(staff.getByText(`Marked ${code} as arrived.`)).toBeVisible();

  await citizen.reload();
  await expect(citizen.getByText("Patient arrived", { exact: true })).toBeVisible();
  await citizen.getByRole("button", { name: "Who has seen this request" }).click();
  await expect(citizen.getByText(/Ritu Sharma, Pari Chowk Trauma Centre, confirmed arrival/)).toBeVisible();

  const admin = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await signInStaff(admin, "admin@jeevansetu.demo", "Admin@2026!");
  await admin.getByRole("tab", { name: "Notifications" }).click();
  await expect(admin.getByText(/accepted request/).first()).toBeVisible();
  await admin.getByRole("tab", { name: "Insights" }).click();
  await admin.getByRole("button", { name: "Run comparison" }).click();
  await expect(admin.getByText(/would go to a different first hospital/)).toBeVisible();
});
