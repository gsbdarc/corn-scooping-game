import "./style.css";
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createWorld } from "./world.js";
import { createPeople } from "./people.js";
import { hand, plate } from "./geometry.js";
import { food } from "./food.js";
import { CornInteraction } from "./corn.js";
import { STATIONS, SPAWN } from "./layout.js";
import {
  BUDGET,
  TARGET,
  MENU,
  money,
  newMeal,
  total,
  fullness,
  addItem,
  removeItem,
  checkout,
  mealSummary,
} from "./game-state.js";
const $ = (s) => document.querySelector(s);
const canvas = $("#world");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
} catch (e) {
  $("#fatal").hidden = false;
  $("#fatal-message").textContent =
    "This game needs WebGL. Try opening it in an up-to-date Chrome or Safari browser with hardware acceleration enabled.";
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const { scene, colliders, seats, sun } = createWorld(renderer);
const camera = new THREE.PerspectiveCamera(
  65,
  innerWidth / innerHeight,
  0.04,
  130,
);
camera.position.set(SPAWN.x, 1.66, SPAWN.z);
camera.rotation.order = "YXZ";
camera.rotation.y = SPAWN.yaw;
scene.add(camera);
const composer = new EffectComposer(renderer);
composer.setPixelRatio(Math.min(devicePixelRatio, 1.4));
composer.addPass(new RenderPass(scene, camera));
const ambientOcclusion = new SSAOPass(
  scene,
  camera,
  innerWidth,
  innerHeight,
  12,
);
ambientOcclusion.kernelRadius = 0.42;
ambientOcclusion.minDistance = 0.001;
ambientOcclusion.maxDistance = 0.018;
composer.addPass(ambientOcclusion);
composer.addPass(new OutputPass());
let graphicsHigh = true;
const controls = new PointerLockControls(camera, canvas);
controls.pointerSpeed = 0.65;
controls.minPolarAngle = 0.5;
controls.maxPolarAngle = 2.55;
let mode = "welcome",
  meal = newMeal(),
  people = null,
  activeStation = null,
  nearby = null,
  queueElapsed = 0,
  queueDone = false,
  queueActive = false,
  soundEnabled = true,
  reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches,
  toastTimer = null,
  audio = null,
  elapsed = 0,
  walkTime = 0,
  previousTime = 0,
  previousMode = "walk";
const keys = new Set();
const viewRig = new THREE.Group();
camera.add(viewRig);
viewRig.visible = false;
const dish = new THREE.Group();
viewRig.add(dish);
dish.position.set(0, -0.39, -0.63);
plate(dish, 0.235);
const left = hand(viewRig, { side: -1, sleeve: "#c7c1ae" });
left.position.set(-0.2, -0.405, -0.51);
left.rotation.y = 0.18;
const right = hand(viewRig, { side: 1, sleeve: "#c7c1ae" });
right.position.set(0.2, -0.405, -0.51);
right.rotation.y = -0.18;
const overlay = $("#overlay");
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3300);
}
function playSound(kind) {
  if (!soundEnabled) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const now = audio.currentTime;
    const osc = audio.createOscillator(),
      gain = audio.createGain();
    osc.connect(gain);
    gain.connect(audio.destination);
    const config = {
      pick: [620, 0.1, 0.032],
      scoop: [230, 0.18, 0.025],
      pour: [970, 0.13, 0.016],
      pay: [860, 0.2, 0.04],
      click: [430, 0.06, 0.019],
    }[kind] || [440, 0.08, 0.02];
    osc.type = kind === "scoop" ? "triangle" : "sine";
    osc.frequency.setValueAtTime(config[0], now);
    osc.frequency.exponentialRampToValueAtTime(
      config[0] * 0.65,
      now + config[1],
    );
    gain.gain.setValueAtTime(config[2], now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + config[1]);
    osc.start(now);
    osc.stop(now + config[1]);
    if (kind === "scoop" || kind === "pour") {
      const buffer = audio.createBuffer(
        1,
        audio.sampleRate * 0.13,
        audio.sampleRate,
      );
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * 0.13 * (1 - i / data.length);
      const s = audio.createBufferSource(),
        g = audio.createGain();
      s.buffer = buffer;
      g.gain.value = 0.16;
      s.connect(g);
      g.connect(audio.destination);
      s.start();
    }
  } catch {
    /* Sound is optional when browser audio is unavailable. */
  }
}
function updateHUD() {
  const f = fullness(meal),
    cost = total(meal);
  $("#spent").innerHTML = `${money(cost)} <small>/ $18.00</small>`;
  $("#fullness").textContent = `${Math.round(f)} / ${TARGET}`;
  $("#hunger-fill").style.width = `${f}%`;
  $("#hunger-label").textContent =
    f >= TARGET
      ? "A satisfying plate"
      : f > 35
        ? "Getting there"
        : "A little hungry";
  $("#objective").textContent =
    f >= TARGET
      ? "Looking good. Head to Lilybeth!"
      : `${money(BUDGET - cost)} left to build your meal.`;
  const scoops = meal.items.filter((i) => i.key === "corn").length;
  $("#scoop-counter").textContent =
    `${scoops} scoop${scoops === 1 ? "" : "s"} · ${money(scoops * 150)}`;
}
const corn = new CornInteraction({
  scene,
  camera,
  canvas,
  dish,
  meal,
  onChange: updateHUD,
  onSound: playSound,
  onToast: toast,
});
function lockPointer() {
  try {
    controls.lock();
  } catch {
    toast("Use arrow keys to turn, or click the room to enable mouse look.");
  }
}
function unlockPointer() {
  keys.clear();
  corn.keys.clear();
  controls.unlock();
}
function start() {
  mode = "walk";
  $("#welcome").hidden = true;
  $("#welcome-note").hidden = true;
  $("#hud").hidden = false;
  document.body.classList.add("playing");
  viewRig.visible = true;
  playSound("click");
  lockPointer();
  updateHUD();
  toast("Welcome, Mason. Find your lunch, then check out with Lilybeth.");
}
function showOverlay(html) {
  overlay.dataset.mode = mode;
  overlay.innerHTML = html;
  overlay.hidden = false;
  unlockPointer();
  setTimeout(
    () =>
      overlay
        .querySelector("button:not([disabled])")
        ?.focus({ preventScroll: true }),
    0,
  );
}
function returnToWalk(lock = true) {
  overlay.hidden = true;
  overlay.innerHTML = "";
  mode = "walk";
  activeStation = null;
  keys.clear();
  if (lock) lockPointer();
}
function menuPanel(id) {
  activeStation = STATIONS.find((s) => s.id === id);
  mode = "menu";
  const items = Object.entries(MENU).filter(([k, item]) => item.station === id);
  const icon = {
    burger: "🍔",
    chicken: "🍗",
    salad: "🥗",
    grain: "🌾",
    sushi: "🍣",
    noodles: "🍜",
    tofu: "🍚",
    drink: "🥤",
  };
  showOverlay(
    `<section class="panel" role="dialog" aria-modal="true" aria-labelledby="panel-title"><button class="close" data-action="back" aria-label="Back to cafeteria">×</button><div class="eyebrow">${activeStation.subtitle}</div><h2 id="panel-title">${activeStation.title}</h2><p class="sub">Something good for your lunch break.</p>${items.map(([key, item]) => `<div class="menu-item"><span class="food-icon">${icon[item.kind]}</span><div><strong>${item.name}</strong><p>${item.note}</p><small>+${item.fullness} satisfaction</small></div><button data-add="${key}" ${total(meal) + item.price > BUDGET ? "disabled" : ""}>${item.price === 0 ? "Free" : money(item.price)} &nbsp; +</button></div>`).join("")}<div class="panel-footer"><span>Your plate: <b>${money(total(meal))}</b></span><span>${money(BUDGET - total(meal))} left</span></div><div class="button-row"><button class="secondary" data-action="back">Keep exploring <kbd>E</kbd></button></div></section>`,
  );
}
function addVisual(item) {
  const kind = MENU[item.key].kind;
  const f = food(dish, kind);
  f.userData.itemId = item.id;
  const count = meal.items.filter((i) => i.key !== "corn").length - 1;
  const a = count * 2.4;
  f.position.set(
    Math.cos(a) * 0.1,
    0.028 + Math.floor(count / 5) * 0.04,
    Math.sin(a) * 0.095,
  );
  if (count === 0) f.position.set(0, 0.028, -0.045);
  f.scale.setScalar(kind === "drink" ? 0.85 : 0.82);
}
function addFood(key) {
  const result = addItem(meal, key);
  if (!result.ok) {
    toast(result.reason);
    return;
  }
  addVisual(result.item);
  playSound("pick");
  updateHUD();
  toast(`${MENU[key].name} added to your plate.`);
  menuPanel(activeStation.id);
}
function platePanel() {
  mode = "plate";
  showOverlay(
    `<section class="panel" role="dialog" aria-modal="true" aria-labelledby="panel-title"><button class="close" data-action="back" aria-label="Back to cafeteria">×</button><div class="eyebrow">MADE BY YOU</div><h2 id="panel-title">Your lunch, so far.</h2><p class="sub">Aim for ${TARGET} satisfaction within $18. Corn is charged per scoop, including spills.</p>${meal.items.length ? meal.items.map((i) => `<div class="plate-row"><div>${MENU[i.key].name}<small>${i.key === "corn" ? `${i.landed} kernels on the plate · ${i.spilled} spilled` : `+${MENU[i.key].fullness} satisfaction`}</small></div><span>${money(MENU[i.key].price)} ${i.key === "corn" ? "" : `<button class="remove" data-remove="${i.id}" aria-label="Remove ${MENU[i.key].name}">Remove</button>`}</span></div>`).join("") : '<p class="sub">An empty plate is a good beginning. Try the salad bar straight ahead.</p>'}<div class="panel-footer" style="margin-top:20px"><span>Satisfaction: <b>${Math.round(fullness(meal))} / ${TARGET}</b></span><span>Total: <b>${money(total(meal))}</b></span></div><div class="button-row"><button class="secondary" data-action="back">Back to lunch</button></div></section>`,
  );
}
let savedPose = null;
function enterCorn() {
  mode = "corn";
  activeStation = STATIONS.find((s) => s.id === "corn");
  savedPose = {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
  };
  unlockPointer();
  camera.position.set(0.75, 1.95, -6.95);
  camera.lookAt(0.0, 1.06, -8.64);
  viewRig.visible = false;
  scene.attach(dish);
  dish.position.set(1.05, 1.095, -8.57);
  dish.rotation.set(0, 0, 0);
  corn.enter(meal);
  $("#scoop-ui").hidden = false;
  $("#prompt").hidden = true;
  document.body.classList.add("scooping");
}
function exitCorn() {
  if (!corn.leave()) return;
  $("#scoop-ui").hidden = true;
  document.body.classList.remove("scooping");
  viewRig.add(dish);
  dish.position.set(0, -0.39, -0.63);
  dish.rotation.set(0, 0, 0);
  viewRig.visible = true;
  camera.position.copy(savedPose.position);
  camera.quaternion.copy(savedPose.quaternion);
  mode = "walk";
  lockPointer();
}
function beginCheckout() {
  if (!meal.items.length) {
    toast("Pick out something to eat first. Lilybeth will be right here.");
    return;
  }
  savedPose = {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
  };
  if (queueDone) {
    lilyPanel();
    return;
  }
  mode = "queue";
  queueActive = true;
  showOverlay(
    `<section class="panel" role="dialog" aria-modal="true" aria-labelledby="panel-title"><div class="eyebrow">A FRIENDLY FACE AWAITS</div><h2 id="panel-title">Just a little queue.</h2><p class="sub">Lilybeth is finishing up with the students ahead of you.</p><div class="queue-count" id="queue-number">2</div><p class="sub" id="queue-copy">students ahead of you</p><button class="secondary" data-action="back">Back to the food stations</button></section>`,
  );
  camera.position.set(-7.6, 1.66, 3.6);
  camera.lookAt(-7.55, 1.46, 9.8);
}
function lilyPanel() {
  mode = "checkout";
  camera.position.set(-7.55, 1.65, 7.15);
  camera.lookAt(-7.55, 1.49, 9.75);
  showOverlay(
    `<section class="panel" role="dialog" aria-modal="true" aria-labelledby="panel-title"><button class="close" data-action="back-checkout" aria-label="Keep exploring">×</button><div class="lily-label"><span class="live-dot"></span> LILYBETH · YOUR FRIEND AT CHECKOUT</div><h2 id="panel-title">Good to see you!</h2><div class="dialogue">“Sir Mason, I saw Jeff earlier!”</div><p class="sub">${fullness(meal) >= TARGET ? "That looks like a lovely lunch. Let me ring that up for you!" : "A little lunch today? You’re welcome to grab a bit more before I ring you up."}</p><div class="panel-footer"><span>${meal.items.length} serving${meal.items.length === 1 ? "" : "s"} · ${Math.round(fullness(meal))} / ${TARGET} satisfaction</span><span><b>${money(total(meal))}</b></span></div><div class="button-row"><button class="secondary" data-action="back-checkout">A little more food</button><button class="primary" data-action="pay"><span>Pay ${money(total(meal))}</span><span>↗</span></button></div></section>`,
  );
}
function receipt(reopen = false) {
  if (!reopen && !checkout(meal)) {
    toast("Let your corn settle before paying.");
    return;
  }
  mode = "receipt";
  queueActive = false;
  if (!reopen) playSound("pay");
  const summary = mealSummary(meal);
  const grouped = [];
  for (const item of meal.items) {
    let row = grouped.find((r) => r.key === item.key);
    if (row) row.qty++;
    else grouped.push({ key: item.key, qty: 1 });
  }
  showOverlay(
    `<section class="panel receipt" role="dialog" aria-modal="true" aria-labelledby="panel-title"><div class="eyebrow">ARBUCKLE DINING PAVILION</div><h2 id="panel-title">${summary.success ? "A lunch well spent." : "A lighter lunch."}</h2><p>${summary.success ? "Happy plate. Happy student." : "A nice start, with room for a little more next time."}<br>Served with a smile by Lilybeth.</p><div class="receipt-lines">${grouped.map((r) => `<div><span>${r.qty} × ${MENU[r.key].name}</span><span>${money(MENU[r.key].price * r.qty)}</span></div>`).join("")}</div><div class="receipt-total"><span>TOTAL PAID</span><span>${money(summary.spent)}</span></div><div class="receipt-stats"><div><strong>${summary.fullness}<span style="font-size:13px"> / 80</span></strong><small>SATISFACTION</small></div><div><strong>${money(summary.remaining)}</strong><small>BUDGET LEFT</small></div><div><strong>${summary.scoops}</strong><small>CORN SCOOPS</small></div></div><p>${summary.spilled ? `${summary.spilled} corn kernels took the scenic route.<br>` : ""}“Have a wonderful day, Sir Mason!”</p><button class="primary" data-action="restart">Another lunch break &nbsp; ↗</button><p style="margin-top:14px;font-size:9px">A small campus moment. Made for you.</p></section>`,
  );
}
function settings() {
  if (mode === "pause") return;
  previousMode = mode;
  if (mode === "corn") {
    toast("Finish your scoop and press E before opening the controls.");
    return;
  }
  mode = "pause";
  showOverlay(
    `<section class="panel" role="dialog" aria-modal="true" aria-labelledby="panel-title"><button class="close" data-action="resume" aria-label="Resume">×</button><div class="eyebrow">TAKE YOUR TIME</div><h2 id="panel-title">Your lunch break.</h2><p class="sub">Walk to a station and press E. Fill your plate, then find Lilybeth near the entrance.</p><div class="controls-grid"><kbd>W A S D</kbd><span>Walk around the cafeteria</span><kbd>MOUSE</kbd><span>Look around · dip, lift & tip your scoop</span><kbd>← →</kbd><span>Turn without a mouse</span><kbd>E</kbd><span>Visit a station · leave corn station</span><kbd>Tab</kbd><span>See your plate and budget</span><kbd>Esc</kbd><span>Pause · close a menu</span></div><p class="sub">At the corn station, arrow keys also move the scoop; Space dips, lifts, and tips.</p><label class="setting">Graphics<select id="quality"><option value="high">High</option><option value="low">Performance</option></select></label><label class="setting motion-label"><span>Reduce movement sway</span><input type="checkbox" id="reduce-motion" ${reduceMotion ? "checked" : ""}></label><label class="setting">Mouse sensitivity<input id="sensitivity" type="range" min="0.2" max="1.4" step="0.1" value="${controls.pointerSpeed}" aria-label="Mouse sensitivity"></label><div class="button-row"><button class="primary" data-action="resume">${previousMode === "welcome" ? "Back to the entrance" : "Back to lunch"} &nbsp; →</button></div><p class="credits">Layout based on your walkthrough and Arbuckle reference photography. Character models: <a href="https://github.com/microsoft/Microsoft-Rocketbox" target="_blank" rel="noopener noreferrer">Microsoft Rocketbox</a>, MIT license. Menu prices are game values. <a href="${import.meta.env.BASE_URL}credits.html" target="_blank" rel="noopener noreferrer">References & credits</a></p></section>`,
  );
  $("#quality").value = graphicsHigh ? "high" : "low";
}
function resume() {
  if (previousMode === "welcome") {
    mode = "welcome";
    overlay.hidden = true;
  } else if (previousMode === "receipt") {
    receipt(true);
  } else if (previousMode === "menu" && activeStation)
    menuPanel(activeStation.id);
  else if (previousMode === "plate") platePanel();
  else if (previousMode === "checkout") lilyPanel();
  else if (previousMode === "queue") {
    mode = "queue";
    beginCheckout();
  } else returnToWalk();
}
function restart() {
  meal = newMeal();
  corn.meal = meal;
  corn.reset();
  for (const c of [...dish.children])
    if (c.userData.itemId || c.userData.kernel) c.removeFromParent();
  queueElapsed = 0;
  queueDone = false;
  queueActive = false;
  people?.resetQueue();
  camera.position.set(SPAWN.x, 1.66, SPAWN.z);
  camera.rotation.set(0, SPAWN.yaw, 0);
  viewRig.visible = true;
  updateHUD();
  returnToWalk();
}
function interact() {
  if (mode === "corn") {
    exitCorn();
    return;
  }
  if (mode !== "walk") return;
  const s = findNearby();
  if (!s) {
    toast("Walk closer to a food station to explore its menu.");
    return;
  }
  if (s.id === "corn") enterCorn();
  else if (s.id === "checkout") beginCheckout();
  else menuPanel(s.id);
}
function findNearby() {
  let best = null,
    bestDistance = 2.45;
  for (const s of STATIONS) {
    // The salad island can be approached from either side or either end.
    const dx =
        s.id === "salad"
          ? Math.max(Math.abs(camera.position.x - s.x) - 0.9, 0)
          : camera.position.x - s.visit[0],
      dz =
        s.id === "salad"
          ? Math.max(Math.abs(camera.position.z - s.z) - s.width / 2, 0)
          : camera.position.z - s.visit[1],
      d = Math.hypot(dx, dz) + (s.id === "salad" ? 1 : 0);
    if (d < bestDistance) {
      best = s;
      bestDistance = d;
    }
  }
  return best;
}
function isFree(x, z) {
  if (x < -13.1 || x > 13.1 || z < -10.2 || z > 13.1) return false;
  return !colliders.some(
    (c) =>
      Math.abs(x - c.x) < c.w / 2 + 0.25 && Math.abs(z - c.z) < c.d / 2 + 0.25,
  );
}
function move(dt) {
  let forward =
    (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
    (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
  let strafe = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  const turning =
    (keys.has("ArrowLeft") ? 1 : 0) - (keys.has("ArrowRight") ? 1 : 0);
  camera.rotation.y += turning * 1.55 * dt;
  const n = Math.hypot(forward, strafe) || 1;
  forward /= n;
  strafe /= n;
  const yaw = camera.rotation.y,
    speed = (keys.has("ShiftLeft") ? 3.3 : 2.25) * dt;
  const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * speed,
    dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * speed;
  if (isFree(camera.position.x + dx, camera.position.z))
    camera.position.x += dx;
  if (isFree(camera.position.x, camera.position.z + dz))
    camera.position.z += dz;
  const walking = Math.abs(dx) + Math.abs(dz) > 0.0001;
  if (walking) walkTime += dt * 8;
  const bob = walking && !reduceMotion ? Math.sin(walkTime) * 0.012 : 0;
  camera.position.y = 1.66 + bob;
  viewRig.position.y = bob * 0.8;
  viewRig.rotation.z =
    walking && !reduceMotion ? Math.cos(walkTime * 0.5) * 0.006 : 0;
  nearby = findNearby();
  $("#prompt").hidden = !nearby;
  if (nearby) {
    $("#prompt-title").textContent = nearby.title;
    $("#prompt-tag").textContent =
      nearby.id === "checkout"
        ? "A FRIENDLY FACE"
        : nearby.id === "corn"
          ? "SCOOP SOMETHING GOOD"
          : "FOOD STATION";
    $("#prompt-action").innerHTML =
      `<kbd>E</kbd> ${nearby.id === "corn" ? "Pick up the scoop" : nearby.id === "checkout" ? "Join the checkout line" : "Explore the menu"}`;
  }
}
const mapCtx = $("#map").getContext("2d");
function drawMap() {
  const c = mapCtx,
    w = 340,
    h = 270,
    px = (x) => ((x + 14) / 28) * (w - 22) + 11,
    pz = (z) => ((z + 11) / 25) * (h - 24) + 12;
  c.clearRect(0, 0, w, h);
  c.fillStyle = "#e9e5d5";
  c.fillRect(6, 5, w - 12, h - 10);
  c.strokeStyle = "#c4c7b3";
  c.strokeRect(6, 5, w - 12, h - 10);
  for (const s of STATIONS) {
    c.fillStyle = s.color;
    c.globalAlpha = s.id === nearby?.id ? 1 : 0.8;
    let sw =
        ((s.yaw === 0 || s.id === "checkout" ? s.width : 1.6) / 28) * (w - 22),
      sh =
        ((s.yaw === 0 || s.id === "checkout" ? 1.6 : s.width) / 25) * (h - 24);
    c.fillRect(px(s.x) - sw / 2, pz(s.z) - sh / 2, sw, sh);
    c.globalAlpha = 1;
    c.fillStyle = "#4d5945";
    c.font = "12px Arial";
    c.textAlign = "center";
    let text = {
      grill: "GRILL",
      corn: "CORN",
      sushi: "SUSHI",
      salad: "SALAD",
      asian: "ASIAN",
      drinks: "DRINKS",
      checkout: "LILYBETH",
    }[s.id];
    if (s.yaw !== 0 && s.id !== "checkout") {
      c.save();
      c.translate(px(s.x), pz(s.z));
      c.rotate(-Math.PI / 2);
      c.fillStyle = "#fff9e6";
      c.font = "10px Arial";
      c.fillText(text, 0, 3);
      c.restore();
    } else
      c.fillText(text, px(s.x), pz(s.z) + (s.id === "checkout" ? -15 : 25));
  }
  c.fillStyle = "#c7c9b4";
  for (let x = 3.3; x < 11; x += 3.45)
    for (let z = 3.1; z < 12; z += 3.65)
      c.fillRect(px(x) - 9, pz(z) - 4, 18, 8);
  c.save();
  c.translate(px(camera.position.x), pz(camera.position.z));
  c.rotate(-camera.rotation.y);
  c.fillStyle = "#8c1515";
  c.beginPath();
  c.moveTo(0, -8);
  c.lineTo(5, 6);
  c.lineTo(0, 3);
  c.lineTo(-5, 6);
  c.closePath();
  c.fill();
  c.restore();
}
$("#start").addEventListener("click", start);
$("#leave-corn").addEventListener("click", exitCorn);
$("#help").addEventListener("click", settings);
$("#sound").addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  $("#sound").textContent = soundEnabled ? "♪" : "♩";
  $("#sound").setAttribute(
    "aria-label",
    soundEnabled ? "Mute interaction sounds" : "Enable interaction sounds",
  );
  toast(
    soundEnabled ? "Interaction sounds on." : "A quiet lunch. Sounds muted.",
  );
});
canvas.addEventListener("click", () => {
  if (mode === "walk" && !controls.isLocked) lockPointer();
});
controls.addEventListener("unlock", () => {
  if (mode === "walk") settings();
});
document.addEventListener("pointerlockerror", () => {
  toast("Mouse look is unavailable. Use WASD to walk and arrow keys to turn.");
});
overlay.addEventListener("click", (e) => {
  const button = e.target.closest("button");
  if (!button) return;
  if (button.dataset.add) {
    addFood(button.dataset.add);
    return;
  }
  if (button.dataset.remove) {
    const id = Number(button.dataset.remove);
    if (removeItem(meal, id)) {
      dish.children
        .filter((c) => c.userData.itemId === id)
        .forEach((c) => c.removeFromParent());
      updateHUD();
      platePanel();
    }
    return;
  }
  const a = button.dataset.action;
  if (a === "back") {
    returnToWalk();
  } else if (a === "back-checkout") {
    if (savedPose) {
      camera.position.copy(savedPose.position);
      camera.quaternion.copy(savedPose.quaternion);
    }
    returnToWalk();
  } else if (a === "pay") receipt();
  else if (a === "restart") restart();
  else if (a === "resume") resume();
});
overlay.addEventListener("change", (e) => {
  if (e.target.id === "quality") {
    const low = e.target.value === "low";
    graphicsHigh = !low;
    renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio, 1.65));
    renderer.shadowMap.enabled = !low;
    scene.traverse((o) => {
      if (o.material) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.needsUpdate = true;
      }
    });
  }
  if (e.target.id === "reduce-motion") reduceMotion = e.target.checked;
});
overlay.addEventListener("input", (e) => {
  if (e.target.id === "sensitivity")
    controls.pointerSpeed = Number(e.target.value);
});
window.addEventListener("keydown", (e) => {
  if (
    [
      "Tab",
      "Space",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ].includes(e.code) &&
    mode !== "welcome"
  )
    e.preventDefault();
  if (e.repeat && ["KeyE", "Tab", "Escape", "Space"].includes(e.code)) return;
  if (mode === "corn") {
    corn.keys.add(e.code);
    if (e.code === "Space") corn.press();
    if (e.code === "KeyE" || e.code === "Escape") exitCorn();
    return;
  }
  if (e.code === "Escape") {
    if (mode === "walk") settings();
    else if (mode === "pause") resume();
    else if (["menu", "plate", "queue", "checkout"].includes(mode))
      returnToWalk();
    return;
  }
  if (e.code === "KeyE") {
    if (mode === "walk") interact();
    else if (mode === "menu") returnToWalk();
    return;
  }
  if (e.code === "Tab") {
    if (mode === "walk") platePanel();
    else if (mode === "plate") returnToWalk();
    return;
  }
  if (mode === "walk") keys.add(e.code);
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  corn.keys.delete(e.code);
  if (e.code === "Space") corn.release();
});
window.addEventListener("blur", () => {
  keys.clear();
  corn.keys.clear();
  corn.release();
  if (mode === "walk") settings();
});
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});
// Keep keyboard focus within an open dialog. Tab remains available for menus.
overlay.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    e.stopPropagation();
    const list = [
      ...overlay.querySelectorAll("button:not([disabled]),input,select,a"),
    ];
    let i = list.indexOf(document.activeElement);
    list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length]?.focus();
  }
});
const peoplePromise = createPeople(scene, seats)
  .then((p) => {
    people = p;
    $("#start").disabled = false;
    $("#start-label").textContent = "Step inside";
    if (import.meta.env.DEV) window.__arbuckle.people = people;
  })
  .catch((e) => {
    $("#fatal").hidden = false;
    $("#fatal-message").textContent =
      "The character models could not load. Please reload the page to try again.";
    console.error(e);
  });
function frame(ms) {
  requestAnimationFrame(frame);
  const dt = Math.min((ms - previousTime) / 1000 || 0.016, 0.04);
  previousTime = ms;
  elapsed += dt;
  if (mode === "walk") move(dt);
  if (mode !== "pause") people?.update(dt, elapsed);
  if (mode === "corn" || corn.particles.length) corn.update(dt);
  if (mode === "queue") {
    queueElapsed += dt;
    const left = queueElapsed < 3 ? 2 : queueElapsed < 6 ? 1 : 0;
    if ($("#queue-number")) {
      $("#queue-number").textContent = left;
      $("#queue-copy").textContent =
        left === 1 ? "student ahead of you" : "students ahead of you";
    }
    people?.queue.forEach((p, i) => {
      if (queueElapsed > 3 * (i + 1)) {
        p.group.position.x += dt * 1.2;
        if (p.group.position.x > -4) p.group.visible = false;
      }
    });
    if (left === 0) {
      queueDone = true;
      people?.queue.forEach((p) => (p.group.visible = false));
      lilyPanel();
    }
  }
  if (mode !== "welcome") drawMap();
  if (graphicsHigh) composer.render();
  else renderer.render(scene, camera);
}
requestAnimationFrame(frame);
if (import.meta.env.DEV)
  window.__arbuckle = {
    ready: () => peoplePromise,
    state: () => ({
      mode,
      meal: structuredClone(meal),
      summary: mealSummary(meal),
      position: camera.position.toArray(),
      nearby: findNearby()?.id,
      render: renderer.info.render,
    }),
    camera,
    scene,
    dish,
    corn,
    teleport(id) {
      const s = STATIONS.find((s) => s.id === id);
      camera.position.set(s.visit[0], 1.66, s.visit[1]);
      camera.lookAt(s.x, 1.5, s.z);
    },
    inspectPeople: () =>
      people?.people.map((p) => ({
        lily: p.lily,
        meshes: (() => {
          let a = [];
          p.model.traverse((o) => {
            if (o.isMesh)
              a.push({
                name: o.name,
                visible: o.visible,
                material: Array.isArray(o.material)
                  ? o.material.map((m) => ({
                      name: m.name,
                      map: m.map?.image?.src,
                    }))
                  : o.material.name,
              });
          });
          return a;
        })(),
        bones: Object.keys(p.bones),
      })),
  };
