import * as THREE from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { furniture } from './layout.js';

// DOM screens and solid objects share the camera, metre scale, and desk surface.
// ponytail: CSS3D surfaces cannot be depth-tested against meshes; keep them on
// the exposed faces of desk objects, and hide their backs instead of duplicating UI.
export function createDesk(root, scene, camera) {
  const table = furniture.find(item => item.id === 'player-desk');
  const top = table.height;
  const renderer = new CSS3DRenderer();
  // Focusing a projected button can scroll an overflow:hidden element even
  // without scrollbars. Clip without a scroll container to keep DOM and meshes
  // in the same viewport when the phone or spreadsheet receives focus.
  renderer.domElement.style.overflow = 'clip';
  renderer.domElement.className = 'desk-renderer';
  root.querySelector('.scene').append(renderer.domElement);
  const hadPhysicalDesk = root.classList.contains('physical-desk');
  root.classList.add('physical-desk');
  const props = new THREE.Group();
  props.name = 'desk-objects';
  scene.add(props);
  const surfaces = [];
  const objects = [];
  const origins = [];
  const remember = element => {
    const marker = document.createComment('desk-origin');
    const origin = {
      element, marker, parent: element.parentNode, sibling: element.nextSibling,
      style: element.getAttribute('style'), draggable: element.getAttribute('draggable'),
      inert: element.inert, surface: element.classList.contains('desk-surface'),
    };
    origin.parent.insertBefore(marker, element);
    origins.push(origin);
  };
  const materials = [];
  const material = (color, roughness = .7) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness });
    materials.push(result);
    return result;
  };
  const dark = material('#303632', .55);
  const metal = material('#555d56', .4);
  const paper = material('#ded8b0');
  const wood = material('#b89972');
  const ceramic = material('#e5e0cf', .3);
  const water = material('#62564a', .22);
  const addMesh = (geometry, surface, position, parent = props) => {
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (size, position, surface, parent) => addMesh(new THREE.BoxGeometry(...size), surface, position, parent);
  const attach = (selector, pixelWidth, metreWidth, position, rotation = [0, 0, 0]) => {
    const element = root.querySelector(selector);
    remember(element);
    element.classList.add('desk-surface');
    element.style.width = `${pixelWidth}px`;
    const object = new CSS3DObject(element);
    object.position.set(...position);
    object.rotation.set(...rotation);
    object.scale.setScalar(metreWidth / pixelWidth);
    scene.add(object);
    surfaces.push(object);
    objects.push(object);
    return object;
  };

  // The front of the bezel is at -1.4m; its neck touches the solid base.
  const monitor = attach('.monitor', 680, 1.2, [0, top + .47, -1.4]);
  const monitorBack = box([1.21, .70, .045], [0, top + .47, -1.425], dark);
  box([.075, .35, .065], [0, top + .195, -1.45], metal);
  box([.36, .024, .25], [0, top + .012, -1.42], metal);
  // A keyboard and mouse leave an obvious shared contact plane beneath the screen.
  box([.44, .018, .14], [-.035, top + .009, -1.05], dark);
  for (let row = 0; row < 4; row++) {
    for (let key = 0; key < 12; key++) {
      box([.026, .005, .020], [-.212 + key * .033, top + .020, -1.10 + row * .028], metal);
    }
  }
  const mouse = addMesh(new THREE.SphereGeometry(.036, 16, 10), dark, [.30, top + .022, -1.09]);
  mouse.scale.set(.75, .60, 1.15);

  const note = attach('.desk-note', 200, .265, [-.72, top + .002, -1.20], [-Math.PI / 2, 0, -.1]);
  const noteBacking = box([.27, .002, .34], [-.72, top + .001, -1.20], paper);
  noteBacking.rotation.y = -.1;

  // The message is a desktop notification inside the real display.
  const message = root.querySelector('.finance-message');
  remember(message);
  root.querySelector('.display').append(message);

  const phone = attach('.phone-wrap', 152, .105, [.25, top + .012, -.84], [-Math.PI / 2, 0, -.13]);
  const phoneHome = phone.position.clone();
  const phoneRestRotation = phone.quaternion.clone();
  const phoneBody = box([.105, .2045, .010], [0, 0, 0], dark);
  phoneBody.name = 'phone-body';
  const phoneFrontOffset = new THREE.Vector3(0, 0, -.005);
  const heldRotation = new THREE.Quaternion();
  const heldPosition = new THREE.Vector3();
  const cameraRotation = new THREE.Quaternion();
  const cameraPosition = new THREE.Vector3();
  const scratch = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const cameraLocal = new THREE.Vector3();

  const cupHome = new THREE.Vector3(-.31, top, -.91);
  const cup = new THREE.Group();
  cup.name = 'water-cup';
  cup.position.copy(cupHome);
  props.add(cup);
  // A closed cylinder puts a ceramic cap on the drink and causes coplanar
  // depth flicker. This section joins the outer wall, rounded lip, inner wall
  // and thick bottom; the opening remains empty above the recessed water.
  const cupProfile = [
    [0, 0], [.044, 0], [.048, .004], [.0515, .102], [.051, .105],
    [.0495, .1065], [.0475, .105], [.0465, .102], [.0425, .012], [0, .012],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));
  addMesh(new THREE.LatheGeometry(cupProfile, 32), ceramic, [0, 0, 0], cup).name = 'cup-shell';
  const drink = addMesh(new THREE.CircleGeometry(.0457, 32), water, [0, .082, 0], cup);
  drink.name = 'cup-water';
  drink.rotation.x = -Math.PI / 2;
  addMesh(new THREE.TorusGeometry(.028, .006, 8, 20), ceramic, [-.054, .061, 0], cup);
  const coffee = attach('.coffee-hotspot', 110, .16, [-.31, top + .115, -.91]);

  const drawer = attach('.drawer-target', 230, .43, [.68, top - .09, -.674]);
  box([.48, .15, .22], [.68, top - .083, -.79], wood);
  box([.13, .012, .020], [.68, top - .09, -.66], metal);

  // The former viewport-sized plane must never remain as an invisible hit shield.
  const oldPlane = root.querySelector('.desk-plane');
  const planeWasHidden = oldPlane?.hidden;
  const sipFeedback = oldPlane?.querySelector('.sip-feedback');
  if (sipFeedback) {
    remember(sipFeedback);
    root.querySelector('.scene').append(sipFeedback);
  }
  if (oldPlane) oldPlane.hidden = true;

  const editable = target => target instanceof Element && target.closest('input,textarea,[contenteditable]:not([contenteditable="false"])');
  const preventSelection = event => { if (!editable(event.target)) event.preventDefault(); };
  const preventImageDrag = event => { if (!editable(event.target)) event.preventDefault(); };
  root.addEventListener('selectstart', preventSelection);
  root.addEventListener('dragstart', preventImageDrag);

  let previousWidth = 0;
  let previousHeight = 0;
  let disposed = false;
  return {
    update(game, width, height) {
      if (width !== previousWidth || height !== previousHeight) {
        renderer.setSize(width, height);
        const screenWidth = width < 700 ? 520 : 680;
        monitor.element.style.width = `${screenWidth}px`;
        monitor.scale.setScalar(1.2 / screenWidth);
        previousWidth = width;
        previousHeight = height;
      }
      camera.updateMatrixWorld();
      camera.getWorldQuaternion(cameraRotation);
      camera.getWorldPosition(cameraPosition);
      const progress = THREE.MathUtils.clamp(game.phoneProgress, 0, 1);
      const eased = progress * progress * (3 - 2 * progress);
      const dragX = parseFloat(phone.element.style.getPropertyValue('--drag-x')) || 0;
      const dragY = parseFloat(phone.element.style.getPropertyValue('--drag-y')) || 0;
      const heldDepth = width < 700 ? .40 : .43;
      const pixelMetres = 2 * heldDepth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / height;
      heldPosition.set((width < 700 ? .070 : .17) + dragX * pixelMetres, -.115 - dragY * pixelMetres, -heldDepth);
      heldPosition.applyQuaternion(cameraRotation).add(cameraPosition);
      phone.position.lerpVectors(phoneHome, heldPosition, eased);
      // An arc lifts the phone clear of the tabletop before it tilts into the hand.
      phone.position.y += Math.sin(progress * Math.PI) * .09;
      heldRotation.setFromEuler(new THREE.Euler(-.10, -.05, -.045));
      heldRotation.premultiply(cameraRotation);
      phone.quaternion.slerpQuaternions(phoneRestRotation, heldRotation, eased);
      phoneBody.position.copy(phoneFrontOffset).applyQuaternion(phone.quaternion).add(phone.position);
      phoneBody.quaternion.copy(phone.quaternion);

      const sip = game.cupProgress || 0;
      scratch.set(-.11, -.19, -.31).applyQuaternion(cameraRotation).add(cameraPosition);
      cup.position.lerpVectors(cupHome, scratch, sip);
      cup.rotation.z = -.28 * sip;
      coffee.position.copy(cup.position).add(scratch.set(0, .12, 0));
      coffee.quaternion.copy(cameraRotation);
      coffee.element.style.opacity = sip > .05 ? '0' : '1';

      // CSS3D has no automatic clipping behind the camera. Never leave unseen
      // objects clickable or let a screen show through its own solid back.
      for (const surface of surfaces) {
        surface.updateMatrixWorld();
        const towardCamera = scratch.copy(cameraPosition).sub(surface.position);
        normal.set(0, 0, 1).applyQuaternion(surface.quaternion);
        cameraLocal.copy(surface.position).applyMatrix4(camera.matrixWorldInverse);
        surface.visible = cameraLocal.z < -.035 && normal.dot(towardCamera) > 0;
        surface.element.inert = !surface.visible || game.phase !== 'playing';
      }
      // Keep the physical bezel exactly matched if text metrics change after font load.
      const screenHeight = monitor.element.offsetHeight * monitor.scale.y;
      if (screenHeight > 0) {
        monitorBack.scale.y = screenHeight / .70;
        monitorBack.position.y = top + .12 + screenHeight / 2;
        monitor.position.y = monitorBack.position.y;
      }
      note.element.style.pointerEvents = 'none';
      drawer.element.style.pointerEvents = game.phase === 'playing' ? 'auto' : 'none';
    },
    render() { renderer.render(scene, camera); },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeEventListener('selectstart', preventSelection);
      root.removeEventListener('dragstart', preventImageDrag);
      for (const object of objects) scene.remove(object);
      props.traverse(object => object.geometry?.dispose());
      for (const surface of materials) surface.dispose();
      scene.remove(props);
      renderer.domElement.remove();
      // Removing a CSS3DObject detaches its element. Restore the same nodes so
      // context recovery keeps input values, event listeners and DOM order.
      for (const origin of origins) {
        const { element, marker, parent, sibling } = origin;
        if (marker.parentNode) marker.replaceWith(element);
        else parent.insertBefore(element, sibling?.parentNode === parent ? sibling : null);
        for (const attribute of ['style', 'draggable']) {
          if (origin[attribute] === null) element.removeAttribute(attribute);
          else element.setAttribute(attribute, origin[attribute]);
        }
        element.inert = origin.inert;
        element.classList.toggle('desk-surface', origin.surface);
      }
      if (oldPlane) oldPlane.hidden = planeWasHidden;
      root.classList.toggle('physical-desk', hadPhysicalDesk);
    },
  };
}
