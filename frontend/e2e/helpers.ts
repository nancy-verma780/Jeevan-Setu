import { expect, type Page } from "@playwright/test";

export async function signInCitizen(page: Page, phone = "98110 24521") {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  const note = await page.getByText(/Your code is \d{6}/).innerText();
  const code = note.match(/(\d{6})/)![1]!;
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Need medical help?" })).toBeVisible();
}

export async function signInStaff(page: Page, email: string, password: string) {
  await page.goto("/staff/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function answer(page: Page, question: RegExp, value: "Yes" | "No" | "Unknown") {
  await page.getByRole("radiogroup", { name: question }).getByRole("radio", { name: value, exact: true }).click();
}

/** Fills the 3 steps as a road accident with no danger signs and some bleeding. */
export async function reportRoadAccident(page: Page) {
  await page.getByRole("link", { name: /Report an emergency/ }).click();
  await page.getByRole("radio", { name: "Road accident" }).click();
  await page.getByRole("button", { name: /Next: symptoms/ }).click();
  for (const q of [/unconscious/, /not breathing/, /heavy bleeding/, /chest pain/, /seizure/]) await answer(page, q, "No");
  await answer(page, /some bleeding/, "Yes");
  await page.getByRole("button", { name: /Next: location/ }).click();
  await page.getByRole("button", { name: "Use my current location" }).click();
  await expect(page.getByText(/Location set/)).toBeVisible();
}
