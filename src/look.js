import { getPeople, projectPoint, wrapAngle } from './space.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const restPitch = -9;

// The room, people and physical desktop all share one camera and ground plane.

export function createLook(root, getGame) {
  const canvas = root.querySelector('.room-canvas');
  const controls = root.querySelector('.look-controls');
  const heading = root.querySelector('#look-heading');
  const directionInput = root.querySelector('#look-direction');
  const actors = [...root.querySelectorAll('[data-person]')];
  const trackers = [...root.querySelectorAll('[data-track]')];
  const keys = new Set();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let yaw = 0;
  let targetYaw = 0;
  let pitch = restPitch;
  let targetPitch = restPitch;
  let drag;
  let width = 1;
  let height = 1;
  let room;
  let people = [];

  let ready = false;
  let loading = false;

  async function loadRoom() {
    if (loading) return;
    loading = true;
    ready = false;
    const start = root.querySelector('#start');
    const retry = root.querySelector('#retry-room');
    start.disabled = true;
    retry.disabled = true;
    try {
      room?.dispose();
      room = null;
      const { createRoom } = await import('./room.js');
      room = await createRoom(canvas, root);
      ready = true;
      start.disabled = false;
      root.classList.add('room-ready');
      root.querySelector('#room-error').hidden = true;
      root.dispatchEvent(new Event('office-room-ready'));
    } catch (error) {
      console.error('Office scene could not load:', error);
      root.querySelector('#room-error').hidden = false;
      root.dispatchEvent(new Event('office-room-error'));
    } finally {
      loading = false;
      retry.disabled = false;
    }
  }
  loadRoom();
  root.querySelector('#retry-room').addEventListener('click', loadRoom);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault(); ready = false;
    root.querySelector('#room-error').hidden = false;
    root.dispatchEvent(new Event('office-room-error'));
  });
  canvas.addEventListener('webglcontextrestored', loadRoom);
  const resize = new ResizeObserver(() => {
    width = Math.max(1, root.clientWidth); height = Math.max(1, root.clientHeight);
  });
  resize.observe(root);
  function stop() {
    keys.clear();
    const current = drag;
    drag = null;
    if (current && root.hasPointerCapture(current.id)) root.releasePointerCapture(current.id);
    targetYaw = yaw; targetPitch = pitch;
    root.classList.remove('looking-drag');
  }
  function aim(degrees, up = restPitch) { targetYaw = wrapAngle(degrees); targetPitch = clamp(up, -25, 18); }
  const interactive = 'button,input,a,select,textarea,dialog,.phone,.monitor,[role="button"]';
  root.addEventListener('pointerdown', (event) => {
    if (!ready || getGame().phase !== 'playing' || event.button > 0 || !event.target.closest('.scene') || event.target.closest(interactive)) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: targetYaw, pitch: targetPitch };
    root.setPointerCapture(event.pointerId);
    root.classList.add('looking-drag');
    event.preventDefault();
  });
  root.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const sensitivity = 105 / Math.min(width, 850);
    aim(drag.yaw - (event.clientX - drag.x) * sensitivity, drag.pitch + (event.clientY - drag.y) * sensitivity * .55);
  });
  root.addEventListener('pointerup', (event) => {
    if (drag?.id !== event.pointerId) return;
    const current = drag; drag = null;
    if (root.hasPointerCapture(current.id)) root.releasePointerCapture(current.id);
    root.classList.remove('looking-drag');
  });
  root.addEventListener('pointercancel', stop);
  root.addEventListener('lostpointercapture', () => { drag = null; root.classList.remove('looking-drag'); });
  const directionKeys = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD'];
  document.addEventListener('keydown', (event) => {
    if (getGame().phase !== 'playing' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.target.closest('input,textarea,select,dialog')) return;
    if (directionKeys.includes(event.code)) { event.preventDefault(); keys.add(event.code); }
    if (event.code === 'Home') { event.preventDefault(); aim(0); }
  });
  document.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  root.querySelectorAll('[data-look]').forEach(button => button.addEventListener('click', () => {
    if (getGame().phase === 'playing') aim(Number(button.dataset.look));
  }));
  root.querySelector('#look-around').addEventListener('click', () => {
    if (getGame().phase === 'playing') aim(Math.abs(yaw) < 15 ? -65 : 0);
  });
  directionInput.addEventListener('input', () => { if (getGame().phase === 'playing') aim(Number(directionInput.value)); });
  trackers.forEach(button => button.addEventListener('click', () => {
    const person = getPeople(getGame()).find(person => person.id === button.dataset.track);
    if (getGame().phase === 'playing' && person) aim(person.bearing);
  }));

  return {
    get ready() { return ready; },
    get yaw() { return yaw; },
    get lookingAway() { return Math.abs(yaw) > 18 || Math.abs(pitch - restPitch) > 15; },
    center() { aim(0); },
    reset() { stop(); yaw = 0; pitch = restPitch; aim(0); },
    stop,
    update(dt) {
      const state = getGame();
      if (state.phase === 'playing') {
        const horizontal = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
        const vertical = Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'));
        aim(targetYaw + horizontal * 82 * dt, targetPitch + vertical * 40 * dt);
        const smoothing = reduced.matches ? 1 : 1 - Math.exp(-Math.min(dt, .1) * 15);
        yaw = wrapAngle(yaw + wrapAngle(targetYaw - yaw) * smoothing);
        pitch += (targetPitch - pitch) * smoothing;
        if (Math.abs(wrapAngle(targetYaw - yaw)) < .03) yaw = targetYaw;
      }

      const away = this.lookingAway;
      root.classList.toggle('looking-away', away);
      root.dataset.yaw = yaw.toFixed(1);
      controls.inert = state.phase !== 'playing' || !ready;
      root.querySelector('#look-around').disabled = !ready;
      directionInput.value = String(Math.round(yaw));
      const quadrant = Math.round((yaw + 360) / 90) % 4;
      heading.textContent = ['面向工位','右侧 · 会议室','身后 · 办公区','左侧 · 同事工位'][quadrant];
      directionInput.setAttribute('aria-valuetext', `${heading.textContent}，${Math.round(Math.abs(yaw))} 度`);
      root.querySelector('#look-around').setAttribute('aria-label', away ? '回到工位' : '转头环顾');
      root.querySelector('#look-held-phone').hidden = !away || state.phone === 'down';
      people = getPeople(state);
      if (ready) room.render(yaw, pitch, width, height, state, state.phase === 'ready' ? [] : people);
      for (const person of people) {
        const actor = actors.find(node => node.dataset.person === person.id);
        if (!actor) continue;

        const top = projectPoint({ ...person, y: person.height - .31 * (person.sitWeight || 0) }, yaw, pitch, width, height);
        const middle = projectPoint({ ...person, y: person.height / 2 }, yaw, pitch, width, height);
        const visible = middle.depth > .2 && middle.x > -width * .3 && middle.x < width * 1.3;
        actor.hidden = !ready || !visible || state.phase === 'ready';
        if (visible) {
          actor.style.left = `${middle.x}px`; actor.style.top = `${top.y}px`;
          actor.style.zIndex = String(Math.round(100 / person.distance));
          const label = actor.querySelector('.person-label');
          label.hidden = top.y < root.querySelector('.topbar').offsetHeight + 68 || (top.y - 58 < controls.offsetTop + controls.offsetHeight && top.y > controls.offsetTop && Math.abs(middle.x - width / 2) < controls.offsetWidth / 2 + 70);
          label.innerHTML = `${person.name} <b>${person.distance.toFixed(1)}<small> m</small></b><span>${person.activity}</span>`;
          actor.dataset.alert = String(person.alert);
        }
        const tracker = trackers.find(node => node.dataset.track === person.id);
        const relative = wrapAngle(person.bearing - yaw);
        tracker.querySelector('.person-bearing').style.transform = `rotate(${relative}deg)`;
        tracker.querySelector('.person-distance').textContent = `${person.distance.toFixed(1)} m`;
        tracker.setAttribute('aria-label', `看向${person.name}，距离 ${person.distance.toFixed(1)} 米`);
        tracker.dataset.alert = String(person.alert);
        tracker.title = `${person.activity} · 点击看向${person.name}`;
      }
    },
    get people() { return people; },
  };
}
