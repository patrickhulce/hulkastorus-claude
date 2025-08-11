import {test, expect} from "@playwright/test";

test("has title", async ({page}) => {
  await page.goto("/");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Hulkastorus/);
});

test("homepage navigation links", async ({page}) => {
  await page.goto("/");

  // Check navigation links - use first() to select the nav bar links specifically
  await expect(page.getByRole("link", {name: "Docs"}).first()).toBeVisible();
  await expect(page.getByRole("link", {name: "Login"})).toBeVisible();
  await expect(page.getByRole("link", {name: "Request Invite"}).first()).toBeVisible();
});

test("hero section content", async ({page}) => {
  await page.goto("/");

  // Check hero section
  await expect(page.getByRole("heading", {name: "Hulkastorus"})).toBeVisible();
  await expect(
    page.getByText("Simple file storage and sharing without the overhead"),
  ).toBeVisible();
  await expect(page.getByRole("link", {name: "Read the Docs"})).toBeVisible();
});

test("feature cards visible", async ({page}) => {
  await page.goto("/");

  // Check feature cards
  await expect(page.getByText("No Complexity")).toBeVisible();
  await expect(page.getByText("Developer Friendly")).toBeVisible();
  await expect(page.getByText("Fast & Reliable")).toBeVisible();
});

test("pricing section", async ({page}) => {
  await page.goto("/");

  // Check pricing section
  await expect(page.getByRole("heading", {name: "Pricing"})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Free"})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Pro"})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Tres Commas"})).toBeVisible();
});
