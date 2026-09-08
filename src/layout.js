// Metres; +z faces the desk, +x is right. Every actor's feet stay at y = 0.
export const room = { minX: -7, maxX: 7, minZ: -5, maxZ: 9, height: 3.2 };
export const camera = { x: 0, y: 1.2, z: 0 };
export const bodyRadius = 0.23;

// These footprints are shared by the room renderer and route collision checks.
export const furniture = [
  { id: 'player-desk', type: 'desk', x: 0, z: 1.25, width: 2.8, depth: 1.15, height: 0.74 },
  { id: 'middle-desk', type: 'desk', x: 0, z: 4.2, width: 2.8, depth: 2.2, height: 0.74 },
  { id: 'left-desk', type: 'desk', x: -4.6, z: 3.2, width: 2.2, depth: 1.2, height: 0.74 },
  { id: 'right-desk', type: 'desk', x: 4.6, z: 3.2, width: 2.2, depth: 1.2, height: 0.74 },
  { id: 'left-back-desk', type: 'desk', x: -4.6, z: 5.3, width: 2.2, depth: 1.2, height: 0.74 },
  { id: 'right-back-desk', type: 'desk', x: 4.6, z: 5.3, width: 2.2, depth: 1.2, height: 0.74 },
  { id: 'lin-chair', type: 'chair', x: -4.1, z: 2.11, width: 0.48, depth: 0.5, height: 0.83, seatHeight: 0.395 },
  { id: 'mei-chair', type: 'chair', x: -5.1, z: 2.11, width: 0.48, depth: 0.5, height: 0.83, seatHeight: 0.395 },
  { id: 'chen-chair', type: 'chair', x: 4.7, z: 2.11, width: 0.48, depth: 0.5, height: 0.83, seatHeight: 0.395 },
  { id: 'zhou-chair', type: 'chair', x: -4.5, z: 4.21, width: 0.48, depth: 0.5, height: 0.83, seatHeight: 0.395 },
  { id: 'yu-chair', type: 'chair', x: 4.7, z: 4.21, width: 0.48, depth: 0.5, height: 0.83, seatHeight: 0.395 },
  { id: 'xue-chair', type: 'chair', x: -0.67, z: 2.61, width: 0.48, depth: 0.5, height: 0.83, seatHeight: 0.395 },
  { id: 'an-chair', type: 'chair', x: 0.67, z: 2.61, width: 0.48, depth: 0.5, height: 0.83, seatHeight: 0.395 },
  { id: 'left-storage', type: 'cabinet', x: -5.5, z: 8.4, width: 2.1, depth: 0.7, height: 1.15 },
  { id: 'right-storage', type: 'cabinet', x: 5.5, z: 8.4, width: 2.1, depth: 0.7, height: 1.15 },
  { id: 'printer', type: 'printer', x: -5.7, z: -2.65, width: 1.25, depth: 0.8, height: 1.04 },
  { id: 'water-station', type: 'water', x: -3.9, z: -2.65, width: 0.8, depth: 0.8, height: 1.3 },
];

export const corridors = [
  { id: 'left-aisle', minX: -2.85, maxX: -1.55, minZ: 0.3, maxZ: 7.35 },
  { id: 'right-aisle', minX: 1.55, maxX: 2.85, minZ: 0.3, maxZ: 7.35 },
  { id: 'back-crossing', minX: -2.85, maxX: 2.85, minZ: 6.05, maxZ: 7.35 },
  { id: 'lin-seat-approach', minX: -4.38, maxX: -2.98, minZ: 2.10, maxZ: 2.60 },
  { id: 'printer-aisle', minX: -3.68, maxX: -2.92, minZ: -2.15, maxZ: 2.60 },
  { id: 'printer-approach', minX: -6.08, maxX: -2.92, minZ: -2.15, maxZ: -1.45 },
];

export const stops = {
  bossFar: { left: { x: -2.2, z: 6.7 }, right: { x: 2.2, z: 6.7 } },
  bossNear: { left: { x: -2.2, z: 0.8 }, right: { x: 2.2, z: 0.8 } },
  colleague: { x: -4.1, z: 2.35 },
  colleagueAisle: { x: -3.3, z: 2.35 },
  printerCorner: { x: -3.3, z: -1.8 },
  printer: { x: -5.7, z: -1.8 },
  water: { x: -3.9, z: -1.8 },
};

// x/z is the chair centre. Sitting's hips are 0.24 m behind the character root.
// Keyboards and seats are the same contract for the renderer and skeleton poses.
export const seats = [
  { id: 'lin', name: '小林', deskId: 'left-desk', chairId: 'lin-chair', x: -4.1, z: 2.11, height: 0.395, heading: 0, keyboard: { x: -4.1, y: 0.765, z: 2.72 } },
  { id: 'mei', name: '小梅', deskId: 'left-desk', chairId: 'mei-chair', x: -5.1, z: 2.11, height: 0.395, heading: 0, keyboard: { x: -5.1, y: 0.765, z: 2.72 } },
  { id: 'chen', name: '阿陈', deskId: 'right-desk', chairId: 'chen-chair', x: 4.7, z: 2.11, height: 0.395, heading: 0, keyboard: { x: 4.7, y: 0.765, z: 2.72 } },
  { id: 'zhou', name: '小周', deskId: 'left-back-desk', chairId: 'zhou-chair', x: -4.5, z: 4.21, height: 0.395, heading: 0, keyboard: { x: -4.5, y: 0.765, z: 4.82 } },
  { id: 'yu', name: '阿余', deskId: 'right-back-desk', chairId: 'yu-chair', x: 4.7, z: 4.21, height: 0.395, heading: 0, keyboard: { x: 4.7, y: 0.765, z: 4.82 } },
  { id: 'xue', name: '小薛', deskId: 'middle-desk', chairId: 'xue-chair', x: -0.67, z: 2.61, height: 0.395, heading: 0, keyboard: { x: -0.67, y: 0.765, z: 3.22 } },
  { id: 'an', name: '小安', deskId: 'middle-desk', chairId: 'an-chair', x: 0.67, z: 2.61, height: 0.395, heading: 0, keyboard: { x: 0.67, y: 0.765, z: 3.22 } },
];
