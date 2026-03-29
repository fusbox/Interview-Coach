import { expect, test } from "@playwright/test";

test("recruiter auth and settings smoke covers login, settings load, cancel, and save", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Recruiter Portal" })).toBeVisible();

    await page.getByRole("button", { name: /Create Account/i }).click();
    await expect(page.locator("form").getByRole("button", { name: "Create Account" })).toBeVisible();

    await page.getByRole("button", { name: /Show password/i }).click();
    await expect(page.getByLabel("Hide password")).toBeVisible();
    await page.getByRole("button", { name: /Hide password/i }).click();

    await page.getByRole("button", { name: /Sign In/i }).first().click();
    await page.getByLabel("Email Address").fill("e2e.recruiter@example.com");
    await page.locator("#password").fill("password-123");
    await page.locator("form").getByRole("button", { name: /^Sign In$/ }).click();

    await page.waitForURL("**/recruiter/create");
    await expect(page.getByRole("heading", { name: "Job Details & Questions" })).toBeVisible();

    await page.goto("/recruiter/settings");
    await expect(page.getByRole("heading", { name: "Account Settings" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Your Job Title/i })).toHaveValue("QA Recruiter");
    await expect(page.getByText("All changes saved")).toBeVisible();

    const titleInput = page.getByRole("textbox", { name: /Your Job Title/i });
    await titleInput.fill("Principal Recruiting Partner");
    await expect(page.getByText("Unsaved changes")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(titleInput).toHaveValue("QA Recruiter");
    await expect(page.getByText("All changes saved")).toBeVisible();

    await titleInput.fill("Principal Recruiting Partner");
    await page.getByRole("button", { name: /Save Changes/i }).click();

    await expect(page.getByText("Profile updated successfully.")).toBeVisible();
    await expect(titleInput).toHaveValue("Principal Recruiting Partner");
    await expect(page.getByText("All changes saved")).toBeVisible();
});
