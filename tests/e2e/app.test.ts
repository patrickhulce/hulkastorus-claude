import {test, expect} from "@playwright/test";
import {loginUser} from "./auth-helper";

test.describe("App Pages", () => {
  test("dashboard page loads correctly", async ({page}) => {
    // Login first since dashboard is protected
    await loginUser(page);
    await page.goto("/dashboard");

    // Check page title
    await expect(page).toHaveTitle(/Hulkastorus/);

    // Check main content
    await expect(page.getByRole("heading", {name: "Dashboard"})).toBeVisible();
    await expect(page.getByText("Welcome back!")).toBeVisible();
    await expect(page.getByRole("link", {name: "Logout"})).toBeVisible();

    // Check placeholder cards
    await expect(page.getByRole("heading", {name: "Files"})).toBeVisible();
    await expect(page.getByRole("heading", {name: "Storage"})).toBeVisible();
    await expect(page.getByRole("heading", {name: "API Keys"})).toBeVisible();
  });

  test.skip("file manager page loads correctly", async ({page}) => {
    // Login first since file manager is protected
    await loginUser(page);
    await page.goto("/app/browse");

    // Check page title
    await expect(page).toHaveTitle(/Hulkastorus/);

    // Check sidebar navigation
    await expect(page.getByRole("link", {name: "File Manager"})).toBeVisible();

    // Check file manager elements
    await expect(page.getByText("Home")).toBeVisible();
    await expect(page.getByRole("button", {name: "Upload"})).toBeVisible();
    await expect(page.getByRole("button", {name: "New Folder"})).toBeVisible();
    await expect(page.getByPlaceholder("Search files...")).toBeVisible();

    // Check table headers
    await expect(page.getByText("Name")).toBeVisible();
    await expect(page.getByText("Size")).toBeVisible();
    await expect(page.getByText("Uploaded")).toBeVisible();
    await expect(page.getByText("Expires")).toBeVisible();
    await expect(page.getByText("Permissions")).toBeVisible();
  });

  test.skip("settings page loads correctly", async ({page}) => {
    // Login first since settings is protected
    await loginUser(page);
    await page.goto("/app/settings");

    // Check page title
    await expect(page).toHaveTitle(/Hulkastorus/);

    // Check sidebar navigation
    await expect(page.getByRole("link", {name: "Settings"})).toBeVisible();

    // Check settings sections
    await expect(page.getByRole("heading", {name: "Settings"})).toBeVisible();
    await expect(page.getByRole("heading", {name: "Profile"})).toBeVisible();
    await expect(page.getByRole("heading", {name: "Password"})).toBeVisible();
    await expect(page.getByRole("heading", {name: "API Keys"})).toBeVisible();
    await expect(page.getByRole("heading", {name: "Danger Zone"})).toBeVisible();

    // Check form elements
    await expect(page.locator('input[value="john@example.com"]')).toBeVisible();
    await expect(page.getByRole("button", {name: "Save Changes"})).toBeVisible();
    await expect(page.getByRole("button", {name: "Generate New Key"})).toBeVisible();
    await expect(page.getByRole("button", {name: "Delete Account"})).toBeVisible();
  });

  test.skip("upload modal functionality", async ({page}) => {
    // Login first since dashboard is protected
    await loginUser(page);
    await page.goto("/dashboard");

    // Click upload area to open modal
    await page.getByText("Drag files here or click to browse").click();

    // Check modal is visible
    await expect(page.getByRole("heading", {name: "Upload File"})).toBeVisible();
    await expect(page.getByText("Expiration")).toBeVisible();
    await expect(page.getByText("Permissions")).toBeVisible();
    await expect(page.getByRole("button", {name: "Upload"})).toBeVisible();
    await expect(page.getByRole("button", {name: "Cancel"})).toBeVisible();

    // Close modal
    await page.getByRole("button", {name: "Cancel"}).click();
    await expect(page.getByRole("heading", {name: "Upload File"})).not.toBeVisible();
  });

  test.skip("app navigation between pages", async ({page}) => {
    // Login first since app pages are protected
    await loginUser(page);
    // Start at dashboard
    await page.goto("/dashboard");

    // Navigate to file manager
    await page.getByRole("link", {name: "File Manager"}).click();
    await expect(page).toHaveURL("/app/browse");

    // Navigate to settings
    await page.getByRole("link", {name: "Settings"}).click();
    await expect(page).toHaveURL("/app/settings");

    // Navigate back to dashboard
    await page.getByRole("link", {name: "Dashboard"}).click();
    await expect(page).toHaveURL("/dashboard");
  });
});
