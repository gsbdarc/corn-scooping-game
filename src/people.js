import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { box, mat, sign, contactShadow } from "./geometry.js";

// Aim an existing joint toward a world-space target while preserving bone length.
function aimBone(bone, child, target) {
  if (!bone || !child) return;
  const origin = bone.getWorldPosition(new THREE.Vector3());
  const current = child
    .getWorldPosition(new THREE.Vector3())
    .sub(origin)
    .normalize();
  const desired = target.sub(origin).normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(current, desired);
  const world = bone
    .getWorldQuaternion(new THREE.Quaternion())
    .premultiply(delta);
  const parentInverse = bone.parent
    .getWorldQuaternion(new THREE.Quaternion())
    .invert();
  bone.quaternion.copy(parentInverse.multiply(world));
  bone.updateMatrixWorld(true);
}
export async function createPeople(scene, seats) {
  const manager = new THREE.LoadingManager();
  const loader = new FBXLoader(manager);
  manager.addHandler(/\.tga$/i, new THREE.TextureLoader(manager));
  manager.setURLModifier((url) => {
    if (/\.(tga|webp)$/i.test(url)) {
      const file = url
        .replaceAll("\\", "/")
        .split("/")
        .pop()
        .replace(/\.tga$/i, ".webp");
      return `${import.meta.env.BASE_URL}assets/people/${file}`;
    }
    return url;
  });
  const names = ["Female_Adult_05", "Female_Adult_08", "Male_Adult_01"];
  const models = await Promise.all(
    names.map((n) =>
      loader.loadAsync(`${import.meta.env.BASE_URL}assets/people/${n}.fbx`),
    ),
  );
  const clips = await Promise.all(
    ["f", "m"].map((s) =>
      loader
        .loadAsync(
          `${import.meta.env.BASE_URL}assets/people/${s}_idle_breathe_01.max.fbx`,
        )
        .then((m) => m.animations[0])
        .catch(() => null),
    ),
  );
  for (let n = 0; n < models.length; n++) {
    const model = models[n];
    let meshNames = [];
    model.traverse((o) => {
      if (o.isMesh) meshNames.push(o.name);
    });
    const hasHipoly = meshNames.some((n) => /hipoly/i.test(n));
    model.traverse((o) => {
      if (o.isMesh) {
        if (hasHipoly && /(midpoly|lowpoly|ultralowpoly)/i.test(o.name))
          o.visible = false;
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
        const convert = (m) => {
          let name = m.name.toLowerCase();
          let tex = m.map;
          if (tex) tex.colorSpace = THREE.SRGBColorSpace;
          const isHair = /opacity|hair|eyelash/i.test(name);
          const normal = new THREE.MeshStandardMaterial({
            name: m.name,
            color: "#ffffff",
            map: tex,
            roughness: isHair ? 0.95 : 0.82,
            metalness: 0,
            side: THREE.DoubleSide,
            alphaTest: isHair ? 0.35 : 0,
          });
          return normal;
        };
        o.material = Array.isArray(o.material)
          ? o.material.map(convert)
          : convert(o.material);
      }
    });
  }
  const people = [],
    mixers = [];
  function person(
    index,
    x,
    z,
    { yaw = 0, sitting = false, lily = false, walk = null } = {},
  ) {
    const model = clone(models[index]);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    scene.add(g);
    g.add(model);
    model.updateMatrixWorld(true);
    let b = new THREE.Box3().setFromObject(model);
    const scale = (lily ? 1.61 : 1.72) / (b.max.y - b.min.y);
    model.scale.setScalar(scale);
    model.position.y = -b.min.y * scale;
    const clip = clips[index === 2 ? 1 : 0];
    if (clip) {
      let tracks = clip.tracks.filter((t) => {
        const name = t.name.split(".")[0];
        return model.getObjectByName(name) && !t.name.endsWith(".position");
      });
      if (tracks.length) {
        const c = new THREE.AnimationClip("breathe", clip.duration, tracks);
        const mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(c).play();
        mixer.update(Math.random() * 3);
        mixers.push(mixer);
      }
    }
    const bones = {};
    model.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
    });
    if (sitting) g.position.y = -0.43;
    if (lily) {
      const apron = mat("#191e1c", 0.95);
      box(g, 0.31, 0.31, 0.025, 0, 1.18, 0.155, apron, 0.025);
      box(g, 0.43, 0.43, 0.035, 0, 0.83, 0.17, apron, 0.024);
      box(g, 0.24, 0.13, 0.008, 0, 0.89, 0.194, mat("#292d28", 0.95), 0.01);
      box(g, 0.38, 0.034, 0.35, 0, 1.07, 0, apron, 0.01);
      for (const side of [-1, 1]) {
        const strap = box(
          g,
          0.032,
          0.12,
          0.025,
          side * 0.115,
          1.37,
          0.105,
          apron,
          0.007,
        );
        strap.rotation.z = side * -0.21;
      }
      sign(g, "Lilybeth", null, 0.12, 0.035, 0.06, 1.28, 0.172, {
        background: "#e8e2cc",
        color: "#2e3930",
        font: "Arial",
        size: 132,
      });
    }
    const shadow = contactShadow(scene, x, z, 1.2, 0.9, 0.29);
    const p = {
      group: g,
      model,
      bones,
      shadow,
      walk,
      sitting,
      lily,
      origin: { x, z },
      phase: Math.random() * 6,
    };
    people.push(p);
    return p;
  }
  const lily = person(0, -7.55, 9.75, { yaw: Math.PI, lily: true });
  const queue = [
    person(2, -7.7, 6.5, { yaw: 0 }),
    person(1, -7.6, 5.15, { yaw: 0 }),
  ];
  for (const [i, seat] of seats
    .filter((_, i) => [0, 3, 8, 13, 18, 23, 28, 31].includes(i))
    .entries())
    person(i % 2 ? 2 : 1, seat.x, seat.z, { yaw: seat.yaw, sitting: true });
  person(2, -8.1, -7.05, {
    yaw: Math.PI,
    walk: { a: [-8, -5.5], b: [-6.5, 1.8], speed: 0.27 },
  });
  person(1, 7, -5.8, {
    yaw: Math.PI,
    walk: { a: [7, -6], b: [7.8, -1], speed: 0.25 },
  });
  person(2, -7.5, -10, { yaw: 0 });
  person(1, 7.5, -10, { yaw: 0 });
  return {
    people,
    lily,
    queue,
    update(dt, t) {
      mixers.forEach((m) => m.update(dt));
      for (const p of people) {
        p.shadow.visible = p.group.visible;
        p.shadow.position.x = p.group.position.x;
        p.shadow.position.z = p.group.position.z;
        if (p.sitting) {
          for (const [side, sign] of [
            ["L", 1],
            ["R", -1],
          ]) {
            const target = (x, y, z) =>
              p.group.localToWorld(new THREE.Vector3(x, y, z));
            aimBone(
              p.bones[`Bip01_${side}_Thigh`],
              p.bones[`Bip01_${side}_Calf`],
              target(sign * 0.1, 0.9, 0.39),
            );
            aimBone(
              p.bones[`Bip01_${side}_Calf`],
              p.bones[`Bip01_${side}_Foot`],
              target(sign * 0.1, 0.49, 0.43),
            );
            aimBone(
              p.bones[`Bip01_${side}_UpperArm`],
              p.bones[`Bip01_${side}_Forearm`],
              target(sign * 0.27, 1.1, 0.1),
            );
            aimBone(
              p.bones[`Bip01_${side}_Forearm`],
              p.bones[`Bip01_${side}_Hand`],
              target(sign * 0.2, 1.25, 0.42),
            );
          }
        }
        if (p.walk) {
          const a = p.walk.a,
            b = p.walk.b,
            phase = (Math.sin(t * p.walk.speed + p.phase) + 1) * 0.5;
          p.group.position.set(
            THREE.MathUtils.lerp(a[0], b[0], phase),
            Math.sin(t * 7 + p.phase) * 0.008,
            THREE.MathUtils.lerp(a[1], b[1], phase),
          );
          const dir = Math.cos(t * p.walk.speed + p.phase) > 0 ? 1 : -1;
          p.group.rotation.y = Math.atan2(
            (b[0] - a[0]) * dir,
            (b[1] - a[1]) * dir,
          );
          for (const [side, sign] of [
            ["L", 1],
            ["R", -1],
          ]) {
            const swing = Math.sin(t * 5 + p.phase) * 0.22 * sign;
            aimBone(
              p.bones[`Bip01_${side}_Thigh`],
              p.bones[`Bip01_${side}_Calf`],
              p.group.localToWorld(new THREE.Vector3(sign * 0.1, 0.46, swing)),
            );
            aimBone(
              p.bones[`Bip01_${side}_Calf`],
              p.bones[`Bip01_${side}_Foot`],
              p.group.localToWorld(
                new THREE.Vector3(sign * 0.1, 0.06, swing * 0.7),
              ),
            );
          }
        }
      }
    },
    resetQueue() {
      queue.forEach((p, i) => {
        p.group.visible = true;
        p.group.position.set(-7.6, 0, 6.5 - i * 1.35);
      });
    },
  };
}
