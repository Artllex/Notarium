import { build } from 'esbuild';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
await mkdir('dist', { recursive: true });
const result = await build({ entryPoints: ['src/editor.js'], bundle: true, minify: true, format: 'iife', target: 'es2022', outfile: 'dist/editor.js', legalComments: 'eof', metafile: true });
await copyFile('src/index.html', 'dist/index.html');
await copyFile('src/editor.css', 'dist/editor.css');
await build({ entryPoints: ['node_modules/katex/dist/katex.min.css'], bundle: true, minify: true,
  outfile: 'dist/math.css', loader: { '.woff2': 'dataurl', '.woff': 'dataurl', '.ttf': 'dataurl' } });
const packages = new Set(Object.keys(result.metafile.inputs).flatMap(file => {
  const match = file.replaceAll('\\', '/').match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);
  return match ? [match[1]] : [];
}));
const notices = [];
for (const directory of [...packages].sort()) {
  const info = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  const licenses = (await readdir(directory)).filter(name => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name));
  if (!licenses.length) throw new Error(`Missing license notice: ${info.name}`);
  const texts = await Promise.all(licenses.map(name => readFile(path.join(directory, name), 'utf8')));
  notices.push(`${info.name} ${info.version}\n${texts.join('\n')}`);
}
await writeFile('dist/THIRD-PARTY-NOTICES.txt', notices.join('\n\n--------------------\n\n'));
