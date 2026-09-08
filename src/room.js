import * as THREE from 'three';
import { furniture, seats, room, camera as eye } from './layout.js';
import { verticalFov } from './space.js';
import { createPeople } from './people.js';
import { createDesk } from './desk.js';

// Logical +z points into the office; Three's forward direction is -z.
export async function createRoom(canvas, root) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d9ddcf');
  const camera = new THREE.PerspectiveCamera(64, 1, .06, 60);
  camera.position.set(eye.x, eye.y, -eye.z);
  const textures = [];

  function surface(kind) {
    const paper = document.createElement('canvas');
    paper.width = paper.height = 256;
    const ctx = paper.getContext('2d');
    ctx.fillStyle = kind === 'wood' ? '#b49a73' : '#898877';
    ctx.fillRect(0, 0, 256, 256);
    let seed = 1347;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < (kind === 'wood' ? 650 : 18000); i++) {
      ctx.fillStyle = random() > .5 ? '#ffffff0b' : '#242a2210';
      const x = random() * 256, y = random() * 256;
      ctx.fillRect(x, y, kind === 'wood' ? 12 + random() * 100 : 1, kind === 'wood' ? .5 : 1);
    }
    const texture = new THREE.CanvasTexture(paper);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(kind === 'wood' ? 1.4 : 7, kind === 'wood' ? 1.4 : 7);
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    textures.push(texture);
    return texture;
  }
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, ...extra });
  const oak = material('#e2ceaa', { map: surface('wood') });
  const carpet = material('#d9d4bc', { map: surface('carpet') });
  const wall = material('#ddd8c8');
  const trim = material('#676c60', { roughness: .55, metalness: .15 });
  const white = material('#eeece2');
  const dark = material('#303830');
  const fabric = material('#657357');
  const paper = material('#f2f0df');
  const glass = material('#bfd0c9', { transparent: true, opacity: .22, roughness: .12, metalness: .3, depthWrite: false });
  const geometries = new Map();
  function box(x, y, z, w, h, d, mat = wall, cast = true) {
    const key = `${w},${h},${d}`;
    if (!geometries.has(key)) geometries.set(key, new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geometries.get(key), mat);
    mesh.position.set(x, y, -z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  function cylinder(x, y, z, top, bottom, height, mat, segments = 12) {
    const geometry = new THREE.CylinderGeometry(top, bottom, height, segments);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, -z);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  function sign(text, x, y, z, w = 1.7, h = .4, facing = 0) {
    const board = document.createElement('canvas');
    board.width = 512; board.height = 128;
    const ctx = board.getContext('2d');
    ctx.fillStyle = '#435440'; ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#e9e5ce'; ctx.font = '30px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 64);
    const texture = new THREE.CanvasTexture(board); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture }));
    panel.position.set(x, y, -z); panel.rotation.y = facing; scene.add(panel);
  }

  box(0, -.05, 2, 14, .1, 14, carpet, false);
  box(0, room.height, 2, 14, .14, 14, white, false);
  box(0, 1.6, room.maxZ, 14, 3.2, .14, wall);
  box(0, 1.6, room.minZ, 14, 3.2, .14, wall);
  box(room.minX, 1.6, 2, .14, 3.2, 14, wall);
  box(room.maxX, 1.6, 2, .14, 3.2, 14, wall);
  for (const x of [-6.88, 6.88]) box(x, .055, 2, .055, .11, 14, trim);
  for (const z of [-4.88, 8.88]) box(0, .055, z, 14, .11, .055, trim);

  scene.add(new THREE.HemisphereLight('#e6f0eb', '#a38d6d', 1.7));
  const sunlight = new THREE.DirectionalLight('#fff0ce', 3.1);
  sunlight.position.set(-6, 8, 1);
  sunlight.target.position.set(0, 0, -3);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: .5, far: 28 });
  sunlight.shadow.normalBias = .015;
  sunlight.shadow.bias = -.00015;
  scene.add(sunlight, sunlight.target);

  // Windows and blinds have actual depth; the floor no longer curves around the viewer.
  const sky = material('#b9d2d4', { emissive: '#bfdad6', emissiveIntensity: .45 });
  for (const z of [-2.6, .4, 3.4, 6.4]) {
    box(-6.88, 1.87, z, .055, 1.83, 2.64, sky, false);
    for (const edge of [-1.36, 1.36]) box(-6.76, 1.87, z + edge, .1, 1.97, .06, trim);
    box(-6.73, .91, z, .4, .08, 2.82, oak);
    for (let y = 2.42; y < 2.77; y += .075) box(-6.71, y, z, .15, .021, 2.64, white);
    box(-6.77, 1.85, z, .12, 1.84, .045, trim);
  }
  for (const z of [-2, 2, 6]) {
    box(0, 3.02, z, 12.9, .13, .13, trim);
    for (const x of [-3.5, 3.5]) {
      box(x, 2.96, z, 1.5, .045, .3, trim);
      box(x, 2.935, z, 1.43, .012, .26, material('#ffffed', { emissive: '#fff4d4', emissiveIntensity: 1.3 }), false);
    }
  }

  let waterStream, printerPage;
  for (const item of furniture) {
    const { x, z, width: w, depth: d, height: h } = item;
    if (item.type === 'desk') {
      box(x, h - .035, z, w, .07, d, oak);
      for (const dx of [-w / 2 + .1, w / 2 - .1]) {
        for (const dz of [-d / 2 + .09, d / 2 - .09]) box(x + dx, (h - .07) / 2, z + dz, .055, h - .07, .055, trim);
      }
      box(x, h - .14, z + d / 2 - .12, w - .2, .06, .04, trim);
      if (item.id === 'player-desk') continue;
      box(x, 1.035, z + .18, w - .08, .59, .075, fabric);
      for (const seat of seats.filter(seat => seat.deskId === item.id)) {
        const { x: mx, z: kz } = seat.keyboard;
        box(mx, h + .025, kz + .21, .36, .045, .22, dark);
        box(mx, .91, kz + .29, .055, .3, .045, trim);
        box(mx, 1.13, kz + .25, .61, .39, .055, dark);
        box(mx, 1.13, kz + .218, .565, .34, .006, material('#7b9187', { emissive: '#526357', emissiveIntensity: .28 }), false);
        box(mx, seat.keyboard.y - .0125, kz, .4, .025, .14, dark);
        for (let row = 0; row < 3; row++) box(mx - .075, 1.2 - row * .055, kz + .213, .3 + row * .05, .012, .002, paper, false);
      }
      for (let i = 0; i < 3; i++) box(x - w / 2 + .18 + i * .1, h + .145, z - .08, .08, .29, .22, i % 2 ? fabric : white);
      box(x + w / 2 - .3, h + .022, z - .08, .32, .025, .23, paper);
    } else if (item.type === 'chair') {
      const top = item.seatHeight;
      cylinder(x, (top - .11) / 2, z, .035, .035, top - .11, trim);
      box(x, top - .055, z, w, .11, d, fabric);
      box(x, top + .235, z - .22, w, .38, .075, fabric);
      for (const dx of [-.26, .26]) {
        box(x + dx, top + .035, z, .035, .23, .04, trim);
        box(x + dx, top + .155, z, .055, .045, .32, dark);
      }
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        const base = box(x + Math.sin(a) * .13, .085, z + Math.cos(a) * .13, .04, .035, .3, trim);
        base.rotation.y = -a;
        cylinder(x + Math.sin(a) * .27, .055, z + Math.cos(a) * .27, .045, .045, .035, dark, 8);
      }
    } else if (item.type === 'water') {
      box(x, .405, z, w, .81, d, white);
      box(x, 1.055, z - .30, w, .49, .2, white);
      for (const dx of [-w / 2 + .035, w / 2 - .035]) box(x + dx, 1.055, z + .1, .07, .49, .6, white);
      box(x, 1.25, z + .1, w, .1, .6, white);
      box(x, .83, z + .18, .57, .04, .51, dark);
      box(x, 1.16, z + .34, .4, .09, .16, dark);
      cylinder(x, 1.115, z + .51, .014, .014, .09, trim);
      for (const [dx, color] of [[-.12, '#956453'], [.12, '#567b87']]) box(x + dx, 1.21, z + .43, .07, .04, .04, material(color));
      cylinder(x, 1.4, z, .2, .09, .22, material('#99bbc2', { transparent: true, opacity: .76, roughness: .25 }));
      cylinder(x, 1.66, z, .2, .2, .34, material('#99bbc2', { transparent: true, opacity: .76, roughness: .25 }));
      waterStream = cylinder(x, 1.005, z + .51, .004, .006, .13, material('#badce0', { transparent: true, opacity: .72, roughness: .1 }), 8);
      waterStream.visible = false;
      sign('饮水  /  WATER', x, 1.98, z - .2, .85, .2, Math.PI);
    } else {
      const front = z < 0 ? 1 : -1;
      box(x, h / 2, z, w, h, d, item.type === 'printer' ? white : oak);
      for (const dx of [-w / 4, w / 4]) {
        box(x + dx, h * .47, z + front * (d / 2 + .014), w / 2 - .025, h - .12, .025, white);
        box(x + dx + w / 6, h * .63, z + front * (d / 2 + .037), .025, .14, .035, trim);
      }
      if (item.type === 'printer') {
        box(x, h + .045, z, w + .025, .09, d + .035, dark);
        box(x + .15, h + .1, z + .08, .76, .045, .44, white);
        box(x, .75, z + front * (d / 2 + .025), .78, .11, .035, dark);
        box(x + .34, h + .095, z + front * .3, .23, .04, .12, material('#6e9b9b', { emissive: '#467876', emissiveIntensity: .2 }));
        printerPage = box(x, h + .095, z + .42, .21, .003, .28, paper, false);
        printerPage.visible = false;
      }
    }
  }

  // Right-hand meeting room entrance, beyond the right walking aisle.
  for (const z of [-2.2, -.25, 1.7, 3.65, 5.6]) {
    box(6.67, 1.5, z, .055, 2.75, .065, trim);
    if (z !== -.25) box(6.7, 1.5, z + .94, .015, 2.64, 1.8, glass, false);
  }
  box(6.65, 2.88, 2.6, .075, .07, 9.7, trim);
  sign('MEETING  /  会议室', 6.58, 2.5, -.7, 1.45, .3, -Math.PI / 2);
  // A door and wall signs give the back of the room a stable orientation.
  box(.2, 1.13, -4.88, 1.4, 2.25, .05, oak);
  box(.72, 1.05, -4.81, .04, .16, .06, trim);
  sign('出口  /  EXIT', .2, 2.6, -4.8, 1.1, .25, Math.PI);
  sign('FRIDAY  /  把今天做好', 0, 2.35, 8.89, 2.8, .52);
  sign('PRINT  /  文印', -5.7, 1.75, -3.2, 1.15, .28, Math.PI);

  const leaf = material('#536d41');
  const pot = material('#b5ad96');
  for (const [x, z] of [[-6.3, -4], [6, 7.8], [-6.3, 7.6], [2.1, -4.25]]) {
    cylinder(x, .19, z, .22, .16, .38, pot);
    cylinder(x, .72, z, .022, .03, 1, trim, 6);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const foliage = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), leaf);
      foliage.scale.set(.15, .07, .37);
      foliage.position.set(x + Math.sin(a) * .18, .55 + i * .075, -z + Math.cos(a) * .18);
      foliage.rotation.set(.15, a, .2);
      foliage.castShadow = true; scene.add(foliage);
    }
  }
  let people, desk;
  function dispose() {
    desk?.dispose(); people?.dispose();
    const disposed = new Set();
    scene.traverse(object => {
      for (const resource of [object.geometry, ...[object.material].flat()].filter(Boolean)) {
        if (!disposed.has(resource)) { resource.dispose(); disposed.add(resource); }
      }
    });
    textures.forEach(texture => texture.dispose()); renderer.dispose();
  }
  try {
    people = await createPeople(scene);
    desk = createDesk(root, scene, camera);
  } catch (error) {
    dispose();
    throw error;
  }
  let lastWidth, lastHeight;
  return {
    render(yaw, pitch, width, height, state, occupants) {
      if (lastWidth !== width || lastHeight !== height) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.fov = verticalFov(width, height);
        camera.updateProjectionMatrix();
        lastWidth = width; lastHeight = height;
      }
      const angle = yaw * Math.PI / 180, tilt = pitch * Math.PI / 180;
      camera.lookAt(eye.x + Math.sin(angle) * Math.cos(tilt), eye.y + Math.sin(tilt), -eye.z - Math.cos(angle) * Math.cos(tilt));
      camera.updateMatrixWorld();
      people.update(occupants, state.elapsed);
      const lin = occupants.find(person => person.id === 'lin');
      waterStream.visible = lin?.action === 'filling' && lin.actionTime > .6;
      printerPage.visible = lin?.action === 'printing' && lin.actionTime > 1 && lin.actionTime < 4.5;
      if (printerPage.visible) printerPage.position.z = 2.42 - Math.min(1, (lin.actionTime - 1) / 3.5) * .27;
      desk.update(state, width, height);
      renderer.render(scene, camera);
      desk.render();
    },
    dispose,
  };
}
