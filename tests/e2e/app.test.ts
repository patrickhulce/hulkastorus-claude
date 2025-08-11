import {test, expect} from "@playwright/test";

test.describe("App Pages", () => {
  test("dashboard page loads correctly", async ({page}) => {
    await page.goto("/app/dashboard");

    // Check page title
    await expect(page).toHaveTitle(/Hulkastorus/);

    // Check sidebar navigation
    await expect(page.getByText("Hulkastorus").first()).toBeVisible();
    await expect(page.getByRole("link", {name: "Dashboard"})).toBeVisible();
    await expect(page.getByRole("link", {name: "File Manager"})).toBeVisible();
    await expect(page.getByRole("link", {name: "Settings"})).toBeVisible();

    // Check main content
    await expect(page.getByRole("heading", {name: "Welcome to Hulkastorus"})).toBeVisible();
    await expect(page.getByText("Drag files here or click to browse")).toBeVisible();

    // Check stats cards
    await expect(page.getByText("Total Files")).toBeVisible();
    await expect(page.getByText("Storage Used")).toBeVisible();
    await expect(page.getByText("Recent Uploads")).toBeVisible();
  });

  test("file manager page loads correctly", async ({page}) => {
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

  test("settings page loads correctly", async ({page}) => {
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

  test("upload modal functionality", async ({page}) => {
    await page.goto("/app/dashboard");

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

  test("app navigation between pages", async ({page}) => {
    // Start at dashboard
    await page.goto("/app/dashboard");

    // Navigate to file manager
    await page.getByRole("link", {name: "File Manager"}).click();
    await expect(page).toHaveURL("/app/browse");

    // Navigate to settings
    await page.getByRole("link", {name: "Settings"}).click();
    await expect(page).toHaveURL("/app/settings");

    // Navigate back to dashboard
    await page.getByRole("link", {name: "Dashboard"}).click();
    await expect(page).toHaveURL("/app/dashboard");
  });
});
