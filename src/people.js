import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

const smooth = value => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

function rotateWorld(bone, axis, angle) {
  const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const delta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
  bone.updateWorldMatrix(false, true);
}

function aimBone(bone, child, target) {
  const origin = bone.getWorldPosition(new THREE.Vector3());
  const before = child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
  const after = target.clone().sub(origin).normalize();
  const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const delta = new THREE.Quaternion().setFromUnitVectors(before, after);
  bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
  bone.updateWorldMatrix(false, true);
}

// Two rigid arm segments reach the actual keyboard/button/cup position.
function reach(actor, side, target) {
  const upper = actor.model.getObjectByName(`UpperArm${side}`);
  const lower = actor.model.getObjectByName(`LowerArm${side}`);
  const palm = actor.model.getObjectByName(`Palm${side}`);
  const shoulder = upper.getWorldPosition(new THREE.Vector3());
  const elbow = lower.getWorldPosition(new THREE.Vector3());
  const hand = palm.getWorldPosition(new THREE.Vector3());
  const a = shoulder.distanceTo(elbow), b = elbow.distanceTo(hand);
  const direction = target.clone().sub(shoulder);
  const distance = THREE.MathUtils.clamp(direction.length(), Math.abs(a - b) + 0.001, a + b - 0.001);
  direction.normalize();
  const pole = new THREE.Vector3(side === 'L' ? 0.6 : -0.6, -0.8, -0.1).transformDirection(actor.group.matrixWorld);
  pole.addScaledVector(direction, -pole.dot(direction)).normalize();
  const along = (a * a + distance * distance - b * b) / (2 * distance);
  const elbowTarget = shoulder.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
  aimBone(upper, lower, elbowTarget);
  aimBone(lower, palm, shoulder.clone().addScaledVector(direction, distance));
}

// Both CC0 meshes face +Z. Their walk is in place; travel supplies root motion.
export async function createPeople(scene) {
  const loader = new GLTFLoader();
  const models = await Promise.all([
    loader.loadAsync('./public/assets/models/office-man.glb'),
    loader.loadAsync('./public/assets/models/office-colleague.glb'),
  ]);
  const vertex = new THREE.Vector3();
  const actors = new Map();
  function addPerson(person) {
    const index = person.id === 'boss' ? 0 : 1;
    const gltf = models[index];
    const model = clone(gltf.scene);
    const group = new THREE.Group();
    group.name = `person-${person.id}`;
    group.visible = false;
    group.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const idle = mixer.clipAction(gltf.animations.find(clip => clip.name.endsWith('Man_Idle'))).play();
    const walk = mixer.clipAction(gltf.animations.find(clip => clip.name.endsWith('Man_Walk'))).play();
    const sitting = mixer.clipAction(gltf.animations.find(clip => clip.name.endsWith('Man_Sitting'))).play();
    walk.setEffectiveWeight(0);
    sitting.setEffectiveWeight(0);
    mixer.update(0);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const originalHeight = bounds.max.y - bounds.min.y;
    const soles = [];
    const palette = {
      Shirt: ({ boss: '#51667b', lin: '#69705b', mei: '#8d746d', chen: '#536575', zhou: '#877b66', yu: '#767082', xue: '#607d74', an: '#7d7182' })[person.id] ?? '#69705b',
      Pants: index === 0 ? '#333b47' : '#565149',
      Eyes: '#191b20', Skin: '#bb8e70', Hair: '#302b29',
      Details: '#e0ded5', TieTexture: '#64515a',
    };
    model.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // These two small skinned characters can extend beyond their idle bounds.
      mesh.frustumCulled = false;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(material => material.clone()) : mesh.material.clone();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (palette[material.name]) material.color.set(palette[material.name]);
        material.metalness = 0;
        material.roughness = 0.88;
      }
      if (!mesh.isSkinnedMesh) return;
      const indices = [];
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld);
        if (vertex.y < bounds.min.y + originalHeight * 0.08) indices.push(i);
      }
      if (indices.length) soles.push({ mesh, indices });
    });
    scene.add(group);
    const pose = ['Abdomen', 'Neck', 'Head', 'UpperArmL', 'UpperArmR', 'LowerArmL', 'LowerArmR', 'PalmL', 'PalmR', 'FingersL', 'FingersR'].map(name => {
      const bone = model.getObjectByName(name);
      return { bone, quaternion: bone.quaternion.clone() };
    });
    const actor = { id: person.id, group, model, mixer, idle, walk, sitting, pose,
      originalHeight, soles, weight: 0, heading: null, hands: { L: { weight: 0 }, R: { weight: 0 } } };
    actors.set(person.id, actor);
    return actor;
  }
  let previousTime = null;

  return {
    update(people, elapsed) {
      const reset = previousTime === null || elapsed < previousTime || elapsed - previousTime > 0.5;
      const dt = reset ? 0 : Math.min(0.1, Math.max(0, elapsed - previousTime));
      previousTime = elapsed;
      for (const actor of actors.values()) actor.group.visible = false;
      for (const person of people) {
        const actor = actors.get(person.id) ?? addPerson(person);
        actor.group.visible = true;
        const height = person.height ?? 1.76;
        actor.model.scale.setScalar(height / actor.originalHeight);
        const seated = person.seat ? THREE.MathUtils.clamp(person.sitWeight ?? 0, 0, 1) : 0;
        const sitActionWeight = smooth(seated / 0.12);
        const targetWeight = THREE.MathUtils.clamp((person.speed ?? 0) / 0.55, 0, 1);
        actor.weight = reset ? targetWeight : THREE.MathUtils.lerp(actor.weight, targetWeight, 1 - Math.exp(-dt * 12));
        actor.idle.setEffectiveWeight((1 - actor.weight) * (1 - sitActionWeight));
        actor.walk.setEffectiveWeight(actor.weight * (1 - sitActionWeight));
        actor.sitting.setEffectiveWeight(sitActionWeight);
        actor.idle.time = (elapsed + (actor.id === 'lin' ? 1.3 : 0)) % actor.idle.getClip().duration;
        // Measured from both planted soles: one cycle advances 0.98 × body height.
        // ponytail: flat-floor calibration; foot IK is needed for stairs or uneven floors.
        actor.walk.time = (((person.travel ?? 0) / (height * 0.98)) % 1) * actor.walk.getClip().duration;
        const actionTime = Math.max(0, person.actionTime ?? elapsed);
        actor.sitting.time = seated >= 0.999 ? 0.6 + (actionTime % 6) : seated * 0.45;
        // Restore the previous unmodified mixer pose before applying a fresh overlay.
        for (const item of actor.pose) item.bone.quaternion.copy(item.quaternion);
        actor.mixer.update(0);
        for (const item of actor.pose) item.quaternion.copy(item.bone.quaternion);
        const targetHeading = Math.PI - THREE.MathUtils.degToRad(person.heading);
        if (reset || actor.heading === null) actor.heading = targetHeading;
        const turn = Math.atan2(Math.sin(targetHeading - actor.heading), Math.cos(targetHeading - actor.heading));
        actor.heading += THREE.MathUtils.clamp(turn, -dt * 4.8, dt * 4.8);
        actor.group.rotation.y = actor.heading;
        actor.group.position.set(person.x, person.y ?? 0, -person.z);
        actor.group.updateMatrixWorld(true);

        const forward = new THREE.Vector3(0, 0, 1).transformDirection(actor.group.matrixWorld);
        const right = new THREE.Vector3(1, 0, 0).transformDirection(actor.group.matrixWorld);
        const action = person.action;
        const typing = action === 'typing' && actionTime % 7 < 4.5;
        const head = actor.model.getObjectByName('Head');
        let lookYaw = 0;
        rotateWorld(actor.model.getObjectByName('Abdomen'), right, seated * 0.34);
        rotateWorld(actor.model.getObjectByName('Neck'), right, seated * (-0.25 + (typing ? 0.05 : 0)));
        if (action === 'talking' || action === 'looking-window') {
          const target = person.actionTarget;
          if (target) {
            const direction = new THREE.Vector3(target.x - person.x, 0, person.z - target.z).normalize();
            const turn = Math.atan2(forward.clone().cross(direction).y, forward.dot(direction));
            const amount = action === 'looking-window' ? smooth(actionTime / 0.7) : 1;
            lookYaw = THREE.MathUtils.clamp(turn, -0.7, 0.7) * amount;
          }
          rotateWorld(head, right, Math.sin(actionTime * 2.2) * 0.045);
        } else if (action === 'reading') {
          rotateWorld(head, right, elapsed % 8 < 5 ? 0.16 + Math.sin(elapsed * 0.8) * 0.025 : 0.025);
        } else if (seated) {
          rotateWorld(head, right, seated * Math.sin(actionTime * 0.85) * 0.018);
        }
        actor.lookYaw = reset ? lookYaw : THREE.MathUtils.lerp(actor.lookYaw ?? 0, lookYaw, 1 - Math.exp(-dt * 9));
        rotateWorld(actor.model.getObjectByName('Neck'), new THREE.Vector3(0, 1, 0), actor.lookYaw);

        const goals = {};
        const props = person.props ?? {};
        const keyboard = person.seat?.keyboard;
        const cupDesk = keyboard ? new THREE.Vector3(keyboard.x + 0.28, 0.785, -keyboard.z - 0.03) : undefined;
        const paperDesk = keyboard ? new THREE.Vector3(keyboard.x - 0.28, 0.7415, -keyboard.z - 0.015) : undefined;
        const paperTray = new THREE.Vector3(-5.7, 1.135, 2.15);
        let cupCenter;
        let paperCenter;
        let sip = 0;
        if (action === 'typing' && person.seat) {
          const keyboard = person.seat.keyboard;
          for (const [side, sign] of [['L', 1], ['R', -1]]) {
            const tap = typing ? Math.sin(actionTime * Math.PI * 8 + sign) * 0.006 : 0;
            goals[side] = new THREE.Vector3(keyboard.x, keyboard.y + 0.035 + tap, -keyboard.z)
              .addScaledVector(right, sign * 0.1).addScaledVector(forward, -0.075);
          }
        } else if (action === 'printing' && person.actionTarget) {
          const target = person.actionTarget;
          goals.L = actionTime < 3.5 ? new THREE.Vector3(target.x, target.y, -target.z).addScaledVector(forward, -0.05)
            : paperTray.clone().addScaledVector(right, 0.04).addScaledVector(forward, -0.055);
        } else if (action === 'filling' || action === 'drinking') {
          if (action === 'filling' && person.actionTarget) {
            const target = person.actionTarget;
            const rest = actor.group.localToWorld(new THREE.Vector3(-0.16, 0.98, 0.17));
            cupCenter = rest.lerp(new THREE.Vector3(target.x, target.y - 0.045, -target.z), smooth(actionTime / 0.6));
          } else {
            const drinkingTime = Math.max(0, actionTime - 0.6);
            sip = smooth(drinkingTime / 0.8) * (1 - smooth((drinkingTime - 2.2) / 0.8));
            const rest = actor.group.localToWorld(new THREE.Vector3(-0.16, 0.98, 0.17));
            const mouth = head.getWorldPosition(new THREE.Vector3()).addScaledVector(forward, 0.15);
            mouth.y += 0.025;
            cupCenter = rest.lerp(mouth, sip);
            if (actionTime < 0.6 && person.actionTarget) {
              const target = person.actionTarget;
              cupCenter = new THREE.Vector3(target.x, target.y - 0.045, -target.z).lerp(cupCenter, smooth(actionTime / 0.6));
            }
          }
        } else if (action === 'talking') {
          goals.R = actor.group.localToWorld(new THREE.Vector3(-0.2, seated ? 0.86 : 1.05, 0.16 + Math.sin(actionTime * 2) * 0.05));
        } else if (action === 'stretching') {
          goals.L = head.getWorldPosition(new THREE.Vector3()).addScaledVector(right, 0.22);
          goals.R = head.getWorldPosition(new THREE.Vector3()).addScaledVector(right, -0.22);
          goals.L.y += 0.13; goals.R.y += 0.13;
        }
        if (person.id === 'boss') {
          if (action === 'reading') goals.R = actor.group.localToWorld(new THREE.Vector3(-0.12, 1.04 + Math.sin(elapsed * 1.8) * 0.015, 0.24));
        }
        if (props.cup) {
          const resting = actor.group.localToWorld(new THREE.Vector3(-0.16, 0.98 - seated * 0.1, 0.17));
          if (props.cup === 'desk') cupCenter = cupDesk;
          else if (props.cup === 'pickup') cupCenter = cupDesk.clone().lerp(resting, props.cupProgress);
          else if (props.cup === 'putdown') cupCenter = resting.lerp(cupDesk, props.cupProgress);
          else if (!cupCenter) cupCenter = resting;
        }
        if (cupCenter && props.cup !== 'desk') goals.R = cupCenter.clone().addScaledVector(right, -0.06).addScaledVector(forward, -0.04);
        if (props.paper && props.paper !== 'printer') {
          const resting = actor.group.localToWorld(new THREE.Vector3(0.12, person.id === 'boss' ? 1 : 0.91 - seated * 0.04, 0.215));
          if (props.paper === 'desk') paperCenter = paperDesk;
          else if (props.paper === 'pickup') paperCenter = paperTray.clone().lerp(resting, props.paperProgress);
          else if (props.paper === 'putdown') paperCenter = resting.lerp(paperDesk, props.paperProgress);
          else paperCenter = resting;
          if (props.paper !== 'desk') goals.L = paperCenter.clone().addScaledVector(right, 0.04).addScaledVector(forward, -0.055);
        }
        for (const side of ['L', 'R']) {
          const hand = actor.hands[side];
          const palm = actor.model.getObjectByName(`Palm${side}`);
          const goal = goals[side];
          const targetWeight = goal ? 1 : 0;
          if (goal) {
            const local = actor.group.worldToLocal(goal.clone());
            const gripping = side === 'R'
              ? cupCenter && props.cup !== 'desk' && (props.cup !== 'pickup' || props.cupProgress > 0)
              : paperCenter && props.paper !== 'desk';
            // Prop paths are already eased; another lag here would detach the hand.
            if (reset || !hand.local || gripping) hand.local = local;
            else hand.local.lerp(local, 1 - Math.exp(-dt * 10));
          }
          hand.weight = reset ? targetWeight : THREE.MathUtils.lerp(hand.weight, targetWeight, 1 - Math.exp(-dt * 10));
          if (hand.weight > 0.001 && hand.local) {
            const target = palm.getWorldPosition(new THREE.Vector3()).lerp(actor.group.localToWorld(hand.local.clone()), hand.weight);
            reach(actor, side, target);
            if (side === 'R' && cupCenter && props.cup !== 'desk') {
              aimBone(palm, actor.model.getObjectByName('MiddleHandR'), cupCenter);
            } else if (side === 'L' && paperCenter && props.paper !== 'desk') {
              aimBone(palm, actor.model.getObjectByName('MiddleHandL'), paperCenter);
            } else if (action === 'typing') {
              const fingers = actor.model.getObjectByName(`MiddleHand${side}`);
              const direction = forward.clone().add(new THREE.Vector3(0, -0.22, 0)).normalize();
              aimBone(palm, fingers, palm.getWorldPosition(new THREE.Vector3()).add(direction));
            }
          }
        }
        // Ground the actual deformed shoe soles, including during idle/walk blends.
        let soleY = Infinity;
        for (const { mesh, indices } of actor.soles) {
          for (const index of indices) {
            mesh.getVertexPosition(index, vertex).applyMatrix4(mesh.matrixWorld);
            soleY = Math.min(soleY, vertex.y);
          }
        }
        if (Number.isFinite(soleY)) actor.group.position.y += (person.y ?? 0) - soleY;
        actor.group.updateMatrixWorld(true);

        if (cupCenter && !actor.cup) {
          const cup = new THREE.Group();
          cup.name = `cup-${person.id}`;
          const ceramic = new THREE.MeshStandardMaterial({ color: '#d7d2bf', roughness: 0.58 });
          const body = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.09, 12, 1, true), ceramic);
          const handle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 5, 10), ceramic);
          handle.position.x = -0.036;
          body.castShadow = handle.castShadow = true;
          cup.add(body, handle);
          actor.group.add(cup);
          actor.cup = cup;
        }
        if (actor.cup) {
          actor.cup.visible = Boolean(cupCenter);
          if (cupCenter) {
            actor.cup.position.copy(actor.group.worldToLocal(cupCenter.clone()));
            actor.cup.rotation.x = -sip * 0.32;
          }
        }
        if (paperCenter && !actor.paper) {
          actor.paper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.003, 0.21), new THREE.MeshStandardMaterial({ color: '#ede9db', roughness: 1 }));
          actor.paper.name = `paper-${person.id}`;
          actor.paper.castShadow = true;
          actor.group.add(actor.paper);
        }
        if (actor.paper) {
          actor.paper.visible = Boolean(paperCenter);
          if (actor.paper.visible) {
            actor.paper.position.copy(actor.group.worldToLocal(paperCenter.clone()));
            actor.paper.rotation.x = person.id === 'boss' ? -0.9 + Math.sin(elapsed * 1.8) * 0.03 : 0;
          }
        }
      }
    },
    dispose() {
      const resources = new Set();
      for (const actor of actors.values()) {
        actor.mixer.stopAllAction();
        actor.mixer.uncacheRoot(actor.model);
        scene.remove(actor.group);
        actor.group.traverse(mesh => {
          if (!mesh.isMesh) return;
          resources.add(mesh.geometry);
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) resources.add(material);
          if (mesh.skeleton) resources.add(mesh.skeleton);
        });
      }
      for (const resource of resources) resource.dispose();
    },
  };
}
