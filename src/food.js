import * as THREE from "three";
import { box, cyl, ellipsoid, mat, rand, plate } from "./geometry.js";
const bun = mat("#c98b3d", 0.8),
  cheese = mat("#efb72d", 0.7),
  beef = mat("#543321", 0.85),
  green = mat("#679037", 0.83),
  tomato = mat("#bd4223", 0.46),
  rice = mat("#eee5c5", 0.85),
  nori = mat("#243b29", 0.65),
  salmon = mat("#eb8f62", 0.55),
  chicken = mat("#ba7840", 0.72),
  tofu = mat("#d4aa64", 0.9),
  white = mat("#f2eddc", 0.4);
export const kernelGeometry = new THREE.SphereGeometry(1, 7, 5);
export const kernelMaterial = mat("#efb824", 0.4);
export function food(parent, kind, seed = 0) {
  const g = new THREE.Group();
  parent.add(g);
  if (kind === "burger") {
    ellipsoid(g, 0, 0.028, 0, 0.093, 0.024, 0.084, bun);
    cyl(g, 0.081, 0.081, 0.025, 0, 0.051, 0, beef);
    for (let i = 0; i < 8; i++) {
      let a = (i * Math.PI) / 4;
      ellipsoid(
        g,
        Math.cos(a) * 0.055,
        0.069,
        Math.sin(a) * 0.055,
        0.037,
        0.005,
        0.03,
        green,
      );
    }
    const c = box(g, 0.154, 0.007, 0.147, 0, 0.08, 0, cheese, 0.003);
    c.rotation.y = 0.3;
    ellipsoid(g, 0, 0.106, 0, 0.095, 0.037, 0.088, bun);
    for (let i = 0; i < 30; i++) {
      let x = rand(-0.07, 0.07),
        z = rand(-0.065, 0.065);
      if (x * x + z * z > 0.005) continue;
      const s = ellipsoid(
        g,
        x,
        0.137 - Math.hypot(x, z) * 0.2,
        z,
        0.003,
        0.001,
        0.0015,
        rice,
      );
      s.rotation.y = rand(0, 6);
    }
  } else if (kind === "sushi") {
    for (let x = 0; x < 3; x++)
      for (let z = 0; z < 2; z++) {
        let xx = (x - 1) * 0.065,
          zz = (z - 0.5) * 0.072;
        cyl(g, 0.029, 0.029, 0.039, xx, 0.022, zz, nori);
        cyl(g, 0.025, 0.025, 0.003, xx, 0.043, zz, rice);
        box(g, 0.022, 0.003, 0.018, xx - 0.006, 0.046, zz, salmon, 0.002);
        box(g, 0.009, 0.003, 0.019, xx + 0.01, 0.046, zz, green, 0.002);
      }
  } else if (kind === "salad" || kind === "grain") {
    for (let i = 0; i < 28; i++) {
      let a = rand(0, 6.28),
        r = rand(0, 0.095);
      const m = ellipsoid(
        g,
        Math.cos(a) * r,
        rand(0.01, 0.04),
        Math.sin(a) * r,
        rand(0.018, 0.035),
        0.007,
        rand(0.018, 0.04),
        i % 8 === 0 ? tomato : i % 7 === 0 ? rice : green,
      );
      m.rotation.set(rand(-0.6, 0.6), a, rand(-0.4, 0.4));
    }
  } else if (kind === "chicken") {
    const c = ellipsoid(g, 0, 0.026, 0, 0.11, 0.029, 0.07, chicken);
    c.rotation.y = 0.25;
    for (let i = -2; i <= 2; i++) {
      const b = box(g, 0.125, 0.002, 0.004, i * 0.009, 0.052, i * 0.019, beef);
      b.rotation.y = 0.3;
    }
    for (let i = 0; i < 8; i++)
      ellipsoid(
        g,
        rand(-0.09, 0.09),
        0.058,
        rand(-0.035, 0.035),
        0.003,
        0.001,
        0.005,
        green,
      );
  } else if (kind === "tofu" || kind === "noodles") {
    const b = plate(g, 0.115);
    b.position.y = 0.012;
    if (kind === "tofu") {
      for (let i = 0; i < 65; i++)
        ellipsoid(
          g,
          rand(-0.075, 0.075),
          rand(0.027, 0.04),
          rand(-0.065, 0.065),
          0.008,
          0.003,
          0.004,
          rice,
        );
      for (let i = 0; i < 8; i++) {
        let c = box(
          g,
          0.029,
          0.023,
          0.032,
          rand(-0.075, 0.075),
          0.053,
          rand(-0.065, 0.065),
          tofu,
          0.004,
        );
        c.rotation.y = rand(0, 6);
      }
    } else {
      for (let i = 0; i < 30; i++) {
        const curve = new THREE.CatmullRomCurve3(
          Array.from(
            { length: 5 },
            (_, j) =>
              new THREE.Vector3(
                (j - 2) * 0.035,
                rand(0.025, 0.055),
                Math.sin(j * 1.5 + i) * 0.045 + rand(-0.02, 0.02),
              ),
          ),
        );
        const m = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 8, 0.0023, 4, false),
          rice,
        );
        m.rotation.y = i;
        g.add(m);
      }
    }
    for (let i = 0; i < 5; i++) {
      let m = ellipsoid(
        g,
        rand(-0.06, 0.06),
        0.065,
        rand(-0.06, 0.06),
        0.022,
        0.004,
        0.035,
        green,
      );
      m.rotation.y = i;
    }
  } else if (kind === "drink") {
    cyl(g, 0.04, 0.03, 0.15, 0, 0.08, 0, white);
    cyl(g, 0.035, 0.035, 0.003, 0, 0.157, 0, mat("#684424", 0.22));
    cyl(g, 0.002, 0.002, 0.21, 0.015, 0.14, 0, mat("#dfd2b0", 0.6));
  }
  g.userData.kind = kind;
  return g;
}
export function cornTray(parent, x, y, z, width = 1.25, depth = 0.72) {
  const steel = mat("#b5b5a6", 0.25, 0.78);
  box(parent, width + 0.065, 0.07, depth + 0.065, x, y - 0.04, z, steel, 0.035);
  box(parent, width, 0.025, depth, x, y, z, mat("#ddac24", 0.55), 0.018);
  const m = new THREE.InstancedMesh(kernelGeometry, kernelMaterial, 1000);
  const o = new THREE.Object3D();
  for (let i = 0; i < 1000; i++) {
    o.position.set(
      x + rand(-width * 0.47, width * 0.47),
      y + rand(0.014, 0.055),
      z + rand(-depth * 0.45, depth * 0.45),
    );
    o.scale.set(rand(0.012, 0.019), rand(0.012, 0.018), rand(0.012, 0.021));
    o.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    m.setColorAt(
      i,
      new THREE.Color().setHSL(
        rand(0.105, 0.145),
        rand(0.7, 0.9),
        rand(0.46, 0.61),
      ),
    );
  }
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
