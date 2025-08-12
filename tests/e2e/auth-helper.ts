import {Page} from "@playwright/test";

export async function loginUser(page: Page, email?: string, password?: string) {
  const testEmail = email || `test${Date.now()}@example.com`;
  const testPassword = password || "password123";

  // First register a user if email is not provided (meaning we need a new user)
  if (!email) {
    await page.goto("/register");
    await page.getByPlaceholder("Full Name").fill("Test User");
    await page.getByPlaceholder("Email").fill(testEmail);
    await page.getByPlaceholder("Password").first().fill(testPassword);
    await page.getByPlaceholder("Confirm Password").fill(testPassword);
    await page.getByPlaceholder("Invite Code").fill("TESTCODE");
    await page.getByRole("button", {name: "Register"}).click();
    await page.waitForURL("/login?registered=true");
  } else {
    await page.goto("/login");
  }

  // Now login
  await page.getByPlaceholder("Email").fill(testEmail);
  await page.getByPlaceholder("Password").fill(testPassword);
  await page.getByRole("button", {name: "Login"}).click();
  await page.waitForURL("/dashboard");

  return testEmail;
}
