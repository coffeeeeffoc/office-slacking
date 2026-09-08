import { mkdir, cp } from 'node:fs/promises';
import { dirname } from 'node:path';

const files = [
  ['build/three.module.min.js', 'three.module.min.js'],
  ['build/three.core.min.js', 'three.core.min.js'],
  ['examples/jsm/loaders/GLTFLoader.js', 'addons/loaders/GLTFLoader.js'],
  ['examples/jsm/utils/BufferGeometryUtils.js', 'addons/utils/BufferGeometryUtils.js'],
  ['examples/jsm/utils/SkeletonUtils.js', 'addons/utils/SkeletonUtils.js'],
  ['examples/jsm/renderers/CSS3DRenderer.js', 'addons/renderers/CSS3DRenderer.js'],
  ['LICENSE', 'LICENSE'],
];
for (const [source, target] of files) {
  const destination = `public/vendor/three/${target}`;
  await mkdir(dirname(destination), { recursive: true });
  await cp(`node_modules/three/${source}`, destination);
}
