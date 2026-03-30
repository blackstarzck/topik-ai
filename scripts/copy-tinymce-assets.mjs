import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const sourceDir = resolve(projectRoot, 'node_modules', 'tinymce');
const publicDir = resolve(projectRoot, 'public');
const targetDir = resolve(publicDir, 'tinymce');

if (!existsSync(sourceDir)) {
  throw new Error(`TinyMCE package not found: ${sourceDir}`);
}

mkdirSync(publicDir, { recursive: true });
rmSync(targetDir, { recursive: true, force: true });
cpSync(sourceDir, targetDir, { recursive: true });

console.log(`[tinymce] synced assets to ${targetDir}`);
