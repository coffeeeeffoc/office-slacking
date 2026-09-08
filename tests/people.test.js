import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createPeople } from '../src/people.js';
import { createGame } from '../src/game.js';
import { getPeople } from '../src/space.js';

function useLocalModels(t) {
  // Only replace HTTP transport; exercise the real GLBs, skeletons and renderer logic.
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async function (url) {
    const bytes = await readFile(new URL(`../${url}`, import.meta.url));
    const gltf = await this.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    assert.ok(gltf.animations.find(clip => clip.name.endsWith('Man_Idle')));
    const walk = gltf.animations.find(clip => clip.name.endsWith('Man_Walk'));
    assert.ok(walk);
    assert.ok(!walk.tracks.some(track => /^(RootNode|HumanArmature|Bone)\.position$/.test(track.name)), 'walk must not add its own root translation');
    return gltf;
  });
}

test('bundled characters turn as full bodies and keep animated soles on the floor', async t => {
  useLocalModels(t);
  const scene = new THREE.Scene();
  const characters = await createPeople(scene);
  const boss = { id: 'boss', x: 2.5, y: 0, z: 4, height: 1.76, speed: 1.2, travel: 0, heading: 0 };
  const lin = { ...boss, id: 'lin', x: -2.5, height: 1.72, heading: 90 };
  for (let frame = 0; frame < 30; frame++) {
    boss.travel = lin.travel = frame * 0.06;
    if (frame > 10) boss.heading = 180;
    if (frame > 20) boss.speed = lin.speed = 0;
    characters.update([boss, lin], frame * 0.05);
    for (const person of [boss, lin]) {
      const group = scene.getObjectByName(`person-${person.id}`);
      assert.equal(group.position.x, person.x);
      assert.equal(group.position.z, -person.z);
      group.traverse(mesh => { if (mesh.isSkinnedMesh) mesh.computeBoundingBox(); });
      const bounds = new THREE.Box3().setFromObject(group);
      assert.ok(Math.abs(bounds.min.y) < 0.003, `deformed shoe sole must touch ground, got ${bounds.min.y}`);
      assert.ok(bounds.max.y > 1.5 && bounds.max.y < 1.85, 'human dimensions remain stable');
    }
  }
  const group = scene.getObjectByName('person-boss');
  assert.ok(Math.abs(group.rotation.y) < 0.05, 'body turns toward logical -Z, instead of always facing the viewer');
  const foot = group.getObjectByName('FootL');
  const paused = foot.getWorldPosition(new THREE.Vector3()).clone();
  characters.update([boss, lin], 29 * 0.05);
  assert.ok(foot.getWorldPosition(new THREE.Vector3()).distanceTo(paused) < 1e-6, 'paused time holds the full body pose');

  // The authored cycle's planted foot moves backward ~1.725 m at 1.76 m height.
  // Drive root motion independently and follow the SAME shoe vertex throughout
  // each support interval. A character merely pinned vertically still fails this.
  for (const person of [boss, lin]) {
    for (const [side, start, end] of [[-1, 0.05, 0.18], [1, 0.4, 0.59]]) {
      person.x = 0;
      person.heading = 180;
      person.speed = 1.2;
      const measuredCycleDistance = 1.725 * person.height / 1.76;
      const startTravel = start * measuredCycleDistance;
      const finishTravel = end * measuredCycleDistance;
      person.travel = startTravel;
      person.z = -person.travel;
      characters.update([person], 0);
      const actor = scene.getObjectByName(`person-${person.id}`);
      let planted;
      const point = new THREE.Vector3();
      actor.traverse(mesh => {
        if (!mesh.isSkinnedMesh) return;
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
          if (point.x * side > 0 && (!planted || point.y < planted.y)) planted = { mesh, index: i, y: point.y };
        }
      });
      const positions = [];
      for (let frame = 0; frame <= 30; frame++) {
        person.travel = startTravel + (finishTravel - startTravel) * frame / 30;
        person.z = -person.travel;
        characters.update([person], (person.travel - startTravel) / person.speed);
        planted.mesh.getVertexPosition(planted.index, point).applyMatrix4(planted.mesh.matrixWorld);
        positions.push(point.z);
      }
      const slip = Math.max(...positions) - Math.min(...positions);
      assert.ok(slip < 0.009, `${person.id} support foot must slip less than 9 mm, got ${slip}`);
    }
  }
  characters.dispose();
  assert.equal(scene.children.length, 0);
});

test('office colleagues sit on their chairs, type at the keyboard and have independent skeletons', async t => {
  useLocalModels(t);
  const scene = new THREE.Scene();
  const characters = await createPeople(scene);
  const state = createGame();
  for (let frame = 0; frame <= 30; frame++) {
    state.elapsed = frame / 30;
    characters.update(getPeople(state), state.elapsed);
  }
  const occupiedBones = new Set();
  for (const person of getPeople(state).filter(person => person.seated)) {
    const group = scene.getObjectByName(`person-${person.id}`);
    const personBones = new Set();
    group.traverse(mesh => { if (mesh.isSkinnedMesh) { mesh.computeBoundingBox(); for (const bone of mesh.skeleton.bones) personBones.add(bone); } });
    for (const bone of personBones) {
      assert.ok(!occupiedBones.has(bone), 'colleagues do not share animated bones');
      occupiedBones.add(bone);
    }
    const box = new THREE.Box3().setFromObject(group);
    assert.ok(Math.abs(box.min.y) < 0.003, 'seated shoes touch the floor');
    assert.ok(box.max.y > 1.2 && box.max.y < 1.5, 'seated head is below standing height');
    for (const [side, sign] of [['L', -1], ['R', 1]]) {
      const wrist = group.getObjectByName(`Palm${side}`).getWorldPosition(new THREE.Vector3());
      const keyboard = person.seat.keyboard;
      assert.ok(Math.abs(wrist.x - (keyboard.x + sign * 0.1)) < 0.025, `${person.id} wrist reaches its own keyboard`);
      assert.ok(Math.abs(wrist.y - (keyboard.y + 0.035)) < 0.015, 'wrist rests just above the keys');
      assert.ok(Math.abs(wrist.z - (-keyboard.z + 0.075)) < 0.025, 'hands do not type in midair behind the keyboard');
    }
    let cushionContact = Infinity;
    const point = new THREE.Vector3();
    group.traverse(mesh => {
      if (!mesh.isSkinnedMesh || mesh.material.name !== 'Pants') return;
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
        if (Math.abs(point.x - person.seat.x) < 0.2 && Math.abs(point.z + person.seat.z) < 0.1 && point.y > 0.3) cushionContact = Math.min(cushionContact, point.y);
      }
    });
    assert.ok(Math.abs(cushionContact - person.seat.height) < 0.025, `hips must rest on the cushion, contact=${cushionContact}`);
  }
  characters.dispose();
});

test('water cup reaches the dispenser and the lip without entering the head', async t => {
  useLocalModels(t);
  const scene = new THREE.Scene();
  const characters = await createPeople(scene);
  const state = createGame();
  state.elapsed = 50;
  const lin = getPeople(state).find(person => person.id === 'lin');
  characters.update([lin], state.elapsed);
  const cup = scene.getObjectByName('cup-lin');
  const opening = cup.localToWorld(new THREE.Vector3(0, 0.045, 0));
  const spout = new THREE.Vector3(lin.actionTarget.x, lin.actionTarget.y, -lin.actionTarget.z);
  t.diagnostic(`dispenser cup-opening error: ${(opening.distanceTo(spout) * 1000).toFixed(1)} mm`);
  assert.ok(opening.distanceTo(spout) < 0.02, `cup opening reaches water, error=${opening.distanceTo(spout)}`);
  for (let frame = 0; frame <= 45; frame++) {
    state.elapsed = 51.7 + frame / 30;
    characters.update([getPeople(state).find(person => person.id === 'lin')], state.elapsed);
  }
  const head = scene.getObjectByName('person-lin').getObjectByName('Head').getWorldPosition(new THREE.Vector3());
  const facing = new THREE.Vector3(0, 0, 1).transformDirection(scene.getObjectByName('person-lin').matrixWorld);
  const mouth = head.clone().addScaledVector(facing, 0.11).add(new THREE.Vector3(0, 0.07, 0));
  const rim = cup.localToWorld(new THREE.Vector3(0, 0.045, -0.034));
  t.diagnostic(`drinking rim-to-lip distance: ${(rim.distanceTo(mouth) * 1000).toFixed(1)} mm`);
  assert.ok(rim.distanceTo(mouth) < 0.06, `cup rim reaches lip, error=${rim.distanceTo(mouth)}`);
  assert.ok(cup.getWorldPosition(new THREE.Vector3()).sub(head).dot(facing) > 0.05, 'cup stays in front of the head');
  const handCenter = new THREE.Vector3();
  let handVertices = 0;
  scene.getObjectByName('person-lin').traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      let handWeight = 0;
      for (let component = 0; component < 4; component++) {
        const boneIndex = mesh.geometry.attributes.skinIndex.getComponent(i, component);
        if (/^(Palm|MiddleHand|Fingers|Thumb1|Thumb2)R$/.test(mesh.skeleton.bones[boneIndex].name)) handWeight += mesh.geometry.attributes.skinWeight.getComponent(i, component);
      }
      if (handWeight > 0.5) {
        handCenter.add(mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
        handVertices++;
      }
    }
  });
  handCenter.divideScalar(handVertices);
  t.diagnostic(`actual skinned right-hand centroid: ${handCenter.toArray().map(value => value.toFixed(3)).join(', ')}`);
  assert.ok(handVertices > 10, 'the check measures the visible hand mesh');
  assert.ok(handCenter.y > head.y - 0.12, 'the deformed hand mesh rises to the mouth along with its bones');
  assert.ok(handCenter.distanceTo(cup.getWorldPosition(new THREE.Vector3())) < 0.18, 'the actual hand mesh holds the cup');
  characters.dispose();
});

test('the same cup and printed page move continuously between the desk, hands and stations', async t => {
  useLocalModels(t);
  const scene = new THREE.Scene();
  const characters = await createPeople(scene);
  const state = createGame();
  const identities = new Map();
  for (const [start, end] of [[25.8, 28.3], [42.7, 44.6], [47.5, 48.5], [51.5, 53.3], [55.5, 56.5], [68.9, 71]]) {
    const lastPositions = new Map();
    for (let frame = 0; start + frame / 30 <= end; frame++) {
      state.elapsed = Math.round((start + frame / 30) * 100000) / 100000;
      const lin = getPeople(state).find(person => person.id === 'lin');
      characters.update([lin], state.elapsed);
      for (const type of ['cup', 'paper']) {
        const prop = scene.getObjectByName(`${type}-lin`);
        if (!prop?.visible) continue;
        if (identities.has(type)) assert.equal(prop.uuid, identities.get(type), 'the same object is handed between locations');
        identities.set(type, prop.uuid);
        const position = prop.getWorldPosition(new THREE.Vector3());
        if (lastPositions.has(type)) assert.ok(position.distanceTo(lastPositions.get(type)) < 0.065, `${type} must not teleport at t=${state.elapsed}`);
        lastPositions.set(type, position);
        if (lin.props[type] === 'held' && lin.actionTime > 0.7) {
          const hand = scene.getObjectByName('person-lin').getObjectByName(type === 'cup' ? 'PalmR' : 'PalmL').getWorldPosition(new THREE.Vector3());
          assert.ok(position.distanceTo(hand) < 0.12, `${type} stays in the actual hand at t=${state.elapsed}`);
        }
      }
    }
  }
  state.elapsed = 71;
  characters.update(getPeople(state), state.elapsed);
  for (const type of ['cup', 'paper']) {
    const prop = scene.getObjectByName(`${type}-lin`);
    assert.ok(prop.visible, `returned ${type} remains visible on the desk`);
    const bounds = new THREE.Box3().setFromObject(prop);
    assert.ok(Math.abs(bounds.min.y - 0.74) < 0.001, `${type} bottom contacts the physical desk`);
  }
  characters.dispose();
});
