import { mkdir, cp } from 'node:fs/promises';
import './vendor.mjs';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'dev-mode.js', 'src', 'public']) await cp(file, `dist/${file}`, { recursive: true });
console.log('Built static H5 game in dist/');
