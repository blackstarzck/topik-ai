#!/usr/bin/env node
// Fails the release before any deploy when the built bundle does not carry the
// locked Supabase endpoint. Vercel stores VITE_SUPABASE_* as sensitive project
// variables, so `vercel pull` returns nothing for them and an unguarded build
// silently ships an app that can never reach the database.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const SUPABASE_HOST_PATTERN = /https:\/\/([a-z0-9]{20})\.supabase\.co/g;
const DEFAULT_BUNDLE_DIR = '.vercel/output/static/assets';

export function collectSupabaseRefs(contents) {
  const refs = new Set();
  for (const match of contents.matchAll(SUPABASE_HOST_PATTERN)) refs.add(match[1]);
  return refs;
}

function listBundleFiles(bundleDir) {
  let entries;
  try {
    entries = readdirSync(bundleDir, { withFileTypes: true });
  } catch {
    throw new Error(`Bundle directory is missing: ${bundleDir}`);
  }

  const files = [];
  for (const entry of entries) {
    const path = join(bundleDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listBundleFiles(path));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js') && statSync(path).size > 0) {
      files.push(path);
    }
  }
  return files;
}

export function evaluateBundleTarget({ expectedRef, files, readFile }) {
  if (!/^[a-z0-9]{20}$/.test(expectedRef ?? '')) {
    return { ok: false, reason: `invalid-expected-ref:${expectedRef ?? ''}`, foundRefs: [] };
  }
  if (files.length === 0) {
    return { ok: false, reason: 'no-bundle-files', foundRefs: [] };
  }

  const found = new Set();
  for (const file of files) {
    for (const ref of collectSupabaseRefs(readFile(file))) found.add(ref);
  }
  const foundRefs = [...found].sort();

  if (foundRefs.length === 0) {
    return { ok: false, reason: 'missing-supabase-endpoint', foundRefs };
  }
  const unexpected = foundRefs.filter((ref) => ref !== expectedRef);
  if (unexpected.length > 0) {
    return { ok: false, reason: `unexpected-supabase-ref:${unexpected.join(',')}`, foundRefs };
  }
  return { ok: true, reason: 'ok', foundRefs };
}

function getArgValue(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
  return value;
}

function main() {
  const args = process.argv.slice(2);
  const expectedRef = getArgValue(args, '--project-ref') ?? process.env.SUPABASE_PROJECT_REF;
  const bundleDir = getArgValue(args, '--bundle-dir') ?? DEFAULT_BUNDLE_DIR;
  const result = evaluateBundleTarget({
    expectedRef,
    files: listBundleFiles(bundleDir),
    readFile: (path) => readFileSync(path, 'utf8'),
  });

  if (!result.ok) {
    console.error(
      `[bundle-target] ${result.reason} (expected ${expectedRef}, found ${result.foundRefs.join(',') || 'none'})`
    );
    process.exit(1);
  }
  console.log(`[bundle-target] bundle targets the locked Supabase project ${expectedRef}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
