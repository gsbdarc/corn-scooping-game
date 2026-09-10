import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  box,
  cyl,
  ellipsoid,
  rod,
  sign,
  mat,
  canvasTexture,
  plate,
  contactShadow,
  rand,
} from "./geometry.js";
import { food, cornTray } from "./food.js";
import { STATIONS } from "./layout.js";
export function createWorld(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#c5d7db");
  scene.fog = new THREE.Fog("#d9d8bb", 38, 85);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new RoomEnvironment();
  scene.environment = pmrem.fromScene(env, 0.05).texture;
  scene.environmentIntensity = 0.65;
  env.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight("#f9f4e5", "#817761", 1.35));
  const sun = new THREE.DirectionalLight("#fff0d2", 3.7);
  sun.position.set(22, 12, 18);
  sun.target.position.set(-4, 0, -4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -25,
    right: 25,
    top: 25,
    bottom: -25,
    near: 1,
    far: 65,
  });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight("#d4e3f4", 0.65);
  fill.position.set(-10, 5, 4);
  scene.add(fill);
  const staticGroup = new THREE.Group();
  scene.add(staticGroup);
  const colliders = [];
  const stations = {};
  const plants = [];
  const addCollider = (x, z, w, d) => colliders.push({ x, z, w, d });
  const textureLoader = new THREE.TextureLoader();
  const loadWoodMap = (name, color = false) => {
    const texture = textureLoader.load(
      `${import.meta.env.BASE_URL}assets/textures/wood-${name}.jpg`,
    );
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  const woodTex = loadWoodMap("diffuse", true);
  const woodNormal = loadWoodMap("normal");
  const woodRough = loadWoodMap("rough");
  const wood = new THREE.MeshStandardMaterial({
    map: woodTex,
    normalMap: woodNormal,
    roughnessMap: woodRough,
    normalScale: new THREE.Vector2(0.2, 0.2),
    roughness: 0.8,
    color: "#dfd1b7",
  });
  const paleWood = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughnessMap: woodRough,
    normalMap: woodNormal,
    normalScale: new THREE.Vector2(0.1, 0.1),
    roughness: 0.7,
    color: "#ffedcd",
  });
  const steel = mat("#b8b9af", 0.28, 0.77),
    darkMetal = mat("#4c514d", 0.42, 0.7),
    gold = mat("#d7b254", 0.85),
    cream = mat("#efe7d1", 0.88),
    black = mat("#222925", 0.7),
    wall = mat("#d6b654", 0.92),
    white = mat("#eceadf", 0.28);
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#d9eee7",
    transparent: true,
    opacity: 0.13,
    roughness: 0.13,
    metalness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const floorTex = canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = "#c8bda7";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 32000; i++) {
      c.fillStyle = `rgba(${Math.random() > 0.5 ? "255,252,224" : "93,87,67"},${rand(0.025, 0.1)})`;
      c.fillRect(rand(0, w), rand(0, h), rand(1, 3), rand(1, 3));
    }
    c.fillStyle = "#918976";
    c.fillRect(0, 0, 2, h);
    c.fillRect(0, 0, w, 2);
    c.fillStyle = "#e0d6bf";
    c.fillRect(3, 0, 1, h);
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(24, 22);
  const floor = new THREE.MeshStandardMaterial({
    map: floorTex,
    bumpMap: floorTex,
    bumpScale: 0.012,
    roughness: 0.46,
    metalness: 0.07,
  });
  box(staticGroup, 28, 0.14, 26, 0, -0.09, 1, floor);
  box(staticGroup, 28, 4, 0.35, 0, 2, -10.8, wall);
  addCollider(0, -10.8, 28, 0.35);
  // The lower service room opens into the taller dining pavilion.
  box(staticGroup, 28, 0.2, 11, 0, 3.85, -5.4, cream);
  // Clerestory glazing closes the transition between the two ceiling heights.
  box(staticGroup, 28, 0.55, 0.3, 0, 4.16, -0.2, wall);
  box(staticGroup, 28, 0.55, 0.3, 0, 6.56, -0.2, wall);
  for (let x = -13.5; x < 14; x += 2.7) {
    box(staticGroup, 0.12, 2.1, 0.14, x, 5.32, -0.12, darkMetal);
    box(staticGroup, 2.56, 1.87, 0.015, x + 1.34, 5.34, -0.13, glass);
  }
  for (let x = -13; x < 14; x += 1.1)
    box(staticGroup, 0.014, 0.009, 10.8, x, 3.739, -5.4, mat("#bcbab0", 0.8));
  for (let z = -10; z < 0; z += 1.1)
    box(staticGroup, 28, 0.009, 0.014, 0, 3.739, z, mat("#bcbab0", 0.8));
  for (let x = -11; x <= 11; x += 3.6)
    for (let z = -9; z < 0; z += 3.6) {
      cyl(staticGroup, 0.085, 0.085, 0.012, x, 3.724, z, steel, 20);
      cyl(
        staticGroup,
        0.06,
        0.06,
        0.014,
        x,
        3.71,
        z,
        new THREE.MeshBasicMaterial({ color: "#fff8d2" }),
      );
    }
  const soffit = box(
    staticGroup,
    27.5,
    0.075,
    0.09,
    0,
    3.48,
    -10.49,
    new THREE.MeshStandardMaterial({
      color: "#ffda75",
      emissive: "#f7b927",
      emissiveIntensity: 1.2,
    }),
  );
  const serviceGlow = new THREE.PointLight("#ffe1a4", 16, 15, 2);
  serviceGlow.position.set(0, 3.1, -7);
  scene.add(serviceGlow);
  const wallGraphic = canvasTexture(1024, 256, (c, w, h) => {
    c.fillStyle = "#cba648";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 28; i++) {
      c.strokeStyle = "rgba(255,227,135,.13)";
      c.lineWidth = rand(7, 20);
      c.beginPath();
      let x = rand(0, w);
      c.moveTo(x, h);
      c.bezierCurveTo(
        x - 180,
        h * 0.6,
        x + 220,
        h * 0.4,
        x + rand(-100, 100),
        0,
      );
      c.stroke();
    }
  });
  const mural = new THREE.Mesh(
    new THREE.PlaneGeometry(27.4, 1.05),
    new THREE.MeshStandardMaterial({ map: wallGraphic, roughness: 0.9 }),
  );
  mural.position.set(0, 2.85, -10.6);
  staticGroup.add(mural);
  // Clerestory windows, full-height glass, and the warm slatted roof.
  for (const side of [-1, 1]) {
    box(staticGroup, 0.24, 7, 24, side * 13.7, 3.5, 1.3, wall);
    for (let z = 1; z < 13; z += 3.1) {
      box(staticGroup, 0.28, 5.7, 0.18, side * 13.54, 3.2, z, darkMetal);
      box(
        staticGroup,
        0.3,
        0.12,
        2.95,
        side * 13.52,
        2.65,
        z + 1.52,
        darkMetal,
      );
      box(staticGroup, 0.3, 0.12, 2.95, side * 13.52, 5.5, z + 1.52, darkMetal);
      // Open window apertures sit just inside an exterior wall removed below.
    }
  }
  // Rebuild side walls as sill/header with actual open glazing for daylight.
  for (const child of [...staticGroup.children])
    if (
      child.geometry?.parameters?.height === 7 &&
      Math.abs(child.position.x) > 13
    )
      staticGroup.remove(child);
  for (const side of [-1, 1]) {
    box(staticGroup, 0.32, 0.42, 14, side * 13.7, 0.21, 7, wall);
    box(staticGroup, 0.32, 1.2, 14, side * 13.7, 6.3, 7, wall);
    box(staticGroup, 0.32, 3.85, 10.8, side * 13.7, 1.925, -5.4, wall);
    for (let z = 0.5; z < 13; z += 3.1) {
      box(staticGroup, 0.03, 5.05, 2.9, side * 13.6, 2.94, z + 1.52, glass);
      box(staticGroup, 0.5, 7, 0.5, side * 13.55, 3.5, z, wall);
    }
    addCollider(side * 13.7, 1, 1, 26);
  }
  for (let x = -12.5; x < 14; x += 3.1) {
    box(staticGroup, 0.13, 5.9, 0.13, x, 3, 13.6, darkMetal);
    if (Math.abs(x + 5) > 1.8)
      box(staticGroup, 2.9, 5.4, 0.025, x + 1.52, 3, 13.65, glass);
  }
  box(staticGroup, 28, 1.2, 0.3, 0, 6.3, 13.8, wall);
  box(staticGroup, 28, 0.3, 0.3, 0, 0.15, 13.8, wall);
  addCollider(0, 13.8, 28, 0.4);
  box(staticGroup, 28, 0.22, 15, 0, 7.04, 6.5, mat("#4f3927", 0.94));
  for (let x = -13.5; x <= 13.5; x += 0.21)
    box(staticGroup, 0.105, 0.15, 14.9, x, 6.86, 6.5, wood);
  for (let z = 0; z < 14; z += 4.5)
    box(staticGroup, 27.5, 0.48, 0.34, 0, 6.53, z, wood);
  for (const x of [-7, 5]) box(staticGroup, 0.42, 0.4, 14, x, 6.3, 6.5, wood);
  for (let x = -10; x < 12; x += 5)
    for (let z = 2; z < 14; z += 5) {
      cyl(staticGroup, 0.08, 0.1, 0.16, x, 6.6, z, black);
      cyl(
        staticGroup,
        0.072,
        0.072,
        0.014,
        x,
        6.51,
        z,
        new THREE.MeshBasicMaterial({ color: "#fff5cc" }),
      );
    }
  // Lawn, paths, pergola, and nearby campus buildings through the windows.
  box(staticGroup, 150, 0.15, 140, 0, -0.22, 0, mat("#839261", 1));
  box(staticGroup, 46, 0.05, 7, 0, -0.1, 17.5, mat("#c9bea1", 1));
  for (const x of [-22, 24]) {
    box(staticGroup, 5, 9, 42, x, 4.4, 0, mat("#d3be96", 0.94));
    for (let z = -17; z < 19; z += 3) {
      box(
        staticGroup,
        0.06,
        2,
        1.65,
        x + (x < 0 ? 2.54 : -2.54),
        2.8,
        z,
        mat("#698380", 0.3, 0.35),
      );
      box(
        staticGroup,
        0.06,
        2,
        1.65,
        x + (x < 0 ? 2.54 : -2.54),
        6,
        z,
        mat("#698380", 0.3, 0.35),
      );
    }
    box(staticGroup, 6, 0.3, 43, x, 9, 0, mat("#a9714d", 0.85));
  }
  box(staticGroup, 42, 7, 4, 0, 3.4, 32, mat("#d9c69d", 0.95));
  for (let x = -18; x < 21; x += 2.6) {
    box(staticGroup, 1.6, 2, 0.03, x, 4.5, 29.98, mat("#7a918a", 0.38));
  }
  for (let x = -12; x < 15; x += 4.5) {
    box(staticGroup, 0.18, 3, 0.18, x, 1.5, 18.5, wood);
    box(staticGroup, 0.18, 3, 0.18, x, 1.5, 22.5, wood);
  }
  for (let x = -12; x < 15; x += 0.45)
    box(staticGroup, 0.08, 0.13, 5, x, 3.12, 20.5, wood);
  // Food counters, in the user's described order.
  for (const s of STATIONS) {
    if (s.id === "checkout") continue;
    const g = new THREE.Group();
    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.yaw;
    staticGroup.add(g);
    stations[s.id] = g;
    const d = s.id === "salad" ? 1.75 : 1.65,
      w = s.width;
    box(g, w, 0.94, d, 0, 0.49, 0, wood, 0.025);
    box(g, w + 0.14, 0.095, d + 0.15, 0, 1.01, 0, steel, 0.035);
    box(g, w - 0.12, 0.065, 0.08, 0, 0.13, d / 2 + 0.02, darkMetal);
    for (let i = -w / 2 + 0.18; i < w / 2; i += 0.62)
      box(g, 0.017, 0.71, 0.015, i, 0.51, d / 2 + 0.005, mat("#5c432c", 0.75));
    sign(
      g,
      s.id === "salad" ? "GREENS" : s.title.toUpperCase(),
      null,
      Math.min(w - 0.7, 3.9),
      0.28,
      0,
      0.64,
      d / 2 + 0.025,
      { background: "#26342e", color: "#f6f1dc", font: "Arial", size: 50 },
    );
    if (s.id !== "drinks") {
      for (const x of [-w / 2 + 0.18, w / 2 - 0.18]) {
        cyl(g, 0.022, 0.022, 0.66, x, 1.38, -0.01, steel, 12);
        rod(g, [x, 1.68, -0.05], [x, 1.55, 0.63], 0.019, steel);
      }
      const guard = box(g, w - 0.23, 0.012, 0.69, 0, 1.61, 0.28, glass);
      guard.rotation.x = 0.19;
      rod(
        g,
        [-w / 2 + 0.15, 1.68, -0.05],
        [w / 2 - 0.15, 1.68, -0.05],
        0.025,
        steel,
      );
    }
    if (s.id === "salad") {
      for (let i = 0; i < 6; i++) {
        const z = ((i % 2) - 0.5) * 0.76,
          x = (Math.floor(i / 2) - 1) * 1.64;
        box(g, 1.32, 0.065, 0.58, x, 1.09, z, steel, 0.04);
        for (let k = 0; k < 5; k++) {
          let f = food(g, k % 4 === 0 ? "grain" : "salad");
          f.position.set(x + rand(-0.48, 0.48), 1.125, z + rand(-0.17, 0.17));
          f.scale.setScalar(1.5);
        }
      }
      sign(g, "Greens", "FRESH & SEASONAL", 2.1, 0.58, 0, 1.99, -0.06, {
        background: "#f3efdc",
        color: "#547143",
        size: 95,
      });
      for (let i = 0; i < 13; i++) {
        let p = plate(g, 0.21);
        p.position.set(w / 2 - 0.28, 1.09 + i * 0.014, 0);
      }
    } else if (s.id === "corn") {
      cornTray(g, -0.7, 1.1, 0.22, 1.65, 0.85);
      cornTray(g, -2, 1.1, 0.05, 0.5, 0.6);
      sign(
        g,
        "Sweet buttered corn",
        "$1.50 / SCOOP",
        1.04,
        0.3,
        -0.75,
        1.22,
        0.73,
        { background: "#f2e4ad", color: "#635427", size: 51 },
      );
      const spoon = cyl(g, 0.035, 0.035, 0.43, 0.1, 1.1, 0.14, steel);
      spoon.rotation.z = Math.PI / 2;
      for (let i = 0; i < 8; i++) {
        let p = plate(g, 0.235);
        p.position.set(2.1, 1.075 + i * 0.015, 0.12);
      }
    } else if (s.id === "drinks") {
      for (let i = 0; i < 3; i++) {
        let x = (i - 1) * 1.13;
        box(g, 0.81, 0.92, 0.67, x, 1.54, -0.18, black, 0.04);
        sign(
          g,
          ["WATER", "ICED TEA", "SPARKLING"][i],
          null,
          0.67,
          0.24,
          x,
          1.69,
          0.165,
          {
            background: ["#547677", "#9c6b3c", "#6a805d"][i],
            color: "#f7f4e5",
            font: "Arial",
            size: 68,
          },
        );
        box(g, 0.12, 0.08, 0.17, x, 1.22, 0.24, steel, 0.015);
        cyl(g, 0.025, 0.025, 0.11, x, 1.18, 0.31, darkMetal);
        box(g, 0.76, 0.04, 0.38, x, 1.08, 0.34, steel, 0.015);
      }
      for (let i = 0; i < 12; i++)
        cyl(g, 0.053, 0.045, 0.13, -1.85, 1.14 + i * 0.019, 0.4, white);
    } else {
      const kinds = {
        grill: ["burger", "chicken"],
        sushi: ["sushi", "sushi"],
        asian: ["noodles", "tofu"],
      }[s.id];
      for (let i = 0; i < 4; i++) {
        let x = (i - 1.5) * (w / 4);
        box(g, w / 4 - 0.15, 0.06, 1.06, x, 1.1, 0, steel, 0.035);
        for (let j = 0; j < 3; j++) {
          let f = food(g, kinds[i % 2]);
          f.position.set(x + rand(-0.25, 0.25), 1.13, (j - 1) * 0.28);
          f.scale.setScalar(1.5);
        }
      }
    }
    if (s.id !== "salad") {
      if (s.yaw === 0) {
        box(g, w, 1.45, 0.1, 0, 1.82, -1.15, steel);
        box(g, w, 0.35, 0.85, 0, 2.52, -0.9, steel, 0.015);
        sign(g, s.title, s.subtitle, w - 0.4, 0.68, 0, 2.98, -1.1, {
          background: "#cda747",
          color: "#fff4d0",
          size: 75,
        });
        for (let i = -2; i <= 2; i++) {
          box(g, 0.75, 0.54, 0.43, i * 0.97, 1.76, -1.04, darkMetal, 0.02);
          box(g, 0.68, 0.38, 0.02, i * 0.97, 1.8, -0.81, black);
          cyl(
            g,
            0.025,
            0.025,
            0.035,
            i * 0.97 + 0.23,
            2.01,
            -0.77,
            steel,
          ).rotation.x = Math.PI / 2;
        }
      } else
        sign(g, s.title, s.subtitle, w - 0.3, 0.7, 0, 2.48, -0.8, {
          background: "#cfb157",
          color: "#fff5d8",
          size: 87,
        });
    }
    addCollider(s.x, s.z, s.yaw === 0 ? w : 1.85, s.yaw === 0 ? 1.85 : w);
    contactShadow(
      staticGroup,
      s.x,
      s.z,
      s.yaw === 0 ? w + 1 : 2.9,
      s.yaw === 0 ? 2.9 : w + 1,
      0.22,
    );
  }
  // Cashier beside the entrance, facing into the serving hall.
  const check = STATIONS.find((s) => s.id === "checkout");
  const cg = new THREE.Group();
  cg.position.set(check.x, 0, check.z);
  cg.rotation.y = Math.PI;
  staticGroup.add(cg);
  stations.checkout = cg;
  box(cg, 3.4, 0.96, 1.3, 0, 0.5, 0, wood, 0.04);
  box(cg, 3.55, 0.09, 1.45, 0, 1.02, 0, steel, 0.035);
  addCollider(check.x, check.z, 3.6, 1.5);
  box(cg, 0.2, 0.4, 0.18, -0.48, 1.27, -0.12, black, 0.025);
  let monitor = box(cg, 0.67, 0.44, 0.075, -0.48, 1.53, -0.12, black, 0.03);
  monitor.rotation.x = -0.14;
  sign(cg, "WELCOME", "LILYBETH", 0.59, 0.35, -0.48, 1.54, -0.067, {
    background: "#21382d",
    color: "#e8ecce",
    font: "Arial",
    size: 79,
  });
  box(cg, 0.16, 0.065, 0.25, 0.32, 1.12, 0.4, black, 0.02);
  sign(cg, "Tap to pay", null, 0.16, 0.08, 0.32, 1.16, 0.531, {
    background: "#202723",
    color: "#faf4db",
    font: "Arial",
    size: 80,
  });
  sign(cg, "Lilybeth", "HAPPY TO SEE YOU", 0.86, 0.29, 0.94, 1.18, 0.65, {
    background: "#f4edce",
    color: "#384433",
    size: 94,
  });
  sign(cg, "CHECKOUT", "GOOD FOOD. GOOD COMPANY.", 2.8, 0.65, 0, 2.75, -0.1, {
    background: "#8c1515",
    color: "#ffefd3",
    size: 86,
  });
  for (const x of [-9, -6.2])
    for (let z = 4; z < 8; z += 2) {
      cyl(staticGroup, 0.12, 0.15, 0.035, x, 0.03, z, steel);
      cyl(staticGroup, 0.025, 0.025, 0.9, x, 0.5, z, darkMetal);
      ellipsoid(staticGroup, x, 0.98, z, 0.048, 0.048, 0.048, darkMetal);
    }
  for (const x of [-9, -6.2])
    rod(staticGroup, [x, 0.94, 4], [x, 0.94, 6], 0.022, black);
  // Dining tables and recognizable striped banquettes.
  const stripe = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = "#806846";
    c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 24) {
      c.fillStyle = "#b29460";
      c.fillRect(x, 0, 5, h);
      c.fillStyle = "#65543e";
      c.fillRect(x + 8, 0, 7, h);
      c.fillStyle = "#bbad87";
      c.fillRect(x + 20, 0, 2, h);
    }
  });
  stripe.wrapS = stripe.wrapT = THREE.RepeatWrapping;
  stripe.repeat.set(3, 1);
  const upholstery = new THREE.MeshStandardMaterial({
    map: stripe,
    roughness: 1,
  });
  const chairMat = mat("#baaa79", 0.95);
  const seats = [];
  function chair(x, z, yaw) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    staticGroup.add(g);
    box(g, 0.46, 0.06, 0.44, 0, 0.46, 0, chairMat, 0.03);
    box(g, 0.45, 0.49, 0.055, 0, 0.73, -0.22, chairMat, 0.025);
    for (let i = -0.19; i < 0.2; i += 0.38)
      for (let k = -0.19; k < 0.2; k += 0.38)
        rod(g, [i, 0.45, k], [i * 1.18, 0.02, k * 1.2], 0.016, steel);
    for (let i = -0.2; i < 0.21; i += 0.035)
      box(g, 0.009, 0.43, 0.007, i, 0.73, -0.252, mat("#d5c59a", 0.9));
    contactShadow(staticGroup, x, z, 0.9, 0.85, 0.18);
  }
  for (let x = 3.3; x <= 10; x += 3.45)
    for (let z = 3.1; z <= 11; z += 3.65) {
      box(staticGroup, 2.25, 0.09, 1.1, x, 0.79, z, paleWood, 0.025);
      for (let dx of [-0.94, 0.94])
        for (let dz of [-0.4, 0.4])
          cyl(staticGroup, 0.025, 0.025, 0.75, x + dx, 0.39, z + dz, steel, 10);
      addCollider(x, z, 2.45, 2.55);
      contactShadow(staticGroup, x, z, 3.4, 2.6, 0.25);
      for (const side of [-1, 1]) {
        chair(x - 0.6, z + side * 0.89, side < 0 ? 0 : Math.PI);
        chair(x + 0.6, z + side * 0.89, side < 0 ? 0 : Math.PI);
        seats.push({
          x: x - 0.6,
          z: z + side * 0.89,
          yaw: side < 0 ? 0 : Math.PI,
        });
      }
      for (let i = 0; i < 2; i++) {
        let p = plate(staticGroup, 0.16);
        p.position.set(x + (i - 0.5) * 1.1, 0.855, z);
        const f = food(
          staticGroup,
          ["sushi", "salad", "burger"][Math.floor(rand(0, 3))],
        );
        f.position.copy(p.position);
        f.scale.setScalar(0.8);
      }
      cyl(staticGroup, 0.032, 0.025, 0.11, x, 0.895, z, white);
      cyl(
        staticGroup,
        0.018,
        0.018,
        0.1,
        x + 0.12,
        0.9,
        z,
        mat("#d5cbbb", 0.3),
      );
    }
  for (let z = 3.1; z < 12; z += 3.65) {
    box(staticGroup, 2.3, 0.42, 0.67, 11.2, 0.24, z, wood, 0.025);
    box(staticGroup, 2.3, 0.13, 0.7, 11.2, 0.49, z, upholstery, 0.05);
    box(staticGroup, 2.3, 0.76, 0.16, 11.2, 0.79, z + 0.3, upholstery, 0.04);
  }
  function palm(x, z, height) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    staticGroup.add(g);
    cyl(g, 0.45, 0.34, 0.63, 0, 0.33, 0, mat("#8d6546", 0.88));
    cyl(g, 0.4, 0.4, 0.02, 0, 0.65, 0, mat("#4b4932", 1));
    for (let i = 0; i < 35; i++)
      cyl(
        g,
        0.085 - i * 0.001,
        0.089 - i * 0.001,
        0.07,
        Math.sin(i * 0.05) * 0.14,
        0.7 + i * 0.07,
        0,
        wood,
        10,
      );
    const leafMat = mat("#45653a", 0.92);
    leafMat.side = THREE.DoubleSide;
    const crown = height;
    for (let k = 0; k < 11; k++) {
      let a = k * 2.399,
        r = rand(1.35, 2.2),
        end = [Math.cos(a) * r, crown - rand(0.4, 1.1), Math.sin(a) * r];
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.13, crown, 0),
        new THREE.Vector3(
          Math.cos(a) * r * 0.45,
          crown + 0.55,
          Math.sin(a) * r * 0.45,
        ),
        new THREE.Vector3(...end),
      ]);
      const stem = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 14, 0.012, 4, false),
        leafMat,
      );
      g.add(stem);
      for (let j = 2; j < 19; j++) {
        let t = j / 20,
          p = curve.getPoint(t),
          len = Math.sin(t * Math.PI) * 0.51;
        for (const side of [-1, 1]) {
          let dir = a + side * 1.1;
          const points = [
            p.x,
            p.y,
            p.z,
            p.x + Math.cos(dir) * len,
            p.y - 0.17,
            p.z + Math.sin(dir) * len,
            p.x + Math.cos(a) * 0.09,
            p.y - 0.03,
            p.z + Math.sin(a) * 0.09,
          ];
          const geo = new THREE.BufferGeometry();
          geo.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(points, 3),
          );
          geo.computeVertexNormals();
          const m = new THREE.Mesh(geo, leafMat);
          m.castShadow = true;
          g.add(m);
        }
      }
    }
    contactShadow(staticGroup, x, z, 2.3, 2.3, 0.3);
    addCollider(x, z, 0.9, 0.9);
    plants.push(g);
  }
  palm(12, 1, 3.3);
  palm(12, 12.4, 3.5);
  palm(1, 12.1, 3.3);
  palm(-12, 5, 3.4);
  palm(3, -0.1, 3.35);
  sign(staticGroup, "ARBUCKLE", "DINING PAVILION", 3.6, 0.95, -5, 3.6, 13.4, {
    background: "#e2ce99",
    color: "#574d32",
    size: 115,
  }).rotation.y = Math.PI;
  // Flatten static meshes by material to keep the large room smooth on laptops.
  staticGroup.updateMatrixWorld(true);
  const batches = new Map();
  const removal = [];
  staticGroup.traverse((o) => {
    if (
      o.isMesh &&
      !o.isInstancedMesh &&
      !Array.isArray(o.material) &&
      !o.material.transparent
    ) {
      const key = o.material.uuid;
      if (!batches.has(key))
        batches.set(key, { material: o.material, geometries: [] });
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      if (!geo.getAttribute("uv"))
        geo.setAttribute(
          "uv",
          new THREE.BufferAttribute(
            new Float32Array(geo.getAttribute("position").count * 2),
            2,
          ),
        );
      if (geo.index) {
        const ni = geo.toNonIndexed();
        geo.dispose();
        batches.get(key).geometries.push(ni);
      } else batches.get(key).geometries.push(geo);
      removal.push(o);
    }
  });
  for (const { material, geometries } of batches.values()) {
    const geo = mergeGeometries(geometries);
    if (geo) {
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    geometries.forEach((g) => g.dispose());
  }
  removal.forEach((o) => o.removeFromParent());
  return { scene, sun, colliders, seats, stations, check };
}
