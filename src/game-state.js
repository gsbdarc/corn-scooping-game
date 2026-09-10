export const BUDGET = 1800;
export const TARGET = 80;
export const CORN_KERNELS = 52;
export const MENU = {
  corn: {
    name: "Sweet buttered corn",
    price: 150,
    fullness: 15,
    station: "corn",
    kind: "corn",
    note: "One generous scoop. Yours to pour.",
  },
  burger: {
    name: "Market cheeseburger",
    price: 850,
    fullness: 48,
    station: "grill",
    kind: "burger",
    note: "Grilled patty, cheddar, lettuce & a toasted bun.",
  },
  chicken: {
    name: "Herb-grilled chicken",
    price: 700,
    fullness: 42,
    station: "grill",
    kind: "chicken",
    note: "A golden grilled chicken breast with fresh herbs.",
  },
  salad: {
    name: "Garden salad",
    price: 450,
    fullness: 24,
    station: "salad",
    kind: "salad",
    note: "Leafy greens, cherry tomatoes & cucumber.",
  },
  grain: {
    name: "Harvest grain bowl",
    price: 600,
    fullness: 36,
    station: "salad",
    kind: "grain",
    note: "Quinoa, roasted vegetables & tender greens.",
  },
  sushi: {
    name: "Salmon & avocado rolls",
    price: 700,
    fullness: 34,
    station: "sushi",
    kind: "sushi",
    note: "Six freshly made rolls, with a little wasabi.",
  },
  veggie: {
    name: "Cucumber avocado rolls",
    price: 550,
    fullness: 28,
    station: "sushi",
    kind: "sushi",
    note: "Six vegetable rolls. Fresh, simple, satisfying.",
  },
  noodles: {
    name: "Sesame noodle bowl",
    price: 650,
    fullness: 40,
    station: "asian",
    kind: "noodles",
    note: "Warm noodles, bok choy & toasted sesame.",
  },
  tofu: {
    name: "Ginger tofu & rice",
    price: 700,
    fullness: 44,
    station: "asian",
    kind: "tofu",
    note: "Golden tofu over rice with ginger vegetables.",
  },
  tea: {
    name: "Fresh iced tea",
    price: 200,
    fullness: 4,
    station: "drinks",
    kind: "drink",
    note: "A cool glass of lightly brewed black tea.",
  },
  water: {
    name: "Water",
    price: 0,
    fullness: 0,
    station: "drinks",
    kind: "drink",
    note: "A little refreshment, on the house.",
  },
};
export const money = (cents) => `$${(cents / 100).toFixed(2)}`;
export function newMeal() {
  return { items: [], paid: false, nextId: 1 };
}
export function total(meal) {
  return meal.items.reduce((sum, i) => sum + MENU[i.key].price, 0);
}
export function fullness(meal) {
  return Math.min(
    100,
    meal.items.reduce(
      (sum, i) =>
        sum +
        MENU[i.key].fullness * (i.key === "corn" ? i.landed / CORN_KERNELS : 1),
      0,
    ),
  );
}
export function addItem(meal, key) {
  if (meal.paid || !MENU[key])
    return { ok: false, reason: "This meal is already complete." };
  if (total(meal) + MENU[key].price > BUDGET)
    return { ok: false, reason: "That would go over your $18 lunch budget." };
  if (meal.items.length >= 18)
    return { ok: false, reason: "Your plate is full. Time to see Lilybeth!" };
  const item = {
    id: meal.nextId++,
    key,
    landed: key === "corn" ? 0 : null,
    spilled: 0,
  };
  meal.items.push(item);
  return { ok: true, item };
}
export function settleKernel(meal, id, landed) {
  const item = meal.items.find((i) => i.id === id);
  if (
    !item ||
    item.key !== "corn" ||
    meal.paid ||
    item.landed + item.spilled >= CORN_KERNELS
  )
    return;
  item[landed ? "landed" : "spilled"]++;
}
export function removeItem(meal, id) {
  const item = meal.items.find((i) => i.id === id);
  if (meal.paid || !item || item.key === "corn") return false;
  meal.items = meal.items.filter((i) => i.id !== id);
  return true;
}
export function checkout(meal) {
  if (
    meal.paid ||
    meal.items.length === 0 ||
    total(meal) > BUDGET ||
    meal.items.some(
      (i) => i.key === "corn" && i.landed + i.spilled < CORN_KERNELS,
    )
  )
    return false;
  meal.paid = true;
  return true;
}
export function mealSummary(meal) {
  return {
    spent: total(meal),
    remaining: BUDGET - total(meal),
    fullness: Math.round(fullness(meal)),
    success: fullness(meal) >= TARGET,
    scoops: meal.items.filter((i) => i.key === "corn").length,
    spilled: meal.items.reduce((sum, i) => sum + i.spilled, 0),
  };
}
