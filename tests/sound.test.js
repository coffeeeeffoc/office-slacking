import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createSound } from '../src/sound.js';

test('local office sounds follow actions, travelled steps and camera direction without replaying paused or reset state', async context => {
  const originalAudioContext = globalThis.AudioContext;
  const originalFetch = globalThis.fetch;
  const sources = [];
  const fetched = [];
  const decoded = [];
  const contexts = [];
  const parameter = () => ({
    value: 0,
    setValueAtTime(value) { this.value = value; },
    linearRampToValueAtTime(value) { this.value = value; },
    setTargetAtTime(value) { this.value = value; },
  });
  const node = () => ({
    connect(next) { this.next = next; return next; },
    disconnect() { this.disconnected = true; },
  });
  // Keep only the AudioContext scheduling semantics that matter here: sources
  // scheduled to end later remain live, and suspended context time does not move.
  globalThis.AudioContext = class {
    constructor() { this.state = 'suspended'; this.sampleRate = 44100; this.currentTime = 0; this.destination = node(); contexts.push(this); }
    createGain() { return { ...node(), gain: parameter() }; }
    createBiquadFilter() { return { ...node(), frequency: parameter() }; }
    createStereoPanner() { return { ...node(), pan: parameter() }; }
    createBuffer(channels, length, rate) { return { name: 'room-noise', duration: length / rate, getChannelData: () => new Float32Array(length) }; }
    createBufferSource() {
      const source = {
        ...node(), playbackRate: parameter(),
        start(time = 0, offset = 0) { this.started = true; this.startTime = time; this.offset = offset; },
        stop(time) { if (time === undefined) this.stopped = true; else this.endTime = time; },
      };
      sources.push(source);
      return source;
    }
    async decodeAudioData(bytes) { decoded.push(bytes.name); return { name: bytes.name, duration: 2 }; }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    tick(seconds) { if (this.state === 'running') this.currentTime += seconds; }
  };
  globalThis.fetch = async url => {
    assert.match(url, /^\.\/public\/assets\/audio\/[a-z]+-?\d?\.ogg$/);
    fetched.push(url);
    const data = readFileSync(new URL(`../${url}`, import.meta.url));
    assert(data.length > 100 && data.subarray(0, 4).toString() === 'OggS', `${url} must contain nonempty OGG audio`);
    const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    bytes.name = url.split('/').at(-1).replace('.ogg', '');
    return { ok: true, arrayBuffer: async () => bytes };
  };
  context.after(() => { globalThis.AudioContext = originalAudioContext; globalThis.fetch = originalFetch; });

  const audio = createSound();
  let elapsed = 0;
  const person = { id: 'lin', action: 'walking', actionTime: 0, moving: false, height: 1.72, travel: 0, sitWeight: 0, distance: 3, bearing: 90 };
  const frame = (changes = {}, yaw = 0, playing = true) => {
    Object.assign(person, changes);
    elapsed += .1;
    audio.update([person], elapsed, yaw, playing);
  };
  const played = name => sources.filter(source => source.started && source.buffer.name === name);
  const steps = () => played('step-1').length + played('step-2').length;
  const keys = () => played('key-1').length + played('key-2').length;
  const activeLoop = name => played(name).findLast(source => source.loop && !source.stopped);

  assert.equal(audio.enabled, false);
  audio.key(); audio.sip(); frame();
  assert.equal(contexts.length, 0, 'default silence does not create an audio context');
  assert.equal(fetched.length, 0);
  await audio.toggle();
  await new Promise(setImmediate);
  assert.equal(audio.enabled, true);
  assert.equal(contexts[0].state, 'running');
  const assets = readdirSync(new URL('../public/assets/audio/', import.meta.url)).filter(file => file.endsWith('.ogg')).sort();
  assert.deepEqual(fetched.map(url => url.split('/').at(-1)).sort(), assets, 'toggle loads every shipped local recording');
  assert.equal(decoded.length, assets.length);
  assert.equal(sources.length, 1, 'loading samples does not play them');

  frame({ moving: true, travel: .4 });
  assert.equal(steps(), 0);
  frame({ travel: .9 });
  assert.equal(steps(), 1, 'a footfall occurs after travelling a stride');
  frame({ travel: 1.1 });
  assert.equal(steps(), 1, 'repeated render frames do not repeat a footfall');
  frame({ moving: false, travel: 2.5 });
  frame({ moving: true });
  assert.equal(steps(), 1, 'a stationary actor produces no footsteps or catch-up burst');
  frame({ travel: 3.4 });
  assert.equal(steps(), 2);

  frame({ action: 'typing', moving: false, actionTime: 0, sitWeight: 1 });
  frame({ actionTime: .3 });
  assert.equal(keys(), 1);
  frame({ actionTime: .4 });
  assert.equal(keys(), 1);
  frame({ actionTime: .6 });
  assert.equal(keys(), 2);
  frame({ actionTime: 4.49 });
  assert.equal(keys(), 3, 'the actor can still type before the rest boundary');
  frame({ actionTime: 4.5 });
  frame({ actionTime: 4.6 });
  frame({ actionTime: 6.8 });
  assert.equal(keys(), 3, 'hands resting in the seven-second typing cycle are silent');
  frame({ actionTime: 7.1 });
  assert.equal(keys(), 4, 'typing resumes with the next visible typing cycle');
  frame({ actionTime: 7.4, sitWeight: .5 });
  assert.equal(keys(), 4, 'keys do not sound while the actor is leaving the seat');
  frame({ actionTime: 7.8, sitWeight: 1, props: { cup: 'putdown', cupProgress: .9 } });
  assert.equal(keys(), 4, 'hands putting a cup down cannot also type');

  frame({ action: 'printing', actionTime: .2 });
  assert.equal(activeLoop('printer'), undefined);
  frame({ actionTime: 1 });
  const printer = activeLoop('printer');
  assert(printer);
  frame({ action: 'filling', actionTime: .1 });
  assert(printer.stopped, 'leaving the printer stops its loop');
  assert.equal(activeLoop('water'), undefined);
  frame({ actionTime: .7 });
  const water = activeLoop('water');
  assert(water);
  frame({ action: 'drinking', actionTime: 1.5 });
  assert.equal(played('drink').length, 0, 'turning away from the dispenser happens before the sip');
  frame({ actionTime: 1.7 });
  assert.equal(played('drink').length, 1, 'the sip sounds when the cup reaches the mouth');
  frame({ action: 'talking', actionTime: 0 });
  const conversation = activeLoop('murmur');
  assert(water.stopped && conversation, 'conversation replaces filling rather than overlapping it');
  const panner = conversation.next.next.next.pan;
  assert.equal(panner.value, 1);
  frame({ actionTime: .2 }, 90);
  assert(Math.abs(panner.value) < 1e-9, 'looking toward the speaker centers their voice');
  frame({ actionTime: .4 }, 180);
  assert.equal(panner.value, -1);
  assert.equal(played('murmur').length, 1, 'turning the head pans the existing voice');
  frame({ action: 'waiting', actionTime: 0 });
  assert(conversation.stopped);

  frame({ action: 'printing', actionTime: 2 });
  const pausedPrinter = activeLoop('printer');
  const beforePause = sources.length;
  contexts[0].tick(.5);
  const clock = contexts[0].currentTime;
  audio.suspend();
  contexts[0].tick(60);
  frame({}, 0, false);
  assert.equal(contexts[0].currentTime, clock);
  assert.equal(sources.length, beforePause);
  assert(!pausedPrinter.stopped, 'pause freezes the current sound instead of restarting it');
  await audio.resume();
  frame();
  assert.equal(activeLoop('printer'), pausedPrinter);
  assert.equal(sources.length, beforePause);

  await audio.toggle();
  assert.equal(audio.enabled, false);
  assert(pausedPrinter.stopped && contexts[0].state === 'suspended');
  const beforeMute = sources.length;
  frame({ action: 'talking', actionTime: 8 });
  audio.key();
  assert.equal(sources.length, beforeMute);
  await audio.toggle();
  frame({ action: 'walking', moving: true, travel: 3.4, actionTime: 0 });
  assert.equal(sources.length, beforeMute, 'unmute does not replay an old printer or conversation');
  assert.equal(fetched.length, assets.length, 'unmute reuses decoded recordings');

  frame({ action: 'talking', moving: false });
  const oldConversation = activeLoop('murmur');
  audio.reset();
  assert(oldConversation.stopped);
  const beforeReset = sources.length;
  elapsed = 0;
  frame({ action: 'walking', actionTime: 0, moving: true, travel: 20 });
  assert.equal(sources.length, beforeReset, 'a fresh route establishes a baseline without replaying old footsteps');
  frame({ action: 'talking', moving: false });
  const beforeRewind = activeLoop('murmur');
  elapsed = -1;
  frame({ action: 'walking', moving: true, travel: 0 });
  assert(beforeRewind.stopped, 'rewinding game time also clears old sounds');
  await audio.toggle();
});
