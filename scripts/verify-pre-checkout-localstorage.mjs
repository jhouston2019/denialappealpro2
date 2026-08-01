/**
 * E2E: walk analysis-preview → Step 3 unlock, capture localStorage before Stripe redirect.
 * Usage: node scripts/verify-pre-checkout-localstorage.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const root = resolve(process.cwd());
loadEnvFile(resolve(root, ".env.local"));
loadEnvFile(resolve(root, ".env.test"));

const UHC_DENIAL_TEXT = `
UNITEDHEALTHCARE
P.O. Box 740800
Atlanta, GA 30374

Member: Maria Gonzalez
Member ID: UHC987654321
Group: Summit Orthopedic Group
Claim Number: UHC-2026-445821
Provider: Summit Orthopedic Associates
Provider NPI: 1234567893
Date of Service: 01/15/2026
Date Processed: 01/28/2026

CPT/HCPCS: 27447
ICD-10: M17.11
CARC: CO-50
RARC: N386

Billed: $18,500.00
Allowed: $0.00
Paid: $0.00
Denied: $18,500.00

Denial reason: Service denied — not medically necessary per UnitedHealthcare coverage guidelines.
`.trim();

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

async function main() {
  const { chromium } = await import("playwright");

  const captured = {
    localStorage: null,
    checkoutResponse: null,
    errors: [],
    finalUrl: null,
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.route("**/api/create-checkout-session", async (route) => {
    captured.localStorage = await page.evaluate(() => ({
      dap_resume_after_payment: localStorage.getItem("dap_resume_after_payment"),
      dap_wizard_resume: localStorage.getItem("dap_wizard_resume"),
    }));
    captured.checkoutResponse = { intercepted: true, method: route.request().method() };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        url: "https://checkout.stripe.com/c/pay/cs_test_blocked",
      }),
    });
  });

  page.on("pageerror", (err) => captured.errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      captured.errors.push(`console: ${msg.text()}`);
    }
  });

  try {
    await page.goto(`${BASE}/analysis-preview`, { waitUntil: "networkidle" });

    await page.getByRole("tab", { name: /paste/i }).click();
    await page.locator("#denial-paste-text").fill(UHC_DENIAL_TEXT);
    await page.getByRole("button", { name: /extract from text/i }).click();

    await page.getByRole("heading", { name: /review extraction/i }).waitFor({
      timeout: 120_000,
    });

    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await page.getByRole("heading", { name: "Confirm details" }).waitFor({
      timeout: 30_000,
    });

    const fillByLabel = async (label, value) => {
      const input = page
        .locator("label")
        .filter({ hasText: new RegExp(label, "i") })
        .locator("input, textarea")
        .first();
      await input.waitFor({ state: "visible", timeout: 10_000 });
      if (!(await input.inputValue()).trim()) {
        await input.fill(value);
      }
    };

    await fillByLabel("Provider name", "Summit Orthopedic Associates");
    await fillByLabel("Provider NPI", "1234567893");
    await fillByLabel("Provider address", "100 Medical Plaza, Denver, CO 80202");
    await fillByLabel("Provider phone", "303-555-0100");
    await fillByLabel("Signer name", "Dr. James Rivera");
    await fillByLabel("Signer title", "Medical Director");
    await fillByLabel("Primary diagnosis", "Primary osteoarthritis of right knee");

    await page.locator('input[type="radio"][value="erisa-self-funded"]').check();

    const icdField = page
      .locator("label")
      .filter({ hasText: /ICD-10 Code/i })
      .locator("input")
      .first();
    if (await icdField.count()) {
      const v = await icdField.inputValue();
      if (!v.trim()) await icdField.fill("M17.11");
    }

    await page
      .getByRole("button", { name: /unlock my analysis/i })
      .click({ timeout: 15_000 });

    await page.waitForTimeout(2000);
    captured.finalUrl = page.url();
  } catch (err) {
    captured.errors.push(err instanceof Error ? err.message : String(err));
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify(captured, null, 2));

  const resume = captured.localStorage?.dap_resume_after_payment;
  const wizardRaw = captured.localStorage?.dap_wizard_resume;
  if (wizardRaw) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      resolve(root, "scripts/.last-wizard-snapshot.json"),
      wizardRaw,
      "utf8"
    );
  }
  if (resume !== "true" || !wizardRaw) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
