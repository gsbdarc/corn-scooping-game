import { test, expect } from "@playwright/test";

async function begin(page) {
  await page.goto("/");
  await expect(page.locator("#start")).toBeEnabled({ timeout: 45000 });
  await page.locator("#start").click();
  await expect
    .poll(() => page.evaluate(() => window.__arbuckle.state().mode))
    .toBe("walk");
}
async function visit(page, id) {
  await page.evaluate((id) => window.__arbuckle.teleport(id), id);
  await page.keyboard.press("e");
}
async function pointScoop(page, x, z) {
  const point = await page.evaluate(
    ({ x, z }) => {
      const camera = window.__arbuckle.camera;
      const p = camera.position.clone().set(x, 1.3, z).project(camera);
      return {
        x: ((p.x + 1) * innerWidth) / 2,
        y: ((1 - p.y) * innerHeight) / 2,
      };
    },
    { x, z },
  );
  await page.mouse.move(point.x, point.y);
}
async function scoop(page, land = true) {
  await pointScoop(page, -0.7, -8.6);
  await page.mouse.down();
  await expect
    .poll(() => page.evaluate(() => window.__arbuckle.corn.phase))
    .toBe("loaded");
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.__arbuckle.corn.phase))
    .toBe("lifted");
  await pointScoop(page, land ? 1.15 : -0.1, -8.57);
  await page.waitForTimeout(450);
  await page.mouse.down();
  await expect
    .poll(() => page.evaluate(() => window.__arbuckle.corn.phase))
    .toBe("empty");
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__arbuckle
          .state()
          .meal.items.filter((i) => i.key === "corn")
          .every((i) => i.landed + i.spilled === 52),
      ),
    )
    .toBe(true);
}
test("walk, order, manually scoop and spill, then pay Lilybeth and replay", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await begin(page);
  const start = await page.evaluate(() => window.__arbuckle.state().position);
  await page.keyboard.down("w");
  await page.waitForTimeout(800);
  await page.keyboard.up("w");
  expect(
    (await page.evaluate(() => window.__arbuckle.state().position))[2],
  ).toBeLessThan(start[2] - 0.4);
  await visit(page, "grill");
  await page.locator('[data-add="burger"]').click();
  await page.keyboard.press("e");
  await visit(page, "salad");
  await page.locator('[data-add="salad"]').click();
  await page.keyboard.press("e");
  await visit(page, "corn");
  await expect(page.locator("#scoop-ui")).toBeVisible();
  await scoop(page, true);
  let state = await page.evaluate(() => window.__arbuckle.state());
  expect(state.meal.items.at(-1).landed).toBeGreaterThan(45);
  await scoop(page, false);
  state = await page.evaluate(() => window.__arbuckle.state());
  expect(state.meal.items.at(-1).spilled).toBe(52);
  expect(state.summary.spent).toBe(1600);
  await page.screenshot({ path: "references/test-corn.png" });
  await page.keyboard.press("e");
  await visit(page, "checkout");
  await expect(page.getByText("Just a little queue.")).toBeVisible();
  await expect(page.getByText("“Sir Mason, I saw Jeff earlier!”")).toBeVisible({
    timeout: 25000,
  });
  await page.screenshot({ path: "references/test-lilybeth.png" });
  await page.locator('[data-action="pay"]').click();
  await expect(page.getByText("A lunch well spent.")).toBeVisible();
  await expect(page.locator(".receipt-total")).toContainText("$16.00");
  await page.screenshot({ path: "references/test-receipt.png" });
  await page.locator("#help").click();
  await page.locator('[data-action="resume"]').first().click();
  expect((await page.evaluate(() => window.__arbuckle.state())).meal.paid).toBe(
    true,
  );
  await page.locator('[data-action="restart"]').click();
  state = await page.evaluate(() => window.__arbuckle.state());
  expect(state.summary.spent).toBe(0);
  expect(state.meal.paid).toBe(false);
  expect(errors).toEqual([]);
});
test("all remaining stations, returns, budget limits, pause and collisions", async ({
  page,
}) => {
  await begin(page);
  await page.evaluate(() =>
    window.__arbuckle.camera.position.set(-2.9, 1.66, 4.8),
  );
  await page.keyboard.press("e");
  await expect(page.locator("#panel-title")).toHaveText("Greens");
  await page.keyboard.press("e");
  await visit(page, "sushi");
  await page.locator('[data-add="sushi"]').click();
  await page.keyboard.press("e");
  await visit(page, "asian");
  await page.locator('[data-add="noodles"]').click();
  await expect(page.locator('[data-add="tofu"]')).toBeDisabled();
  await page.keyboard.press("e");
  await visit(page, "drinks");
  await page.locator('[data-add="water"]').click();
  await page.keyboard.press("e");
  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: "Remove Sesame noodle bowl" }).click();
  expect(
    (await page.evaluate(() => window.__arbuckle.state())).summary.spent,
  ).toBe(700);
  await page.locator('[data-action="back"]').first().click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#quality")).toBeVisible();
  await page.locator("#quality").selectOption("low");
  await page.locator('[data-action="resume"]').first().click();
  await page.evaluate(() => window.__arbuckle.teleport("grill"));
  await page.keyboard.down("w");
  await page.waitForTimeout(1800);
  await page.keyboard.up("w");
  expect(
    (await page.evaluate(() => window.__arbuckle.state())).position[2],
  ).toBeGreaterThan(-7.8);
});

test("repeated scoops build a pile and eventually overflow without losing charges", async ({
  page,
}) => {
  await begin(page);
  await visit(page, "corn");
  for (let i = 0; i < 8; i++) await scoop(page, true);
  const state = await page.evaluate(() => window.__arbuckle.state());
  expect(state.summary.spent).toBe(1200);
  expect(state.summary.scoops).toBe(8);
  expect(state.summary.spilled).toBe(86);
  const pile = await page.evaluate(() =>
    window.__arbuckle.dish.children
      .filter((c) => c.userData.kernel)
      .map((c) => c.position.y),
  );
  expect(pile.length).toBe(330);
  expect(Math.max(...pile)).toBeGreaterThan(0.06);
  await page.screenshot({ path: "references/test-overflow.png" });
  await page.keyboard.press("e");
  await expect
    .poll(() => page.evaluate(() => window.__arbuckle.state().mode))
    .toBe("walk");
});
