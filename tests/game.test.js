import test from 'node:test';
import assert from 'node:assert/strict';
import { act, advance, createGame, getBoss, TOTAL } from '../src/game.js';

function playing(seed = 1) {
  return act(createGame(seed), 'start');
}

test('a short glance is recoverable, and the route gives time to put the phone down', () => {
  const state = playing();
  advance(state, 21);
  assert.equal(getBoss(state).phase, 'warning');
  assert.equal(getBoss(state).canSee, false);
  act(state, 'phoneToggle');
  advance(state, 7.2);
  assert.equal(state.phase, 'playing');
  assert.ok(state.suspicion > 0 && state.suspicion < 5);
  act(state, 'stow');
  advance(state, 0.75);
  assert.equal(state.phone, 'down');
  assert.ok(state.suspicion < 15);
});

test('the phone and the computer retain separate visible evidence', () => {
  const state = playing();
  act(state, 'phoneToggle');
  advance(state, 1);
  act(state, 'switchApp', 'break');
  act(state, 'switchApp', 'work');
  assert.equal(state.phone, 'up');
  advance(state, 28);
  assert.equal(state.evidence, 'phone');
  act(state, 'switchApp', 'break');
  act(state, 'stow');
  advance(state, 0.75);
  assert.equal(state.app, 'break');
  assert.equal(state.phone, 'down');
  advance(state, 0.1);
  assert.equal(state.evidence, 'screen');
});

test('reversing a movement preserves position and a quick stow leaves audible evidence', () => {
  const state = playing();
  act(state, 'phoneToggle');
  advance(state, 0.325);
  assert.ok(Math.abs(state.phoneProgress - 0.5) < 1e-8);
  act(state, 'stow');
  assert.ok(Math.abs(state.phoneProgress - 0.5) < 1e-8);
  advance(state, 0.15);
  act(state, 'phoneToggle');
  assert.ok(Math.abs(state.phoneProgress - 0.3) < 1e-8);
  advance(state, 0.455);
  assert.equal(state.phone, 'up');
  act(state, 'quickStow');
  advance(state, 0.35);
  assert.equal(state.phone, 'down');
  assert.ok(Math.abs(state.noiseUntil - state.elapsed - 2) < 1e-8);
});

test('only the focused entertainment gives time, and coffee is safe and capped', () => {
  const state = playing();
  act(state, 'phoneToggle');
  advance(state, 0.65);
  act(state, 'switchApp', 'break');
  advance(state, 5);
  assert.ok(Math.abs(state.joy - 5) < 1e-8);
  act(state, 'switchApp', 'work');
  advance(state, 2);
  assert.ok(Math.abs(state.joy - 5) < 1e-8);
  act(state, 'stow');
  advance(state, 22.35);
  for (let count = 0; count < 3; count += 1) {
    act(state, 'sip');
    advance(state, 2);
  }
  assert.equal(state.suspicion, 0);
  assert.ok(Math.abs(state.drinkJoy - 4) < 1e-8);
});

test('pause freezes actions, movement, timers and suspicion; bad time steps are ignored', () => {
  const state = playing();
  act(state, 'phoneToggle');
  advance(state, 0.3);
  act(state, 'pause');
  const frozen = structuredClone(state);
  advance(state, 100);
  act(state, 'stow');
  assert.deepEqual(state, frozen);
  act(state, 'resume');
  const resumed = structuredClone(state);
  for (const dt of [NaN, Infinity, -2, 0]) advance(state, dt);
  assert.deepEqual(state, resumed);
  advance(state, 0.35);
  assert.equal(state.phone, 'up');
});

function safeRun(seed, fps) {
  const state = playing(seed);
  act(state, 'verify', TOTAL);
  const events = [
    [1, 'phoneToggle'],
    [18, 'stow'],
    [42, 'switchApp', 'break'],
    [51, 'switchApp', 'work'],
    [65, 'reply', TOTAL],
  ];
  for (const [time, action, value] of [...events, [90]]) {
    while (state.elapsed < time - 1e-8 && state.phase === 'playing') advance(state, Math.min(1 / fps, time - state.elapsed));
    if (action) act(state, action, value);
  }
  return state;
}

test('both visible routes have a winning strategy; 30 and 60 fps produce equivalent outcomes', () => {
  for (const seed of [1, 2]) {
    const slow = safeRun(seed, 30);
    const fast = safeRun(seed, 60);
    assert.equal(slow.phase, 'won');
    assert.equal(slow.work, 1);
    assert.equal(slow.questionAnswered, true);
    assert.ok(slow.joy >= 20);
    for (const key of ['elapsed', 'joy', 'suspicion', 'phoneProgress']) assert.ok(Math.abs(slow[key] - fast[key]) < 1e-7, key);
    assert.equal(fast.phase, slow.phase);
  }
});

test('leaving visible evidence eventually loses with a concrete cause', () => {
  const state = playing();
  act(state, 'verify', TOTAL);
  act(state, 'phoneToggle');
  advance(state, 45);
  assert.equal(state.phase, 'lost');
  assert.equal(state.suspicion, 100);
  assert.match(state.endedReason, /手机/);
  assert.ok(state.elapsed > 28 && state.elapsed < 38);
});

test('a simultaneous unanswered question cannot undo being caught', () => {
  const state = Object.assign(playing(), { elapsed: 71, phone: 'up', phoneProgress: 1, suspicion: 88 });
  advance(state, 1);
  assert.equal(state.phase, 'lost');
  assert.equal(state.suspicion, 100);
  assert.match(state.endedReason, /手机/);
});

test('wrong replies are recoverable and a clarification extends the same question once', () => {
  const state = playing();
  advance(state, 63);
  assert.equal(getBoss(state).question, true);
  act(state, 'reply', 120000);
  assert.equal(state.phase, 'playing');
  assert.equal(state.suspicion, 16);
  advance(state, 1);
  act(state, 'reply', 'ask');
  assert.equal(state.questionExtended, true);
  advance(state, 9);
  assert.equal(getBoss(state).question, true);
  act(state, 'reply', 'ask');
  act(state, 'reply', TOTAL);
  assert.equal(state.questionAnswered, true);
  advance(state, 3);
  assert.equal(getBoss(state).phase, 'leaving');
});

test('success requires the real work, sufficient rest and both forms of cleanup', () => {
  const cases = [
    { work: 0, joy: 22, phone: 'down', app: 'work', reason: /总额/ },
    { work: 1, joy: 4, phone: 'down', app: 'work', reason: /二十秒/ },
    { work: 1, joy: 22, phone: 'up', app: 'work', reason: /手机/ },
    { work: 1, joy: 22, phone: 'down', app: 'break', reason: /休闲页面/ },
  ];
  for (const example of cases) {
    const state = Object.assign(playing(), example, { elapsed: 89.9 });
    advance(state, 0.1);
    assert.equal(state.phase, 'lost');
    assert.match(state.endedReason, example.reason);
  }
});
