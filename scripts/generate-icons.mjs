#!/usr/bin/env node
// Generates every PWA icon from the single source public/icon.svg:
//   npm run icons
// - icon-192.png / icon-512.png  purpose "any" (rounded corners, transparent outside)
// - maskable-512.png             purpose "maskable": full-bleed background, logo scaled into
//                                the 80 % safe zone so any launcher mask shape crops cleanly
// - apple-touch-icon.png (180)   iOS ignores transparency, so it uses the full-bleed variant
// - favicon.svg                  a copy of the source
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'public', 'icon.svg');
const outDir = join(root, 'public', 'icons');
const BACKGROUND = '#5359d1'; // --wb-accent (light), also the manifest theme_color
const SAFE_ZONE = 0.6; // logo occupies 60 % — inside the 80 % maskable safe circle

const svg = await readFile(source);
await mkdir(outDir, { recursive: true });

const render = (size) => sharp(svg, { density: 384 }).resize(size, size).png();

async function fullBleed(size, file) {
  const logo = await render(Math.round(size * SAFE_ZONE)).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(join(outDir, file));
}

await render(192).toFile(join(outDir, 'icon-192.png'));
await render(512).toFile(join(outDir, 'icon-512.png'));
await fullBleed(512, 'maskable-512.png');
await fullBleed(180, 'apple-touch-icon.png');
await copyFile(source, join(root, 'public', 'favicon.svg'));

console.log('Icons written to public/icons/ and public/favicon.svg');
