import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

/**
 * Fully isolated Playwright sanity suite for Olar Social.
 * Runs against a live server at http://localhost:3000 as a real browser user.
 * Does not modify any React / CSS / app source.
 */

const BRAND = "אולר סושיאל";

/** Severe console / page errors collected during navigation audits. */
function isBenignConsole(msg: ConsoleMessage): boolean {
  const text = msg.text();
  const type = msg.type();
  if (type !== "error") return true;
  // Next.js / React DevTools / hydration noise common in dev
  const benign = [
    /Download the React DevTools/i,
    /\[HMR\]/i,
    /\[Fast Refresh\]/i,
    /favicon\.ico/i,
    /Failed to load resource:.*favicon/i,
    /net::ERR_ABORTED.*favicon/i,
    /Third-party cookie/i,
    /Deprecated/i,
  ];
  return benign.some((re) => re.test(text));
}

async function ensureMainShell(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await test.step("Reach main shell (onboarding or already done)", async () => {
    const landInput = page.getByLabel("שם עסק ועיר").or(
      page.getByPlaceholder(/הקלד שם עסק|שם עסק|עיר/)
    );
    const menuBtn = page.getByRole("button", { name: "פתיחת תפריט" });
    const brandInHeader = page.getByText(BRAND, { exact: true }).first();

    // Wait briefly for either onboarding land OR main shell
    const landed = await Promise.race([
      landInput
        .waitFor({ state: "visible", timeout: 12_000 })
        .then(() => "onboarding" as const),
      menuBtn
        .waitFor({ state: "visible", timeout: 12_000 })
        .then(() => "shell" as const),
      brandInHeader
        .waitFor({ state: "visible", timeout: 12_000 })
        .then(() => "shell" as const),
    ]).catch(() => "unknown" as const);

    if (landed === "shell") {
      await expect(menuBtn).toBeVisible({ timeout: 10_000 });
      return;
    }

    if (landed === "onboarding" || (await landInput.isVisible().catch(() => false))) {
      await landInput.fill("מוסך בדיקה תל אביב");
      await page.getByRole("button", { name: /תראה לי את הקסם|קסם/ }).click();

      // Working phase (~7s) → payoff
      const saveCta = page.getByRole("button", {
        name: /שמור את הדף שלי והתחל להשתמש במערכת/,
      });
      await expect(saveCta).toBeVisible({ timeout: 25_000 });
      await saveCta.click();

      const guest = page.getByRole("button", { name: "המשך כאורח" });
      await expect(guest).toBeVisible({ timeout: 10_000 });
      await guest.click();
    }

    await expect(menuBtn).toBeVisible({ timeout: 15_000 });
  });
}

async function openSideMenu(page: Page): Promise<void> {
  const menuBtn = page.getByRole("button", { name: "פתיחת תפריט" });
  await menuBtn.click();
  await expect(page.getByRole("dialog", { name: "תפריט" })).toBeVisible();
}

async function navigateViaMenu(page: Page, label: string | RegExp): Promise<void> {
  await openSideMenu(page);
  const drawer = page.getByRole("dialog", { name: "תפריט" });
  await drawer.getByRole("button", { name: label }).click();
  // Drawer should close after navigate
  await expect(drawer).toBeHidden({ timeout: 8_000 }).catch(async () => {
    // Some builds keep aria-hidden; ensure content switched
    await page.waitForTimeout(300);
  });
}

test.describe.configure({ mode: "serial" });

test.describe("Olar Social — system audit", () => {
  test.beforeEach(async ({ page }) => {
    await ensureMainShell(page);
  });

  test("1: Branding & RTL — brand in header, menu on the right", async ({
    page,
  }) => {
    await test.step("Brand appears in header/top", async () => {
      const brand = page.locator("header").getByText(BRAND, { exact: true });
      await expect(
        brand,
        `Expected brand "${BRAND}" in the top header`
      ).toBeVisible();
    });

    await test.step("Menu open button is on the RIGHT (RTL)", async () => {
      const menuBtn = page.getByRole("button", { name: "פתיחת תפריט" });
      await expect(menuBtn).toBeVisible();

      const logo = page.locator("header").getByText(BRAND, { exact: true });
      const menuBox = await menuBtn.boundingBox();
      const logoBox = await logo.boundingBox();
      expect(menuBox, "Menu button should have a bounding box").toBeTruthy();
      expect(logoBox, "Brand/logo text should have a bounding box").toBeTruthy();

      const viewport = page.viewportSize();
      const nearRightEdge =
        !!viewport &&
        menuBox!.x + menuBox!.width / 2 > viewport.width * 0.55;

      const menuRightOfLogo = menuBox!.x > logoBox!.x;

      expect(
        menuRightOfLogo || nearRightEdge,
        `RTL menu should sit on the right (menu.x=${menuBox!.x.toFixed(0)}, logo.x=${logoBox!.x.toFixed(0)}, viewport=${viewport?.width}). ` +
          `If this fails, the hamburger is likely on the left — UI layout issue, not a test-config issue.`
      ).toBeTruthy();
    });
  });

  test("2: Quick View default — mode pill, daily update, 3 action cards", async ({
    page,
  }) => {
    await test.step('Ensure "מבט מהיר" is active', async () => {
      const quickPill = page.getByRole("button", { name: "מבט מהיר" });
      await expect(quickPill).toBeVisible();
      const pressed = await quickPill.getAttribute("aria-pressed");
      if (pressed !== "true") {
        await quickPill.click();
      }
      await expect(quickPill).toHaveAttribute("aria-pressed", "true");
      // Heading / mode signal on the quick home
      await expect(page.getByRole("heading", { name: "מבט מהיר" })).toBeVisible({
        timeout: 10_000,
      });
    });

    await test.step('Card "עדכון יומי מהסוכן" exists', async () => {
      const daily = page.getByText("עדכון יומי מהסוכן", { exact: false });
      await expect(
        daily.first(),
        'Expected card titled "עדכון יומי מהסוכן" on Quick View. ' +
          "If missing, the daily agent update card has not landed in the UI yet."
      ).toBeVisible({ timeout: 8_000 });
    });

    await test.step("Three daily action cards (or their titles)", async () => {
      // Quick View sections that act as the day's action cards
      const titles = [
        "מה מפרסמים היום",
        "מחכים שתחזור אליהם",
        "הדף שלך ברשת",
      ];
      for (const title of titles) {
        await expect(
          page.getByRole("heading", { name: title }).or(page.getByText(title)),
          `Expected Quick View action card / section: "${title}"`
        ).toBeVisible();
      }
    });
  });

  test("3: Mode toggle — full board and back to Quick View", async ({
    page,
  }) => {
    await test.step('Click "לוח עבודה מלא" → full board', async () => {
      const modeGroup = page.getByRole("group", { name: "בחירת מצב עבודה" });
      const fullBtn = modeGroup.getByRole("button", { name: "לוח עבודה מלא" });
      await fullBtn.click();
      await expect(fullBtn).toHaveAttribute("aria-pressed", "true");
      // Full dashboard home title / greeting signal
      await expect(
        page
          .getByText("העסק שלי היום")
          .or(page.getByText("מה נעשה היום?"))
          .or(page.getByRole("heading", { name: /שלום/ }))
          .first()
      ).toBeVisible({ timeout: 10_000 });
    });

    await test.step('Click "מבט מהיר" → returns smoothly', async () => {
      const quickBtn = page.getByRole("button", { name: "מבט מהיר" });
      await quickBtn.click();
      await expect(quickBtn).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("heading", { name: "מבט מהיר" })).toBeVisible({
        timeout: 10_000,
      });
    });
  });

  test("4: Navigate all screens — no severe console / 500 errors", async ({
    page,
  }) => {
    const severe: string[] = [];

    page.on("console", (msg) => {
      if (!isBenignConsole(msg)) {
        severe.push(`[console.${msg.type()}] ${msg.text()}`);
      }
    });
    page.on("pageerror", (err) => {
      severe.push(`[pageerror] ${err.message}`);
    });
    page.on("response", (res) => {
      if (res.status() >= 500 && res.url().includes("localhost:3000")) {
        severe.push(`[HTTP ${res.status()}] ${res.url()}`);
      }
    });

    const screens: { label: string | RegExp; expectText: string | RegExp }[] = [
      { label: "אנשים שפנו אליי", expectText: /אנשים שפנו אליי|מי כתב/ },
      {
        label: /סוכן שיווק AI|תכתוב לי פוסט/,
        expectText: /סוכן שיווק AI|תכתוב לי פוסט|אין לי מה לפרסם/,
      },
      { label: "מה מפרסמים ומתי", expectText: /מה מפרסמים ומתי|שבועי|חודשי/ },
      { label: "מה עבד השבוע?", expectText: /מה עבד השבוע|סיכום פשוט|כמה אנשים ראו/ },
    ];

    for (const screen of screens) {
      await test.step(`Open: ${String(screen.label)}`, async () => {
        await navigateViaMenu(page, screen.label);
        await expect(page.getByText(screen.expectText).first()).toBeVisible({
          timeout: 12_000,
        });
        // Soft check: body is not a raw Next 500 page
        const bodyText = await page.locator("body").innerText();
        expect(
          bodyText,
          "Page must not be a Next.js 500 / Application error screen"
        ).not.toMatch(/Application error|Internal Server Error|HTTP ERROR 500/i);
      });
    }

    expect(
      severe,
      `Severe console/page/HTTP errors while navigating:\n${severe.join("\n")}`
    ).toEqual([]);
  });

  test('5: Bio page — "הדף שלי באינטרנט" loads, content visible', async ({
    page,
  }) => {
    await test.step("Open bio / my page", async () => {
      await navigateViaMenu(page, /הדף שלי באינטרנט|הדף שלי/);
      await expect(
        page.getByText(/הדף שלי באינטרנט|הדף פעיל|העתק קישור/).first()
      ).toBeVisible({ timeout: 12_000 });
    });

    await test.step("Visible content / no obvious nested overflow trap", async () => {
      const main = page.locator("main");
      await expect(main).toBeVisible();
      const box = await main.boundingBox();
      expect(box, "main should have layout box").toBeTruthy();
      expect(box!.height, "main should have visible height").toBeGreaterThan(80);

      // Soft nested-overflow check: at least one meaningful block is in viewport
      const sample = page
        .getByText(/העתק קישור|וואטסאפ|שירותים|הדף שלי באינטרנט/)
        .first();
      await expect(sample).toBeVisible();
      const sampleBox = await sample.boundingBox();
      expect(sampleBox, "Bio content should be laid out on screen").toBeTruthy();
      expect(sampleBox!.y).toBeGreaterThanOrEqual(0);
    });
  });
});
