import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createDesk } from '../src/desk.js';
import { createGame, act, advance } from '../src/game.js';
import { furniture } from '../src/layout.js';

// CSS3D needs DOM ownership and styles, not a layout engine, for these world-space
// checks. Rendering and all camera/mesh transforms still use the actual Three code.
class ElementStub extends EventTarget {
  constructor(className = '', nodeType = 1) {
    super();
    this.nodeType = nodeType;
    this.childNodes = [];
    this.parentNode = null;
    this.style = this.makeStyle();
    this.attributes = new Map();
    this.hidden = false;
    this.inert = false;
    this.offsetHeight = 396;
    this.ownerDocument = { defaultView: { Element: ElementStub } };
    const classes = new Set(className.split(' ').filter(Boolean));
    this.classList = {
      add: name => classes.add(name),
      contains: name => classes.has(name),
      toggle: (name, present) => present ? classes.add(name) : classes.delete(name),
      toString: () => [...classes].join(' '),
    };
  }
  makeStyle() { return Object.create({ getPropertyValue(key) { return this[key] || ''; } }); }
  get children() { return this.childNodes.filter(child => child.nodeType === 1); }
  get nextSibling() { return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this) + 1] || null; }
  getAttribute(name) {
    if (name === 'style') return Object.entries(this.style).map(([key, value]) => `${key}:${value}`).join(';') || null;
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name, value) {
    if (name === 'style') {
      this.style = this.makeStyle();
      for (const declaration of value.split(';').filter(Boolean)) {
        const colon = declaration.indexOf(':');
        this.style[declaration.slice(0, colon)] = declaration.slice(colon + 1);
      }
    } else this.attributes.set(name, String(value));
  }
  removeAttribute(name) { if (name === 'style') this.style = this.makeStyle(); else this.attributes.delete(name); }
  append(...nodes) { for (const node of nodes) this.appendChild(node); }
  appendChild(node) { this.insertBefore(node, null); }
  insertBefore(node, sibling) {
    node.remove();
    const index = sibling === null ? this.childNodes.length : this.childNodes.indexOf(sibling);
    assert.notEqual(index, -1, 'reference sibling must belong to its parent');
    this.childNodes.splice(index, 0, node);
    node.parentNode = this;
  }
  remove() {
    if (this.parentNode) this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this), 1);
    this.parentNode = null;
  }
  replaceWith(node) { this.parentNode.insertBefore(node, this); this.remove(); }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.classList.contains(selector.slice(1))) return child;
      const match = child.querySelector(selector);
      if (match) return match;
    }
    return null;
  }
}

function fixture(context) {
  const originalDocument = globalThis.document;
  const originalElement = globalThis.Element;
  globalThis.document = { createElement: () => new ElementStub(), createComment: () => new ElementStub('', 8) };
  globalThis.Element = ElementStub;
  context.after(() => { globalThis.document = originalDocument; globalThis.Element = originalElement; });
  const root = new ElementStub('game');
  const sceneElement = new ElementStub('scene');
  const plane = new ElementStub('desk-plane');
  const nodes = ['desk-note', 'monitor', 'finance-message', 'coffee-hotspot', 'sip-feedback', 'phone-wrap', 'drawer-target'].map(name => new ElementStub(name));
  plane.append(...nodes);
  nodes[1].append(new ElementStub('display'));
  sceneElement.append(plane);
  root.append(sceneElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(64, 1440 / 900, .02, 80);
  camera.position.set(0, 1.2, 0);
  camera.lookAt(0, 1.0, -1.4);
  const game = createGame();
  act(game, 'start');
  return { root, scene, camera, game, plane, nodes };
}

test('phone touches the desk, reverses a pickup, follows the head in the hand and returns to the same spot', context => {
  const { root, scene, camera, game } = fixture(context);
  const desk = createDesk(root, scene, camera);
  context.after(() => desk.dispose());
  const phone = scene.getObjectByProperty('element', root.querySelector('.phone-wrap'));
  const monitor = scene.getObjectByProperty('element', root.querySelector('.monitor'));
  const draw = () => { desk.update(game, 1440, 900); desk.render(); };
  draw();
  assert.equal(phone.element.parentNode.parentNode.parentNode.style.overflow, 'clip', 'focusing a desk control must not create a scrolling viewport');
  const home = phone.position.clone();
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(phone.quaternion);
  assert(normal.y > .99, 'resting screen faces upward');
  assert(home.y > furniture.find(item => item.id === 'player-desk').height);
  assert(home.y - furniture.find(item => item.id === 'player-desk').height < .02, 'resting phone contacts the tabletop');
  act(game, 'phoneToggle');
  advance(game, .2);
  draw();
  assert(phone.position.y > home.y, 'pickup lifts the phone off the desk');
  const reversingAt = phone.position.clone();
  act(game, 'stow');
  draw();
  assert(phone.position.distanceTo(reversingAt) < 1e-9, 'changing direction does not teleport');
  advance(game, 1);
  draw();
  assert(phone.position.distanceTo(home) < 1e-9);
  act(game, 'phoneToggle');
  advance(game, 1);
  draw();
  // Compare the actual CSS3D output with the solid backplate's projected front
  // corners. Both renderers must project into the same viewport.
  const body = scene.getObjectByName('phone-body');
  const matrixFromCss = transform => new THREE.Matrix4().fromArray(transform.match(/matrix3d\(([^)]+)\)/)[1].split(',').map(Number));
  for (const [width, height, fov] of [[1440, 900, 64], [390, 667, 76]]) {
    camera.aspect = width / height;
    camera.fov = fov;
    camera.updateProjectionMatrix();
    desk.update(game, width, height);
    desk.render();
    const model = matrixFromCss(phone.element.style.transform);
    const view = matrixFromCss(phone.element.parentNode.style.transform);
    const focal = camera.projectionMatrix.elements[5] * height / 2;
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      const css = new THREE.Vector3(x * 76, y * 148, 0).applyMatrix4(model).applyMatrix4(view);
      const physical = body.localToWorld(new THREE.Vector3(x * .105 / 2, -y * .2045 / 2, .005)).project(camera);
      assert(Math.abs(width / 2 + focal * css.x / -css.z - (physical.x + 1) * width / 2) < .2);
      assert(Math.abs(height / 2 + focal * css.y / -css.z - (1 - physical.y) * height / 2) < .2, 'screen and physical body project to the same pixel bounds');
    }
  }
  camera.aspect = 1440 / 900;
  camera.fov = 64;
  camera.updateProjectionMatrix();
  draw();
  const heldLocal = phone.position.clone().applyMatrix4(camera.matrixWorldInverse);
  camera.lookAt(2, 1.2, 0);
  draw();
  assert(heldLocal.distanceTo(phone.position.clone().applyMatrix4(camera.matrixWorldInverse)) < 1e-9, 'held phone stays in the hand during a turn');
  assert(!monitor.visible && monitor.element.inert, 'computer behind the head cannot be seen or clicked');
  camera.position.set(0, 1.2, -2);
  camera.lookAt(0, 1.2, -1);
  draw();
  assert(!monitor.visible, 'screen is hidden when its solid back faces the camera');
  camera.position.set(0, 1.2, 0);
  camera.lookAt(0, 1.0, -1.4);
  act(game, 'stow');
  advance(game, 1);
  desk.update(game, 390, 667);
  desk.render();
  assert(phone.position.distanceTo(home) < 1e-9);
  assert(monitor.visible && phone.visible);
  assert(monitor.element.style.transform.includes('matrix3d'));
  camera.position.set(.25, .4, -.84);
  camera.lookAt(.25, 1, -.84);
  desk.update(game, 390, 667);
  desk.render();
  assert(!phone.visible && phone.element.inert, 'resting screen cannot show through its solid back');
});

test('dispose and rebuild restore original nodes, event handlers, notification placement and sibling order', context => {
  const { root, scene, camera, game, plane, nodes } = fixture(context);
  const monitorNode = nodes[1];
  monitorNode.style.color = 'red';
  const originalStyle = monitorNode.getAttribute('style');
  const phoneNode = nodes[5];
  let taps = 0;
  phoneNode.addEventListener('click', () => taps++);
  for (let retry = 0; retry < 2; retry++) {
    camera.lookAt(0, 1.0, -1.4);
    const desk = createDesk(root, scene, camera);
    desk.update(game, 1440, 900);
    desk.render();
    assert.equal(root.querySelector('.phone-wrap'), phoneNode);
    phoneNode.dispatchEvent(new Event('click'));
    assert.equal(taps, retry + 1, 'existing gameplay listener survives reparenting');
    assert.equal(nodes[2].parentNode, monitorNode.querySelector('.display'));
    assert.equal(plane.hidden, true);
    camera.lookAt(0, 1.2, 1);
    desk.update(game, 1440, 900);
    desk.render();
    assert.equal(monitorNode.style.display, 'none');
    desk.dispose();
    desk.dispose();
    assert.deepEqual(plane.childNodes, nodes, 'no lost node, moved sibling or leftover marker');
    assert.equal(root.querySelector('.monitor'), monitorNode);
    assert.equal(root.querySelector('.phone-wrap'), phoneNode);
    assert.equal(monitorNode.getAttribute('style'), originalStyle);
    assert.equal(monitorNode.classList.contains('desk-surface'), false);
    assert.equal(monitorNode.inert, false);
    assert.equal(plane.hidden, false);
    assert.equal(root.classList.contains('physical-desk'), false);
    assert.equal(scene.children.length, 0);
  }
});

test('cup has an open mouth above recessed water and stays still when the view turns', context => {
  const { root, scene, camera, game } = fixture(context);
  const desk = createDesk(root, scene, camera);
  context.after(() => desk.dispose());
  const draw = () => { desk.update(game, 1440, 900); desk.render(); };
  draw();
  const cup = scene.getObjectByName('water-cup');
  const shell = cup.getObjectByName('cup-shell');
  const drink = cup.getObjectByName('cup-water');
  const home = cup.position.clone();
  const ray = new THREE.Raycaster(home.clone().add(new THREE.Vector3(.015, .2, .009)), new THREE.Vector3(0, -1, 0));
  const hits = ray.intersectObject(cup, true);
  assert.equal(hits[0]?.object, drink, 'looking into the opening sees water, not a ceramic top cap');
  const bottom = hits.find(hit => hit.object === shell);
  assert(bottom && hits[0].point.y - bottom.point.y > .02, 'water and ceramic bottom occupy different depths');
  const rimHeight = new THREE.Box3().setFromObject(shell).max.y;
  assert(rimHeight - hits[0].point.y > .015, 'visible inner wall separates the water from the lip');
  ray.set(home.clone().add(new THREE.Vector3(0, .095, 0)), new THREE.Vector3(1, 0, 0));
  const innerWall = ray.intersectObject(shell)[0];
  assert(innerWall && innerWall.distance > .04 && innerWall.distance < .05, 'the cup has an inner wall visible from inside');

  const originalMatrices = cup.children.map(object => object.matrixWorld.clone());
  for (const [yaw, pitch] of [[.6, .1], [-1.8, -.4], [Math.PI, .3], [0, 0]]) {
    camera.lookAt(Math.sin(yaw), 1.2 + pitch, -Math.cos(yaw));
    draw();
    assert(cup.position.distanceTo(home) < 1e-9);
    cup.children.forEach((object, index) => assert.deepEqual(object.matrixWorld.elements, originalMatrices[index].elements, 'body, handle and water must not rotate with the camera'));
  }
  act(game, 'sip');
  advance(game, .8);
  draw();
  assert(cup.position.y > home.y && Math.abs(cup.rotation.z) > .1, 'a deliberate sip lifts and tilts the cup');
  assert.equal(root.querySelector('.coffee-hotspot').style.opacity, '0');
  advance(game, 1.3);
  draw();
  assert(cup.position.distanceTo(home) < 1e-9 && cup.rotation.z === 0, 'the cup returns to its contact point after drinking');
  assert.equal(root.querySelector('.coffee-hotspot').style.opacity, '1');
});
