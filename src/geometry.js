import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
export const rand = (min, max) => min + Math.random() * (max - min);
const boxes = new Map(),
  cylinders = new Map(),
  spheres = new Map(),
  materials = new Map();
export const mat = (color, roughness = 0.6, metalness = 0) => {
  const key = [color, roughness, metalness].join(",");
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness, metalness }),
    );
  return materials.get(key);
};
export function box(parent, w, h, d, x, y, z, material, round = 0) {
  const key = [w, h, d, round].join(",");
  if (!boxes.has(key))
    boxes.set(
      key,
      round
        ? new RoundedBoxGeometry(w, h, d, 2, round)
        : new THREE.BoxGeometry(w, h, d),
    );
  const m = new THREE.Mesh(boxes.get(key), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function cyl(parent, top, bottom, h, x, y, z, material, segments = 24) {
  const key = [top, bottom, h, segments].join(",");
  if (!cylinders.has(key))
    cylinders.set(key, new THREE.CylinderGeometry(top, bottom, h, segments));
  const m = new THREE.Mesh(cylinders.get(key), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function ellipsoid(parent, x, y, z, sx, sy, sz, material) {
  if (!spheres.has(0)) spheres.set(0, new THREE.SphereGeometry(1, 16, 12));
  const m = new THREE.Mesh(spheres.get(0), material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function rod(parent, a, b, r, material) {
  const av = new THREE.Vector3(...a),
    bv = new THREE.Vector3(...b);
  const m = cyl(parent, r, r, av.distanceTo(bv), 0, 0, 0, material, 10);
  m.position.copy(av).add(bv).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    bv.sub(av).normalize(),
  );
  return m;
}
export function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function sign(
  parent,
  text,
  sub,
  width,
  height,
  x,
  y,
  z,
  {
    background = "#eee9d6",
    color = "#303b2d",
    font = "Georgia",
    size = 70,
  } = {},
) {
  const texture = canvasTexture(
    1024,
    Math.round((1024 * height) / width),
    (ctx, w, h) => {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.fillStyle = color;
      ctx.font = `${size}px ${font}`;
      ctx.fillText(text, w / 2, h * (sub ? 0.47 : 0.58));
      if (sub) {
        ctx.font = "21px Arial";
        ctx.fillText(sub, w / 2, h * 0.77);
      }
    },
  );
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
export function plate(parent, r = 0.23) {
  const points = [
    [0, 0.008],
    [r * 0.7, 0.008],
    [r * 0.8, 0.015],
    [r * 0.93, 0.039],
    [r, 0.046],
    [r * 1.015, 0.035],
    [r * 0.95, 0.022],
    [r * 0.74, -0.007],
    [0, -0.007],
  ].map((p) => new THREE.Vector2(...p));
  const m = new THREE.Mesh(
    new THREE.LatheGeometry(points, 56),
    mat("#f1eee4", 0.22),
  );
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function contactShadow(parent, x, z, sx, sz, opacity = 0.22, y = 0.008) {
  const map = canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, `rgba(29,23,10,${opacity})`);
    g.addColorStop(1, "rgba(29,23,10,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(sx, sz),
    new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
export function hand(
  parent,
  { sleeve = "#e5dccb", side = 1, forearm = true } = {},
) {
  const g = new THREE.Group();
  const skin = mat("#c38f69", 0.67);
  const cloth = mat(sleeve, 0.95);
  ellipsoid(g, 0, 0, 0, 0.044, 0.033, 0.067, skin);
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Group();
    finger.position.set((i - 1.5) * 0.021, 0, -0.05);
    rod(finger, [0, 0, 0], [0, -0.006, -0.043], 0.0105, skin);
    rod(finger, [0, -0.006, -0.043], [0, -0.025, -0.068], 0.009, skin);
    g.add(finger);
  }
  rod(g, [side * 0.034, 0, 0.01], [side * 0.071, -0.01, -0.02], 0.015, skin);
  rod(
    g,
    [side * 0.071, -0.01, -0.02],
    [side * 0.07, -0.025, -0.045],
    0.012,
    skin,
  );
  if (forearm) {
    rod(g, [0, 0, 0.04], [0, -0.07, 0.22], 0.039, skin);
    rod(g, [0, -0.05, 0.19], [side * 0.035, -0.25, 0.68], 0.049, cloth);
  }
  parent.add(g);
  return g;
}
