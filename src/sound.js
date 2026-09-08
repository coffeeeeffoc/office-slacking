const samplesToLoad = ['key-1', 'key-2', 'step-1', 'step-2', 'drink', 'cloth', 'chair', 'water', 'printer', 'murmur'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createSound() {
  let context, master, noise;
  let enabled = false;
  let lastElapsed = -1;
  const samples = new Map();
  const voices = new Set();
  const actors = new Map();
  const loops = new Map();

  function stop(voice) {
    voice.source.stop();
    voice.source.disconnect(); voice.filter.disconnect(); voice.gain.disconnect(); voice.panner.disconnect();
    voices.delete(voice);
  }
  function reset() {
    for (const voice of voices) stop(voice);
    actors.clear(); loops.clear(); lastElapsed = -1;
  }
  function play(name, volume, pan = 0, { duration, rate = 1, frequency = 2400, loop = false, actorId, offset = 0 } = {}) {
    if (!enabled || context?.state !== 'running') return;
    const buffer = samples.get(name) || noise;
    const source = context.createBufferSource(); source.buffer = buffer; source.loop = loop;
    source.playbackRate.value = rate;
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = frequency;
    const gain = context.createGain();
    const panner = context.createStereoPanner(); panner.pan.value = clamp(pan, -1, 1);
    const now = context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + .012);
    source.connect(filter).connect(gain).connect(panner).connect(master);
    const voice = { source, filter, gain, panner, volume, actorId };
    voices.add(voice);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); panner.disconnect(); voices.delete(voice); };
    const length = duration ?? (samples.has(name) ? buffer.duration / rate : .18);
    source.start(now, offset % buffer.duration);
    if (!loop) {
      gain.gain.setValueAtTime(volume, now + Math.max(.015, length - .05));
      gain.gain.linearRampToValueAtTime(0, now + length);
      source.stop(now + length);
    }
    return voice;
  }
  async function resume() {
    if (enabled && context) await context.resume().catch(() => {});
  }
  function spatial(person, yaw) {
    const distance = person.distance;
    return {
      pan: Math.sin((person.bearing - yaw) * Math.PI / 180),
      level: 1 / (1 + distance * distance * .09),
      frequency: clamp(6500 / (1 + distance * .22), 900, 6500),
    };
  }
  return {
    get enabled() { return enabled; },
    async toggle() {
      try {
        if (!context) {
          context = new AudioContext(); master = context.createGain(); master.gain.value = .42; master.connect(context.destination);
          noise = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
          const data = noise.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
          const room = context.createBufferSource(); room.buffer = noise; room.loop = true;
          const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 160;
          const gain = context.createGain(); gain.gain.value = .07;
          room.connect(filter).connect(gain).connect(master); room.start();
          // Local recordings load independently; a missing file falls back to quiet filtered room noise.
          void Promise.allSettled(samplesToLoad.map(async name => {
            const response = await fetch(`./public/assets/audio/${name}.ogg`);
            if (!response.ok) throw new Error(`Audio ${name}: ${response.status}`);
            samples.set(name, await context.decodeAudioData(await response.arrayBuffer()));
          }));
        }
        enabled = !enabled;
        if (enabled) await resume(); else { reset(); await context.suspend(); }
      } catch { enabled = false; reset(); context?.suspend().catch(() => {}); }
    },
    resume,
    suspend() { if (context?.state === 'running') context.suspend().catch(() => {}); },
    reset,
    update(people, elapsed, yaw, playing) {
      if (elapsed < lastElapsed) reset();
      lastElapsed = elapsed;
      if (!playing) return;
      for (const person of people) {
        const { pan, level, frequency } = spatial(person, yaw);
        const previous = actors.get(person.id);
        const action = person.action;
        const time = person.actionTime || 0;
        const step = Math.floor(person.travel / (person.height * .98 / 2));
        const key = Math.floor(time * 4);
        const changed = !previous || previous.action !== action;
        const options = { actorId: person.id, frequency };
        if (previous && person.moving && step !== previous.step) {
          play(`step-${step % 2 + 1}`, .95 * level, pan, options);
        }
        const handling = ['pickup', 'putdown'].includes(person.props?.cup);
        if (action === 'typing' && !handling && time % 7 < 4.5 && person.sitWeight > .95 && previous && key !== previous.key) {
          play(`key-${key % 2 + 1}`, .2 * level * (key % 3 === 0 ? .7 : 1), pan, { ...options, rate: .96 + (key % 4) * .025 });
        }
        if (changed && previous && ['standing-up', 'sitting-down'].includes(action)) {
          play('chair', .42 * level, pan, { ...options, duration: 1.15 });
          play('cloth', .15 * level, pan, { ...options, duration: .65 });
        }
        if (changed && previous && action === 'stretching') play('cloth', .16 * level, pan, { ...options, duration: .6 });
        if (previous && person.props?.cup === 'putdown' && person.props.cupProgress >= .85 && previous.cupProgress < .85) {
          play('impact', .14 * level, pan, { ...options, duration: .12, frequency: 400 });
        }
        if (action === 'drinking' && time >= 1.6 && (changed || previous.time < 1.6)) play('drink', .6 * level, pan, options);
        const loopName = action === 'printing' && time > .8 && time < 4.5 ? 'printer'
          : action === 'filling' && time > .6 ? 'water'
          : action === 'talking' ? 'murmur' : null;
        const signature = loopName && `${loopName}:${samples.has(loopName)}`;
        let current = loops.get(person.id);
        if (current && current.signature !== signature) { stop(current.voice); loops.delete(person.id); current = null; }
        if (loopName && !current) {
          const volume = loopName === 'murmur' ? .24 : loopName === 'water' ? .7 : .5;
          const voice = play(loopName, volume * level, pan, { ...options, loop: true, offset: time, frequency: loopName === 'murmur' ? 520 : frequency });
          if (voice) { current = { signature, voice, volume, loopName }; loops.set(person.id, current); }
        }
        if (current) {
          const envelope = current.loopName === 'murmur' ? .55 + .45 * Math.pow(Math.sin(time * 2.2), 2) : 1;
          current.voice.gain.gain.setTargetAtTime(current.volume * level * envelope, context.currentTime, .07);
        }
        for (const voice of voices) {
          if (voice.actorId === person.id) voice.panner.pan.setTargetAtTime(pan, context.currentTime, .06);
        }
        actors.set(person.id, { action, time, step, key, cupProgress: person.props?.cupProgress || 0 });
      }
    },
    click: () => play('key-1', .22),
    key: () => play(Math.random() > .5 ? 'key-1' : 'key-2', .24),
    paper: () => play('cloth', .12, .35, { duration: .45, frequency: 1600 }),
    place: () => play('impact', .17, .3, { duration: .11, frequency: 400 }),
    cloth: () => play('cloth', .18, .4, { duration: .65 }),
    sip: () => play('drink', .45, -.25),
    exhale: () => play('breath', .055, 0, { duration: .65, frequency: 500 }),
  };
}
