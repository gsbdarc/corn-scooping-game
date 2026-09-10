import * as THREE from "three";
import { box, ellipsoid, rod, mat, hand, rand } from "./geometry.js";
import { kernelGeometry, kernelMaterial } from "./food.js";
import { CORN_KERNELS, addItem, settleKernel } from "./game-state.js";
export class CornInteraction {
  constructor({
    scene,
    camera,
    canvas,
    dish,
    meal,
    onChange,
    onSound,
    onToast,
  }) {
    Object.assign(this, {
      scene,
      camera,
      canvas,
      dish,
      meal,
      onChange,
      onSound,
      onToast,
    });
    this.active = false;
    this.target = new THREE.Vector3(-0.7, 1.53, -8.6);
    this.down = false;
    this.load = null;
    this.phase = "empty";
    this.dip = 0;
    this.particles = [];
    this.spawned = 0;
    this.pourTimer = 0;
    this.keys = new Set();
    this.scoop = new THREE.Group();
    scene.add(this.scoop);
    this.scoop.visible = false;
    const steel = mat("#aeb5af", 0.19, 0.88);
    const bowl = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.1,
        28,
        16,
        0,
        Math.PI * 2,
        Math.PI / 2,
        Math.PI / 2,
      ),
      new THREE.MeshStandardMaterial({
        color: "#bfc4b9",
        metalness: 0.88,
        roughness: 0.2,
        side: THREE.DoubleSide,
      }),
    );
    bowl.scale.set(1, 0.6, 1.3);
    this.scoop.add(bowl);
    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(0.099, 0.006, 8, 36),
      steel,
    );
    lip.rotation.x = Math.PI / 2;
    lip.scale.set(1, 1.3, 1);
    this.scoop.add(lip);
    rod(this.scoop, [0.04, 0, 0.03], [0.24, 0.055, 0.34], 0.012, steel);
    rod(
      this.scoop,
      [0.22, 0.053, 0.31],
      [0.3, 0.073, 0.45],
      0.023,
      mat("#363b35", 0.83),
    );
    this.rightHand = hand(this.scoop, {
      sleeve: "#d2c7af",
      side: -1,
      forearm: false,
    });
    this.rightHand.position.set(0.267, 0.08, 0.38);
    this.rightHand.rotation.y = -0.55;
    this.held = new THREE.Group();
    this.scoop.add(this.held);
    for (let i = 0; i < CORN_KERNELS; i++) {
      const m = new THREE.Mesh(kernelGeometry, kernelMaterial);
      m.position.set(
        rand(-0.065, 0.065),
        rand(-0.016, 0.025),
        rand(-0.08, 0.08),
      );
      m.scale.set(0.014, 0.012, 0.018);
      m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
      this.held.add(m);
    }
    this.held.visible = false;
    this.leftHand = hand(scene, { side: 1, forearm: false });
    this.leftHand.position.set(0.78, 1.085, -8.29);
    this.leftHand.rotation.y = 0.25;
    this.leftHand.visible = false;
    this.arms = [this.rightHand, this.leftHand].map((wrist, i) => {
      const skin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.029, 0.037, 1, 16),
        mat("#c38f69", 0.67),
      );
      const sleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.065, 1, 16),
        mat("#d2c7af", 0.95),
      );
      skin.castShadow = sleeve.castShadow = true;
      scene.add(skin, sleeve);
      skin.visible = sleeve.visible = false;
      return { wrist, skin, sleeve, side: i === 0 ? -1 : 1 };
    });
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.3);
    this.mouse = new THREE.Vector2();
    canvas.addEventListener("pointermove", (e) => {
      if (!this.active) return;
      this.mouse.set(
        (e.clientX / innerWidth) * 2 - 1,
        (-e.clientY / innerHeight) * 2 + 1,
      );
      this.ray.setFromCamera(this.mouse, camera);
      const p = new THREE.Vector3();
      if (this.ray.ray.intersectPlane(this.plane, p)) {
        this.target.x = THREE.MathUtils.clamp(p.x, -2.25, 2.1);
        this.target.z = THREE.MathUtils.clamp(p.z, -9.65, -7.85);
      }
    });
    canvas.addEventListener("pointerdown", (e) => {
      if (this.active && e.button === 0) {
        canvas.setPointerCapture(e.pointerId);
        this.press();
      }
    });
    window.addEventListener("pointerup", () => this.release());
  }
  press() {
    this.down = true;
    if (this.phase === "lifted") {
      this.phase = "pouring";
      this.spawned = 0;
      this.pourTimer = 0;
    }
  }
  release() {
    this.down = false;
    if (this.phase === "loaded") this.phase = "lifted";
  }
  enter(meal) {
    this.meal = meal;
    this.active = true;
    this.scoop.visible = true;
    this.leftHand.visible = true;
    this.arms.forEach((a) => {
      a.skin.visible = a.sleeve.visible = true;
    });
    this.target.set(-0.7, 1.53, -8.6);
    this.scoop.position.copy(this.target);
    this.phase = "empty";
    this.dip = 0;
    this.down = false;
    this.load = null;
    this.held.visible = false;
    this.setText(
      1,
      "Move over the corn. Hold to dip.",
      "Move the mouse to guide your scoop. Hold the button to lower it.",
    );
  }
  leave() {
    if (this.load || this.particles.some((p) => !p.counted)) {
      this.onToast("Pour your scoop and let the corn settle before leaving.");
      return false;
    }
    this.active = false;
    this.down = false;
    this.scoop.visible = false;
    this.leftHand.visible = false;
    this.arms.forEach((a) => {
      a.skin.visible = a.sleeve.visible = false;
    });
    return true;
  }
  setText(step, title, detail) {
    document.querySelector("#scoop-step").textContent = step;
    document.querySelector("#scoop-instruction").textContent = title;
    document.querySelector("#scoop-detail").textContent = detail;
  }
  update(dt) {
    if (this.active) {
      const speed = 1.1 * dt;
      if (this.keys.has("ArrowLeft")) this.target.x -= speed;
      if (this.keys.has("ArrowRight")) this.target.x += speed;
      if (this.keys.has("ArrowUp")) this.target.z -= speed;
      if (this.keys.has("ArrowDown")) this.target.z += speed;
      this.target.x = THREE.MathUtils.clamp(this.target.x, -2.25, 2.1);
      this.target.z = THREE.MathUtils.clamp(this.target.z, -9.65, -7.85);
      const inTray =
        Math.abs(this.target.x + 0.7) < 0.77 &&
        Math.abs(this.target.z + 8.68) < 0.39;
      const dipping = this.down && this.phase === "empty";
      this.target.y =
        dipping || (this.phase === "loaded" && this.down) ? 1.1 : 1.56;
      this.scoop.position.lerp(this.target, 1 - Math.exp(-12 * dt));
      this.scoop.rotation.z = THREE.MathUtils.lerp(
        this.scoop.rotation.z,
        this.phase === "pouring" ? -1.5 : 0,
        1 - Math.exp(-10 * dt),
      );
      for (const arm of this.arms) {
        const wrist = arm.wrist.localToWorld(new THREE.Vector3(0, 0, 0.035));
        const shoulder = this.camera.localToWorld(
          new THREE.Vector3(arm.side * 0.46, -0.68, -0.1),
        );
        const cuff = wrist.clone().lerp(shoulder, 0.3);
        const positionSegment = (mesh, a, b) => {
          mesh.position.copy(a).add(b).multiplyScalar(0.5);
          mesh.scale.y = a.distanceTo(b);
          mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            b.clone().sub(a).normalize(),
          );
        };
        positionSegment(arm.skin, wrist, cuff);
        positionSegment(arm.sleeve, cuff, shoulder);
      }
      if (dipping && inTray && this.scoop.position.y < 1.15) {
        this.dip += dt;
        if (this.dip > 0.28) {
          const result = addItem(this.meal, "corn");
          if (result.ok) {
            this.load = result.item;
            this.phase = "loaded";
            this.held.visible = true;
            this.onChange();
            this.onSound("scoop");
            this.setText(
              2,
              "Release to lift your scoop.",
              "One scoop added · $1.50. Every little kernel counts.",
            );
          } else {
            this.down = false;
            this.onToast(result.reason);
          }
          this.dip = 0;
        }
      } else this.dip = 0;
      if (this.phase === "lifted")
        this.setText(
          3,
          "Move over your plate. Hold to tip.",
          "Aim for the center of the plate on the right. Corn can miss or overflow.",
        );
      if (this.phase === "pouring") {
        this.pourTimer += dt * 95;
        while (this.pourTimer >= 1 && this.spawned < CORN_KERNELS) {
          this.pourTimer--;
          this.spawnKernel();
          this.held.children[this.spawned].visible = false;
          this.spawned++;
        }
        if (this.spawned >= CORN_KERNELS) {
          this.load = null;
          this.held.visible = false;
          this.held.children.forEach((c) => (c.visible = true));
          this.phase = "empty";
          this.down = false;
          this.onSound("pour");
          this.setText(
            1,
            "Another scoop? Dip back into the corn.",
            "Each scoop is $1.50. Press E when your plate looks right.",
          );
        }
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.velocity.y -= 4.8 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.rotation.x += dt * 3;
      p.mesh.rotation.z += dt * 2;
      if (!p.counted && p.mesh.position.y < 1.135) {
        const local = this.dish.worldToLocal(p.mesh.position.clone());
        const r = Math.hypot(local.x, local.z);
        const kernels = this.dish.children.filter(
          (c) => c.userData.kernel,
        ).length;
        let landed = r < 0.205 && kernels < 330;
        settleKernel(this.meal, p.id, landed);
        p.counted = true;
        this.onChange();
        if (landed) {
          this.dish.attach(p.mesh);
          // Let kernels spread onto nearby low spots instead of occupying the
          // same point. Existing kernels support the next layer of the pile.
          const settled = this.dish.children.filter(c => c.userData.kernel);
          let best = null;
          for(let attempt=0;attempt<12;attempt++){
            const angle = rand(0,Math.PI*2);
            const spread = attempt===0 ? 0 : rand(.015,Math.min(.15,.025+Math.sqrt(kernels)*.007));
            const x=local.x+Math.cos(angle)*spread,z=local.z+Math.sin(angle)*spread;
            if(Math.hypot(x,z)>.195)continue;
            let y=.02;
            for(const kernel of settled){
              if(Math.hypot(x-kernel.position.x,z-kernel.position.z)<.026)
                y=Math.max(y,kernel.position.y+.017);
            }
            const score=y+spread*.18;
            if(!best||score<best.score)best={x,y,z,score};
          }
          if(best)p.mesh.position.set(best.x,best.y,best.z);
          else p.mesh.position.y=.025;
          p.mesh.userData.kernel = true;
          p.mesh.userData.itemId = p.id;
          this.particles.splice(i, 1);
          continue;
        }
        p.velocity.x += (Math.random() - 0.5) * 0.6;
        p.velocity.z += 0.25;
        p.velocity.y = 0.35;
      }
      const counter =
        p.mesh.position.x > -2.8 &&
        p.mesh.position.x < 2.8 &&
        p.mesh.position.z > -9.74 &&
        p.mesh.position.z < -7.99;
      const surface = counter ? 1.073 : 0.025;
      if (p.counted && p.mesh.position.y < surface) {
        p.mesh.position.y = surface;
        if (p.bounces++ < 2) {
          p.velocity.y = Math.abs(p.velocity.y) * 0.3;
          p.velocity.x *= 0.55;
          p.velocity.z *= 0.7;
        } else {
          p.velocity.set(0, 0, 0);
        }
      }
      if (p.life > 8) {
        p.mesh.removeFromParent();
        this.particles.splice(i, 1);
      }
    }
  }
  spawnKernel() {
    const mesh = new THREE.Mesh(kernelGeometry, kernelMaterial);
    mesh.scale.set(rand(0.012, 0.016), rand(0.012, 0.017), rand(0.014, 0.02));
    mesh.position.copy(this.scoop.position);
    mesh.position.x -= 0.063;
    mesh.position.y -= 0.02;
    mesh.position.z += rand(-0.035, 0.035);
    mesh.castShadow = true;
    sceneAdd(this.scene, mesh);
    this.particles.push({
      mesh,
      velocity: new THREE.Vector3(rand(-0.12, 0.04), -0.1, rand(-0.07, 0.07)),
      id: this.load.id,
      counted: false,
      life: 0,
      bounces: 0,
    });
  }
  reset() {
    this.particles.forEach((p) => p.mesh.removeFromParent());
    this.particles = [];
    this.load = null;
    this.active = false;
    this.scoop.visible = false;
    this.leftHand.visible = false;
    this.arms.forEach((a) => {
      a.skin.visible = a.sleeve.visible = false;
    });
  }
}
function sceneAdd(scene, mesh) {
  scene.add(mesh);
}
