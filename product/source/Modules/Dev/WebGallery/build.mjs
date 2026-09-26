import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/gallery.js'], bundle: true, format: 'iife', target: 'es2022', outfile: 'dist/gallery.js' });
await copyFile('src/index.html', 'dist/index.html');
await writeFile('dist/gallery.css', (await readFile('../../../Shared/Web/UI/components.css', 'utf8')) + '\n' + await readFile('src/gallery.css', 'utf8'));
