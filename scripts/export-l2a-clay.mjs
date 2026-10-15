import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require(process.env.L2A_SHARP_MODULE ?? 'sharp');
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const generated = 'C:/Users/AdrienSauvageot/.codex/generated_images/01a121f4-d422-7500-acfb-6d5229d32d5b/';
const entries = [
  ['techno-night', 'exec-cedae106-f9dd-4ee5-9662-89d8514d632e.png'],
  ['uber-eats-order', 'exec-7cf92952-0b63-432b-8a87-3d8153681831.png'],
  ['fishing-day', 'exec-7991deed-f19a-4e2f-b9c6-d84c01bdb40e.png'],
  ['fontes-family-visit', 'exec-b4dec838-53db-448f-b087-734953123774.png'],
  ['clothing-shopping', 'exec-aca4705a-eb86-466a-b9ad-e8dfaca96db0.png'],
];
const directory = 'public/planned-visuals/composer/presets';
await mkdir(directory, { recursive: true });
const manifest = [];
for (const [key, source] of entries) {
  const original = await readFile(generated + source);
  const metadata = await sharp(original).metadata();
  if (metadata.width / metadata.height !== 2) throw Error('Original must be 2:1, no subject cropping or stretching');
  const file = `${directory}/${key}.webp`;
  await sharp(original).resize(1200, 600, { fit: 'inside' }).webp({ quality: 82 }).toFile(file);
  const bytes = await readFile(file);
  manifest.push({ presetKey: key, file, width: 1200, height: 600, quality: 82,
    bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    originalFile: source, originalSha256: createHash('sha256').update(original).digest('hex'),
    generator: 'built-in image_gen', generations: 1, prompt: `prompts/${key}.txt` });
}
await writeFile('docs/status/evidence/l2a-composer-presets/illustrations.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(manifest);
