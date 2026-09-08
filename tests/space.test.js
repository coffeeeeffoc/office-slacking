import test from 'node:test';
import assert from 'node:assert/strict';
import { act, advance, createGame, getBoss, visits } from '../src/game.js';
import { getPeople, projectPoint, verticalFov, wrapAngle } from '../src/space.js';
import { bodyRadius, corridors, furniture, room, seats, stops } from '../src/layout.js';

const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be near ${expected}`);

test('turning and pitching project the same world into the center of the view', () => {
  for (const [point, yaw] of [
    [{ x: 0, y: 1.2, z: 4 }, 0],
    [{ x: 4, y: 1.2, z: 0 }, 90],
    [{ x: 0, y: 1.2, z: -4 }, 180],
    [{ x: -4, y: 1.2, z: 0 }, -90],
  ]) {
    const projected = projectPoint(point, yaw, 0, 1200, 800);
    close(projected.x, 600);
    close(projected.y, 400);
    close(projected.depth, 4);
    close(projected.distance, 4);
    assert.equal(projected.visible, true);
  }
  const elevated = { x: 0, y: 3.2, z: 2 };
  assert.ok(projectPoint(elevated, 0, 0, 1200, 800).y < 400);
  close(projectPoint(elevated, 0, 45, 1200, 800).y, 400);
  close(projectPoint({ x: 0, y: -0.8, z: 2 }, 0, -45, 1200, 800).y, 400);
  assert.equal(wrapAngle(180), -180);
  assert.equal(wrapAngle(-181), 179);
  assert.equal(wrapAngle(721), 1);
  assert.equal(wrapAngle(-721), -1);
});

test('projection clips behind the camera and adapts to portrait framing', () => {
  assert.equal(verticalFov(1200, 800), 64);
  assert.equal(verticalFov(400, 800), 76);
  const point = { x: 2, y: 1.2, z: 4 };
  assert.equal(projectPoint(point, 0, 0, 1200, 800).visible, true);
  assert.equal(projectPoint(point, 0, 0, 400, 800).visible, false);
  for (const z of [-3, 0, 0.05]) {
    const projected = projectPoint({ x: 0, y: 1.2, z }, 0, 0, 1200, 800);
    assert.equal(projected.visible, false);
    assert.ok(Number.isFinite(projected.x) && Number.isFinite(projected.y));
  }
  const near = projectPoint({ x: 0, y: 1.2, z: 2 }, 0, 0, 1200, 800);
  const far = projectPoint({ x: 0, y: 1.2, z: 4 }, 0, 0, 1200, 800);
  close(near.scale, far.scale * 2);
});

test('people carry measured ground distances and continuous positions through every visit boundary', () => {
  for (const seed of [1, 2, 3, -1, NaN]) {
    for (const questionExtended of [false, true]) {
      const state = Object.assign(createGame(seed), { questionExtended });
      const route = visits(state);
      const sample = (elapsed) => getPeople({ ...state, elapsed });
      for (const time of route.flatMap(({ start, end }) => [start, start + 4, start + 9, end, end + 5])) {
        const before = sample(time - 0.000001)[0];
        const after = sample(time + 0.000001)[0];
        close(before.x, after.x, 0.00001);
        close(before.z, after.z, 0.00001);
      }
      const initial = sample(0)[0];
      close(initial.distance, Math.hypot(2.2, 6.7));
      for (const visit of route) {
        const beside = sample(visit.start + 9)[0];
        close(beside.distance, Math.hypot(2.2, 0.8));
        close(beside.bearing, Math.atan2(beside.x, beside.z) * 180 / Math.PI);
        assert.equal(beside.alert, true);
        assert.equal(beside.moving, false);
        assert.equal(Math.sign(beside.x), visit.side === 'left' ? -1 : 1);
      }
      const between = sample((route[0].end + 5 + route[1].start) / 2)[0];
      close(between.x, route[1].side === 'left' ? -2.2 : 2.2);
      close(between.z, 6.7);
      assert.equal(between.moving, false, 'walk across at a natural pace, then wait instead of slow-motion sliding');
      assert.deepEqual(sample(route[1].end + 6)[0], sample(90)[0]);
      for (const elapsed of [0, 18, 28, 40, 49, 68, 89]) {
        for (const person of sample(elapsed)) close(person.distance, Math.hypot(person.x, person.z));
      }
      const unchanged = structuredClone(state);
      getPeople(state);
      assert.deepEqual(state, unchanged);
    }
  }
});

test('colleagues work at matched seats while Lin makes one useful errand and a short conversation', () => {
  const state = createGame();
  const sample = (elapsed) => getPeople({ ...state, elapsed });
  assert.equal(sample(0).length, seats.length + 1);
  assert.ok(seats.length >= 5);
  for (const [elapsed, action, point] of [
    [0, 'typing', stops.colleague], [27.6, 'standing-up', stops.colleague],
    [40, 'printing', stops.printer], [49, 'filling', stops.water],
    [53, 'drinking', stops.water], [64, 'talking', stops.colleagueAisle],
    [68.8, 'sitting-down', stops.colleague], [80, 'typing', stops.colleague],
  ]) {
    const person = sample(elapsed)[1];
    assert.equal(person.action, action);
    close(person.x, point.x);
    close(person.z, point.z);
    assert.equal(person.moving, false);
    assert.ok(person.actionTime >= 0);
  }
  for (const elapsed of [29.2, 32, 36, 46, 59, 67]) assert.equal(sample(elapsed)[1].moving, true);
  const boundaries = [27, 28.2, 28.8, 29.7, 30.4, 34.7, 35.3, 37.9, 38.5, 44.5, 45.1, 47.1, 47.7, 51.7, 52.3, 55.7, 56.3, 57.1, 57.8, 62.1, 62.7, 66.7, 67.6, 68.2, 69.4];
  for (const time of boundaries) {
    const before = sample(time - 1e-6)[1];
    const after = sample(time + 1e-6)[1];
    close(before.x, after.x, 1e-5);
    close(before.z, after.z, 1e-5);
    close(before.sitWeight, after.sitWeight, 1e-5);
  }
  let working = 0;
  for (let elapsed = 0; elapsed < 90; elapsed += 0.1) {
    const people = sample(elapsed);
    if (people[1].action === 'typing') working += 0.1;
    assert.ok(people.filter(person => person.seated).length >= seats.length - 1, 'most colleagues remain at their desks');
    for (const person of people.slice(2)) {
      assert.equal(person.speed, 0);
      assert.equal(person.travel, 0);
      assert.equal(person.sitWeight, 1);
      assert.equal(person.action, person.id === 'mei' && elapsed >= 62.7 && elapsed < 66.7 ? 'talking' : person.id === 'zhou' && elapsed >= 12 && elapsed < 15 ? 'stretching' : person.id === 'yu' && elapsed >= 18 && elapsed < 22 ? 'looking-window' : 'typing');
      close(person.x, person.seat.x);
      close(person.z, person.seat.z + 0.24);
    }
  }
  assert.ok(working > 45, `Lin should spend most of the scene at work, got ${working}`);
  const beforeDrinkTurn = sample(51.7)[1];
  const drinkTurn = sample(52)[1];
  const drinking = sample(52.3)[1];
  close(wrapAngle(beforeDrinkTurn.heading - 180), 0);
  close(drinkTurn.heading, 135);
  close(drinking.heading, 90);
  close(drinkTurn.x, beforeDrinkTurn.x); close(drinkTurn.z, beforeDrinkTurn.z);
  close(drinkTurn.speed, 0); close(drinking.speed, 0);
  close(sample(55.9)[1].heading, 90);
  const stretch = sample(13).find(person => person.id === 'zhou');
  assert.equal(stretch.action, 'stretching'); close(stretch.actionTime, 1);
  const glance = sample(20).find(person => person.id === 'yu');
  assert.equal(glance.action, 'looking-window'); close(glance.actionTime, 2);
  assert.deepEqual(glance.actionTarget, { x: -7, y: 1.4, z: glance.seat.z });
  assert.equal(sample(16).find(person => person.id === 'zhou').action, 'typing');
  assert.equal(sample(23).find(person => person.id === 'yu').action, 'typing');
  const conversation = sample(64);
  assert.equal(conversation.find(person => person.id === 'mei').action, 'talking');
  assert.ok(Math.hypot(conversation[1].x - conversation[2].x, conversation[1].z - conversation[2].z) < 2);
  assert.deepEqual(sample(49)[1].actionTarget, { x: -3.9, y: 0.94, z: -2.14 });
  assert.deepEqual(sample(51.7)[1].actionTarget, sample(49)[1].actionTarget, 'drinking starts by withdrawing the cup from the same dispenser point');
  for (const [elapsed, cup, paper] of [
    [0, 'desk', 'printer'], [26.2, 'pickup', 'printer'], [26.8, 'pickup', 'printer'],
    [30, 'held', 'printer'], [43.5, 'held', 'pickup'], [50, 'held', 'held'],
    [68.8, 'held', 'held'], [69.9, 'putdown', 'putdown'], [75, 'desk', 'desk'],
  ]) {
    const props = sample(elapsed)[1].props;
    assert.equal(props.cup, cup); assert.equal(props.paper, paper);
    assert.ok(props.cupProgress >= 0 && props.cupProgress <= 1);
    assert.ok(props.paperProgress >= 0 && props.paperProgress <= 1);
  }
  close(sample(26.2)[1].props.cupProgress, 0, 1e-8);
  close(sample(26.35)[1].props.cupProgress, 0, 1e-8);
  assert.ok(sample(26.8)[1].props.cupProgress > 0.7);
  close(sample(43.5)[1].props.paperProgress, 0.5);
  close(sample(69.9)[1].props.cupProgress, 0.5);
  close(sample(69.9)[1].props.paperProgress, 0.5);
  assert.equal(sample(0)[0].props.paper, 'held');
  assert.equal(sample(90)[0].props.paper, 'held');
  for (const seat of seats) {
    const chair = furniture.find(item => item.id === seat.chairId);
    const desk = furniture.find(item => item.id === seat.deskId);
    close(chair.x, seat.x); close(chair.z, seat.z); close(chair.seatHeight, seat.height);
    assert.ok(Math.abs(seat.keyboard.x - desk.x) < desk.width / 2);
    assert.ok(Math.abs(seat.keyboard.z - desk.z) < desk.depth / 2);
    assert.ok(seat.keyboard.y > desk.height && seat.keyboard.y < desk.height + 0.04);
    close(seat.z + 0.24, desk.z - desk.depth / 2 - 0.25);
  }
});

test('feet stay in clear floor corridors and turn before moving with frame-independent travel', () => {
  for (const seed of [1, 2]) {
    const state = createGame(seed);
    let previous = getPeople(state);
    for (let elapsed = 0.01; elapsed <= 90; elapsed += 0.01) {
      const people = getPeople({ ...state, elapsed });
      for (const [index, person] of people.entries()) {
        assert.equal(person.y, 0);
        assert.ok(Number.isFinite(person.heading) && Number.isFinite(person.speed));
        assert.ok(person.speed >= 0 && person.speed < 1.7);
        close(person.distance, Math.hypot(person.x, person.z));
        assert.ok(person.x > room.minX + bodyRadius && person.x < room.maxX - bodyRadius);
        assert.ok(person.z > room.minZ + bodyRadius && person.z < room.maxZ - bodyRadius);
        if (!person.seated) assert.ok(corridors.some((area) => person.x - bodyRadius >= area.minX && person.x + bodyRadius <= area.maxX && person.z - bodyRadius >= area.minZ && person.z + bodyRadius <= area.maxZ), `${person.id} left the aisle at ${elapsed}`);
        for (const obstacle of furniture) {
          // Standing up and docking necessarily use one's own chair space. No route crosses any other chair.
          if (person.seat?.chairId === obstacle.id && Math.hypot(person.x - person.seat.x, person.z - person.seat.z) < 0.85) continue;
          const dx = Math.max(0, Math.abs(person.x - obstacle.x) - obstacle.width / 2);
          const dz = Math.max(0, Math.abs(person.z - obstacle.z) - obstacle.depth / 2);
          assert.ok(Math.hypot(dx, dz) >= bodyRadius, `${person.id} crossed ${obstacle.id} at ${elapsed}`);
        }
        const before = previous[index];
        const moved = Math.hypot(person.x - before.x, person.z - before.z);
        assert.ok(person.travel >= before.travel - 1e-8);
        close(person.travel - before.travel, moved, 1e-7);
        const turn = Math.abs(wrapAngle(person.heading - before.heading));
        assert.ok(turn < 3.1, `${person.id} snapped direction at ${elapsed}`);
        if (turn > 0.00001) close(moved, 0, 1e-8);
        if (person.speed > 0.001 && moved > 0.00001) {
          const movementHeading = Math.atan2(person.x - before.x, person.z - before.z) * 180 / Math.PI;
          close(wrapAngle(person.heading - movementHeading), 0, 1e-7);
        }
      }
      previous = people;
    }
    for (const { start, end } of visits(state)) {
      assert.equal(getPeople({ ...state, elapsed: start + 10 })[0].action, 'talking');
      close(getPeople({ ...state, elapsed: start + 10 })[0].actionTime, 1);
      const beforeLeave = getPeople({ ...state, elapsed: end })[0];
      const turning = getPeople({ ...state, elapsed: end + 0.45 })[0];
      close(turning.x, beforeLeave.x);
      close(turning.z, beforeLeave.z);
      close(turning.speed, 0);
      assert.ok(Math.abs(wrapAngle(turning.heading - beforeLeave.heading)) > 30);
      for (const [elapsed, phase, alert] of [[start, 'warning', false], [start + 6, 'approaching', false], [start + 7, 'approaching', true], [start + 9, 'watching', true], [end, 'leaving', true], [end + 1.5, 'leaving', false], [end + 5, 'away', false]]) {
        assert.equal(getBoss({ ...state, elapsed }).phase, phase);
        assert.equal(getPeople({ ...state, elapsed })[0].alert, alert);
      }
    }
    const jumps = [3.23, 29.18, 37.85, 48.92, 63.72, 84.41];
    for (const elapsed of jumps) {
      const direct = getPeople({ ...state, elapsed });
      for (const earlier of [elapsed / 3, elapsed / 2, elapsed - 0.02]) getPeople({ ...state, elapsed: earlier });
      assert.deepEqual(getPeople({ ...state, elapsed }), direct);
    }
  }
});

test('looking away stops reading rewards but does not hide the phone from the manager', () => {
  const state = act(createGame(), 'start');
  act(state, 'phoneToggle');
  advance(state, 1);
  const joy = state.joy;
  act(state, 'look', true);
  advance(state, 1);
  close(state.joy, joy);
  act(state, 'look', false);
  advance(state, 1);
  close(state.joy, joy + 1);
  const looking = Object.assign(structuredClone(state), { elapsed: 30 });
  const away = structuredClone(looking);
  act(away, 'look', true);
  advance(looking, 1);
  advance(away, 1);
  assert.equal(away.evidence, 'phone');
  close(away.suspicion, looking.suspicion);
  assert.equal(getBoss(away).canSee, true);
  assert.deepEqual(getPeople(away), getPeople(looking));
  act(away, 'pause');
  const frozen = structuredClone(away);
  act(away, 'look', false);
  advance(away, 20);
  assert.deepEqual(away, frozen);
});
