import {test, expect} from "@playwright/test";

test.describe("Authentication Pages", () => {
  test("login page loads correctly", async ({page}) => {
    await page.goto("/login");

    // Check page title
    await expect(page).toHaveTitle(/Hulkastorus/);

    // Check login form elements
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", {name: "Login"})).toBeVisible();

    // Check navigation links
    await expect(page.getByText("Forgot password?")).toBeVisible();
    await expect(page.getByText("Don't have an account? Register")).toBeVisible();
  });

  test("forgot password functionality", async ({page}) => {
    await page.goto("/login");

    // Click forgot password
    await page.getByText("Forgot password?").click();

    // Should show reset form
    await expect(page.getByRole("button", {name: "Send Reset Link"})).toBeVisible();
    await expect(page.getByText("Back to login")).toBeVisible();

    // Password field should be hidden
    await expect(page.getByPlaceholder("Password")).not.toBeVisible();
  });

  test("register page loads correctly", async ({page}) => {
    await page.goto("/register");

    // Check page title
    await expect(page).toHaveTitle(/Hulkastorus/);

    // Check registration form elements
    await expect(page.getByPlaceholder("Full Name")).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password").first()).toBeVisible();
    await expect(page.getByPlaceholder("Confirm Password")).toBeVisible();
    await expect(page.getByPlaceholder("Invite Code")).toBeVisible();
    await expect(page.getByRole("button", {name: "Register"})).toBeVisible();

    // Check navigation link
    await expect(page.getByText("Already have an account? Login")).toBeVisible();
  });

  test("reset password page loads correctly", async ({page}) => {
    await page.goto("/reset-password");

    // Check page title
    await expect(page).toHaveTitle(/Hulkastorus/);

    // Check reset form elements
    await expect(page.getByPlaceholder("New Password").first()).toBeVisible();
    await expect(page.getByPlaceholder("Confirm New Password")).toBeVisible();
    await expect(page.getByRole("button", {name: "Reset Password"})).toBeVisible();

    // Check navigation link
    await expect(page.getByText("Back to login")).toBeVisible();
  });

  test("navigation between auth pages", async ({page}) => {
    // Start at login
    await page.goto("/login");

    // Navigate to register
    await page.getByText("Don't have an account? Register").click();
    await expect(page).toHaveURL("/register");

    // Navigate back to login
    await page.getByText("Already have an account? Login").click();
    await expect(page).toHaveURL("/login");
  });
});
