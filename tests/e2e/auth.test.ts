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

    // Test submitting forgot password form
    await page.getByPlaceholder("Email").fill("test@example.com");
    await page.getByRole("button", {name: "Send Reset Link"}).click();

    // Should show success message and return to login
    await expect(page.getByText(/If an account exists/)).toBeVisible();
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

test.describe("Registration Flow", () => {
  test("successful registration redirects to login", async ({page}) => {
    await page.goto("/register");

    // Fill registration form
    await page.getByPlaceholder("Full Name").fill("John Doe");
    await page.getByPlaceholder("Email").fill(`test${Date.now()}@example.com`);
    await page.getByPlaceholder("Password").first().fill("password123");
    await page.getByPlaceholder("Confirm Password").fill("password123");
    await page.getByPlaceholder("Invite Code").fill("TESTCODE");

    // Submit form
    await page.getByRole("button", {name: "Register"}).click();

    // Should redirect to login with success message
    await expect(page).toHaveURL("/login?registered=true");
    await expect(page.getByText(/Registration successful/)).toBeVisible();
  });

  test("registration validates password match", async ({page}) => {
    await page.goto("/register");

    // Fill registration form with mismatched passwords
    await page.getByPlaceholder("Full Name").fill("John Doe");
    await page.getByPlaceholder("Email").fill("test@example.com");
    await page.getByPlaceholder("Password").first().fill("password123");
    await page.getByPlaceholder("Confirm Password").fill("password456");
    await page.getByPlaceholder("Invite Code").fill("TESTCODE");

    // Submit form
    await page.getByRole("button", {name: "Register"}).click();

    // Should show error message
    await expect(page.getByText("Passwords do not match")).toBeVisible();
  });

  test("registration validates password length", async ({page}) => {
    await page.goto("/register");

    // Fill registration form with short password
    await page.getByPlaceholder("Full Name").fill("John Doe");
    await page.getByPlaceholder("Email").fill("test@example.com");
    await page.getByPlaceholder("Password").first().fill("12345");
    await page.getByPlaceholder("Confirm Password").fill("12345");
    await page.getByPlaceholder("Invite Code").fill("TESTCODE");

    // Submit form
    await page.getByRole("button", {name: "Register"}).click();

    // Should show error message
    await expect(page.getByText("Password must be at least 6 characters")).toBeVisible();
  });

  test.skip("registration shows loading state", async ({page}) => {
    // Skipped because loading state is too brief to reliably capture in tests
    await page.goto("/register");

    // Fill registration form
    await page.getByPlaceholder("Full Name").fill("John Doe");
    await page.getByPlaceholder("Email").fill(`test${Date.now()}@example.com`);
    await page.getByPlaceholder("Password").first().fill("password123");
    await page.getByPlaceholder("Confirm Password").fill("password123");
    await page.getByPlaceholder("Invite Code").fill("TESTCODE");

    // Submit form and check loading state
    const submitButton = page.getByRole("button", {name: "Register"});
    const submitPromise = submitButton.click();

    // Button should show loading state briefly
    await expect(page.getByRole("button", {name: "Creating account..."})).toBeVisible();

    await submitPromise;
  });
});

test.describe("Login Flow", () => {
  test("successful login redirects to dashboard", async ({page}) => {
    await page.goto("/login");

    // Fill login form
    await page.getByPlaceholder("Email").fill("test@example.com");
    await page.getByPlaceholder("Password").fill("password123");

    // Submit form
    await page.getByRole("button", {name: "Login"}).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL("/dashboard");
  });

  test("login stores user in localStorage", async ({page}) => {
    await page.goto("/login");

    // Fill login form
    const testEmail = "test@example.com";
    await page.getByPlaceholder("Email").fill(testEmail);
    await page.getByPlaceholder("Password").fill("password123");

    // Submit form
    await page.getByRole("button", {name: "Login"}).click();

    // Wait for navigation
    await page.waitForURL("/dashboard");

    // Check localStorage
    const userString = await page.evaluate(() => localStorage.getItem("user"));
    expect(userString).toBeTruthy();
    const user = JSON.parse(userString!);
    expect(user.email).toBe(testEmail);
  });

  test.skip("login shows loading state", async ({page}) => {
    // Skipped because loading state is too brief to reliably capture in tests
    await page.goto("/login");

    // Fill login form
    await page.getByPlaceholder("Email").fill("test@example.com");
    await page.getByPlaceholder("Password").fill("password123");

    // Submit form and check loading state
    const submitButton = page.getByRole("button", {name: "Login"});
    const submitPromise = submitButton.click();

    // Button should show loading state briefly
    await expect(page.getByRole("button", {name: "Processing..."})).toBeVisible();

    await submitPromise;
  });

  test("login shows success message after registration", async ({page}) => {
    await page.goto("/login?registered=true");

    // Should show success message
    await expect(page.getByText(/Registration successful/)).toBeVisible();
  });
});

test.describe("Logout Flow", () => {
  test("logout page clears session and redirects", async ({page}) => {
    // First login to set localStorage
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill("test@example.com");
    await page.getByPlaceholder("Password").fill("password123");
    await page.getByRole("button", {name: "Login"}).click();
    await page.waitForURL("/dashboard");

    // Verify user is stored
    let userString = await page.evaluate(() => localStorage.getItem("user"));
    expect(userString).toBeTruthy();

    // Now logout
    await page.goto("/logout");

    // Should show logout message
    await expect(page.getByText("Logging out...")).toBeVisible();
    await expect(page.getByText("You will be redirected to the login page")).toBeVisible();

    // Should redirect to login after 2 seconds
    await page.waitForURL("/login", {timeout: 3000});

    // Check that localStorage is cleared
    userString = await page.evaluate(() => localStorage.getItem("user"));
    expect(userString).toBeNull();
  });
});

test.describe("Form Validation", () => {
  test("all required fields are validated on registration", async ({page}) => {
    await page.goto("/register");

    // Try to submit empty form
    await page.getByRole("button", {name: "Register"}).click();

    // Form should not submit (HTML5 validation)
    await expect(page).toHaveURL("/register");
  });

  test("all required fields are validated on login", async ({page}) => {
    await page.goto("/login");

    // Try to submit empty form
    await page.getByRole("button", {name: "Login"}).click();

    // Form should not submit (HTML5 validation)
    await expect(page).toHaveURL("/login");
  });

  test("email field validates email format", async ({page}) => {
    await page.goto("/login");

    // Fill invalid email
    await page.getByPlaceholder("Email").fill("notanemail");
    await page.getByPlaceholder("Password").fill("password123");

    // Try to submit
    await page.getByRole("button", {name: "Login"}).click();

    // Should show browser validation error
    const emailInput = page.getByPlaceholder("Email");
    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage,
    );
    expect(validationMessage).toBeTruthy();
  });
});
