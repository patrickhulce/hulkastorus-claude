import {test, expect} from "@playwright/test";

test.describe("Documentation Page", () => {
  test("docs page loads correctly", async ({page}) => {
    await page.goto("/docs");

    // Check page title
    await expect(page).toHaveTitle(/Hulkastorus/);

    // Check navigation
    await expect(page.getByRole("link", {name: "Docs"})).toBeVisible();
    await expect(page.getByRole("link", {name: "Login"})).toBeVisible();

    // Check sidebar navigation
    await expect(page.getByRole("link", {name: "Getting Started"})).toBeVisible();
    await expect(page.getByRole("link", {name: "API Reference"})).toBeVisible();
    await expect(page.getByRole("link", {name: "FAQ"})).toBeVisible();

    // Check main content
    await expect(page.getByRole("heading", {name: "Documentation"})).toBeVisible();
    await expect(page.getByRole("heading", {name: "Getting Started"})).toBeVisible();
    await expect(page.getByRole("heading", {name: "API Reference"})).toBeVisible();
    await expect(page.getByRole("heading", {name: "FAQ"})).toBeVisible();

    // Check code examples
    await expect(page.getByText("npm install @hulkastorus/client")).toBeVisible();
    await expect(page.getByText("POST /api/files")).toBeVisible();
    await expect(page.getByText("GET /files/:id")).toBeVisible();
  });

  test("sidebar navigation highlights current section", async ({page}) => {
    await page.goto("/docs");

    // Check that navigation items are interactive
    const gettingStartedLink = page.getByRole("link", {name: "Getting Started"});
    const apiReferenceLink = page.getByRole("link", {name: "API Reference"});
    const faqLink = page.getByRole("link", {name: "FAQ"});

    await expect(gettingStartedLink).toBeVisible();
    await expect(apiReferenceLink).toBeVisible();
    await expect(faqLink).toBeVisible();

    // Test clicking navigation items
    await apiReferenceLink.click();
    await expect(page).toHaveURL("/docs#api-reference");

    await faqLink.click();
    await expect(page).toHaveURL("/docs#faq");

    await gettingStartedLink.click();
    await expect(page).toHaveURL("/docs#getting-started");
  });

  test("navigation between docs and main site", async ({page}) => {
    await page.goto("/docs");

    // Navigate to home
    await page.getByText("Hulkastorus").first().click();
    await expect(page).toHaveURL("/");

    // Navigate back to docs
    await page.getByRole("link", {name: "Docs"}).first().click();
    await expect(page).toHaveURL("/docs");

    // Navigate to login
    await page.getByRole("link", {name: "Login"}).click();
    await expect(page).toHaveURL("/login");
  });
});
