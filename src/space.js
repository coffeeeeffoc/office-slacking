import { getBoss, visits } from './game.js';
import { camera, seats, stops } from './layout.js';

const radians = Math.PI / 180;
export const wrapAngle = (degrees) => ((degrees + 180) % 360 + 360) % 360 - 180;
export const verticalFov = (width, height) => height > width ? 76 : 64;

export function projectPoint(point, yawDegrees, pitchDegrees, width, height) {
  const yaw = yawDegrees * radians;
  const pitch = pitchDegrees * radians;
  const horizontal = point.x * Math.cos(yaw) - point.z * Math.sin(yaw);
  const forward = point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
  const vertical = (point.y - camera.y) * Math.cos(pitch) - forward * Math.sin(pitch);
  const depth = forward * Math.cos(pitch) + (point.y - camera.y) * Math.sin(pitch);
  const focalLength = height / (2 * Math.tan(verticalFov(width, height) * radians / 2));
  const scale = depth > 0.05 ? focalLength / depth : 0;
  const x = width / 2 + horizontal * scale;
  const y = height / 2 - vertical * scale;
  return {
    x, y, depth, scale,
    visible: depth > 0.05 && x >= 0 && x <= width && y >= 0 && y <= height,
    bearing: wrapAngle(Math.atan2(point.x, point.z) / radians),
    distance: Math.hypot(point.x, point.z),
  };
}

const bearing = (from, to) => wrapAngle(Math.atan2(to.x - from.x, to.z - from.z) / radians);

// A short authored route keeps turns stationary and feet moving along the same ground as furniture.
function motionTrack(point, heading) {
  const frames = [{ ...point, at: 0, heading, travel: 0 }];
  const last = () => frames.at(-1);
  return {
    frames,
    wait(at) { if (at > last().at) frames.push({ ...last(), at }); },
    turn(heading, duration) { frames.push({ ...last(), at: last().at + duration, heading }); },
    walk(point, duration) {
      const previous = last();
      frames.push({ ...point, at: previous.at + duration, heading: previous.heading,
        travel: previous.travel + Math.hypot(point.x - previous.x, point.z - previous.z) });
    },
  };
}

function sampleMotion(frames, elapsed) {
  const afterIndex = frames.findIndex((frame) => frame.at > elapsed);
  if (afterIndex < 1) {
    const still = frames[afterIndex < 0 ? frames.length - 1 : 0];
    return { x: still.x, y: 0, z: still.z, heading: wrapAngle(still.heading), travel: still.travel, speed: 0, moving: false };
  }
  const from = frames[afterIndex - 1];
  const to = frames[afterIndex];
  const duration = to.at - from.at;
  const time = elapsed - from.at;
  const fraction = time / duration;
  const distance = to.travel - from.travel;
  let progress = fraction;
  let speed = 0;
  if (distance > 0) {
    const ramp = Math.min(0.45, duration / 4);
    const pace = distance / (duration - ramp);
    const remaining = duration - time;
    if (time < ramp) {
      progress = pace * time * time / (2 * ramp * distance);
      speed = pace * time / ramp;
    } else if (remaining < ramp) {
      progress = 1 - pace * remaining * remaining / (2 * ramp * distance);
      speed = pace * remaining / ramp;
    } else {
      progress = pace * (time - ramp / 2) / distance;
      speed = pace;
    }
  }
  const turn = fraction * fraction * (3 - 2 * fraction);
  return {
    x: from.x + (to.x - from.x) * progress,
    y: 0,
    z: from.z + (to.z - from.z) * progress,
    heading: wrapAngle(from.heading + wrapAngle(to.heading - from.heading) * turn),
    travel: from.travel + distance * progress,
    speed,
    moving: speed > 0.001,
  };
}

function bossMotion(state) {
  const route = visits(state);
  const track = motionTrack(stops.bossFar[route[0].side], 180);
  for (let index = 0; index < route.length; index += 1) {
    const visit = route[index];
    const far = stops.bossFar[visit.side];
    const near = stops.bossNear[visit.side];
    track.wait(visit.start + 4);
    track.walk(near, 5);
    track.turn(bearing(near, camera), 0.65);
    track.wait(visit.end);
    track.turn(0, 0.9);
    track.walk(far, 4.1);
    const next = route[index + 1];
    if (next) {
      const nextFar = stops.bossFar[next.side];
      track.turn(bearing(far, nextFar), 0.7);
      track.walk(nextFar, Math.min(4.2, next.start - visit.end - 5 - 1.4));
      track.wait(next.start - 0.7);
      track.turn(180, 0.7);
    }
  }
  return sampleMotion(track.frames, state.elapsed);
}

function colleagueMotion(elapsed) {
  const track = motionTrack(stops.colleague, 0);
  track.wait(28.2); // Finish typing, then rise from the chair before moving.
  track.turn(90, 0.6);
  track.walk(stops.colleagueAisle, 0.9);
  track.turn(180, 0.7);
  track.walk(stops.printerCorner, 4.3);
  track.turn(-90, 0.6);
  track.walk(stops.printer, 2.6);
  track.turn(180, 0.6);
  track.wait(44.5);
  track.turn(90, 0.6);
  track.walk(stops.water, 2);
  track.turn(180, 0.6);
  track.wait(51.7);
  track.turn(90, 0.6); // Face into the room before raising the cup to drink.
  track.wait(55.7);
  track.turn(90, 0.6);
  track.walk(stops.printerCorner, 0.8);
  track.turn(0, 0.7);
  track.walk(stops.colleagueAisle, 4.3);
  track.turn(-90, 0.6);
  track.wait(66.7);
  track.walk(stops.colleague, 0.9);
  track.turn(0, 0.6);
  return sampleMotion(track.frames, elapsed);
}

// One purposeful errand combines printing and a drink; most of Lin's day remains work.
const routine = [
  [27, 'typing', '修改方案'],
  [28.2, 'standing-up', '收好文档，起身打印'],
  [38.5, 'walking', '去取打印稿'],
  [44.5, 'printing', '取稿、整理纸张'],
  [47.7, 'walking', '顺路接杯水'],
  [51.7, 'filling', '把杯子放到出水口'],
  [55.7, 'drinking', '喝两口水'],
  [62.7, 'walking', '拿着打印稿回工位'],
  [66.7, 'talking', '和小梅确认修改处'],
  [68.2, 'walking', '回到椅子前'],
  [69.4, 'sitting-down', '坐下来继续修改'],
  [Infinity, 'typing', '继续整理方案'],
];
const smooth = (value) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
function colleagueActivity(elapsed) {
  let started = 0;
  for (const [end, action, activity] of routine) {
    if (elapsed >= end) { started = end; continue; }
    const actionTime = Math.max(0, elapsed - started);
    const sitWeight = action === 'typing' ? 1 : action === 'standing-up' ? 1 - smooth(actionTime / 1.2) : action === 'sitting-down' ? smooth(actionTime / 1.2) : 0;
    const actionTarget = action === 'printing' ? { x: -5.7, y: 1.11, z: -2.22 }
      : ['filling', 'drinking'].includes(action) ? { x: -3.9, y: 0.94, z: -2.14 }
      : action === 'talking' ? { x: -5.1, y: 1.12, z: 2.11 } : undefined;
    return { action, activity, actionTime, actionTarget, sitWeight, seated: sitWeight === 1 };
  }
}

function colleagueProps(elapsed) {
  const cup = elapsed < 26 ? 'desk' : elapsed < 27 ? 'pickup' : elapsed < 69.4 ? 'held' : elapsed < 70.4 ? 'putdown' : 'desk';
  const paper = elapsed < 43 ? 'printer' : elapsed < 44 ? 'pickup' : elapsed < 69.4 ? 'held' : elapsed < 70.4 ? 'putdown' : 'desk';
  return {
    cup, cupProgress: cup === 'pickup' ? smooth((elapsed - 26.35) / 0.65) : cup === 'putdown' ? smooth(elapsed - 69.4) : cup === 'held' ? 1 : 0,
    paper, paperProgress: paper === 'pickup' ? smooth(elapsed - 43) : paper === 'putdown' ? smooth(elapsed - 69.4) : paper === 'held' ? 1 : 0,
  };
}

export function getPeople(state) {
  const boss = getBoss(state);
  const manager = bossMotion(state);
  const colleague = colleagueMotion(state.elapsed);
  const activeVisit = visits(state).find(visit => state.elapsed >= visit.start && state.elapsed < visit.end);
  const watchTime = boss.phase === 'watching' && activeVisit ? Math.max(0, state.elapsed - activeVisit.start - 9) : 0;
  return [
    {
      id: 'boss', name: '经理', role: '经理', ...manager, height: 1.76,
      activity: boss.phase === 'away' ? (manager.moving ? '去会议室' : '整理文件') : boss.label,
      alert: boss.canSee, action: boss.phase === 'watching' && watchTime < 3 ? 'talking' : manager.moving ? 'walking' : 'reading',
      props: { paper: 'held', paperProgress: 1 }, actionTime: watchTime, actionTarget: boss.phase === 'watching' ? camera : undefined, seated: false, sitWeight: 0,
    },
    {
      id: 'lin', name: '小林', role: '同事', ...colleague, height: 1.72,
      ...colleagueActivity(state.elapsed), props: colleagueProps(state.elapsed), seat: seats[0], alert: false,
    },
    ...seats.slice(1).map((seat, index) => {
      const talking = seat.id === 'mei' && state.elapsed >= 62.7 && state.elapsed < 66.7;
      const stretching = seat.id === 'zhou' && state.elapsed >= 12 && state.elapsed < 15;
      const looking = seat.id === 'yu' && state.elapsed >= 18 && state.elapsed < 22;
      return {
        id: seat.id, name: seat.name, role: '同事', x: seat.x, y: 0, z: seat.z + 0.24,
        height: 1.72, heading: seat.heading, speed: 0, travel: 0,
        moving: false, alert: false, seated: true, sitWeight: 1, seat,
        action: talking ? 'talking' : stretching ? 'stretching' : looking ? 'looking-window' : 'typing',
        activity: talking ? '回应小林的修改意见' : stretching ? '伸个懒腰，松松肩膀' : looking ? '抬头看一眼窗外' : ['核对文档', '回复工作消息', '整理报表', '修改汇报'][index % 4],
        actionTime: state.elapsed - (talking ? 62.7 : stretching ? 12 : looking ? 18 : -index * 2.3),
        actionTarget: talking ? { ...stops.colleagueAisle, y: 1.6 } : looking ? { x: -7, y: 1.4, z: seat.z } : seat.keyboard,
      };
    }),
  ].map((person) => ({
    ...person,
    distance: Math.hypot(person.x, person.z),
    bearing: wrapAngle(Math.atan2(person.x, person.z) / radians),
  }));
}
