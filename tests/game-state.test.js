import test from "node:test";
import assert from "node:assert/strict";
import {
  newMeal,
  addItem,
  total,
  fullness,
  settleKernel,
  checkout,
  removeItem,
  mealSummary,
  CORN_KERNELS,
} from "../src/game-state.js";

test("a mixed lunch can satisfy the objective within the budget", () => {
  const meal = newMeal();
  addItem(meal, "burger");
  addItem(meal, "salad");
  const { item } = addItem(meal, "corn");
  for (let i = 0; i < CORN_KERNELS; i++) settleKernel(meal, item.id, true);
  assert.equal(total(meal), 1450);
  assert.equal(fullness(meal), 87);
  assert.equal(checkout(meal), true);
  assert.equal(mealSummary(meal).success, true);
});
test("missed corn is charged per scoop, with no satisfaction from spilled kernels", () => {
  const meal = newMeal();
  const { item } = addItem(meal, "corn");
  for (let i = 0; i < CORN_KERNELS; i++) settleKernel(meal, item.id, i < 26);
  settleKernel(meal, item.id, true);
  assert.equal(total(meal), 150);
  assert.equal(fullness(meal), 7.5);
  assert.equal(item.landed + item.spilled, CORN_KERNELS);
  assert.equal(removeItem(meal, item.id), false);
});
test("budget cannot be exceeded even with repeated additions", () => {
  const meal = newMeal();
  addItem(meal, "burger");
  addItem(meal, "burger");
  assert.equal(addItem(meal, "corn").ok, false);
  assert.equal(total(meal), 1700);
  assert.equal(meal.items.length, 2);
});
test("empty meals and scoops still in flight cannot check out", () => {
  const meal = newMeal();
  assert.equal(checkout(meal), false);
  const { item } = addItem(meal, "corn");
  assert.equal(checkout(meal), false);
  for (let i = 0; i < CORN_KERNELS; i++) settleKernel(meal, item.id, false);
  assert.equal(checkout(meal), true);
});
test("payment is final and cannot be charged twice or modified", () => {
  const meal = newMeal();
  const { item } = addItem(meal, "noodles");
  assert.equal(checkout(meal), true);
  assert.equal(checkout(meal), false);
  assert.equal(addItem(meal, "sushi").ok, false);
  assert.equal(removeItem(meal, item.id), false);
  assert.equal(total(meal), 650);
});
test("returning an unserved menu item releases budget and satisfaction", () => {
  const meal = newMeal();
  const { item } = addItem(meal, "chicken");
  assert.equal(removeItem(meal, item.id), true);
  assert.equal(total(meal), 0);
  assert.equal(fullness(meal), 0);
});
