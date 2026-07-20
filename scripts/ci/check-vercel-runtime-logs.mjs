#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function value(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) throw new Error(`${flag} is required.`);
  return args[index + 1];
}

const args = process.argv.slice(2);
const input = resolve(value(args, '--input'));
const jsonOut = resolve(value(args, '--json-out'));
const lines = readFileSync(input, 'utf8').split(/\r?\n/).filter(Boolean);
let parsedCount = 0;
let invalidCount = 0;
let errorCount = 0;
let serverErrorCount = 0;

for (const line of lines) {
  try {
    const entry = JSON.parse(line);
    parsedCount += 1;
    const level = String(entry.level ?? '').toLowerCase();
    const statusCode = Number(entry.statusCode ?? entry.status ?? 0);
    if (level === 'error' || level === 'fatal') errorCount += 1;
    if (statusCode >= 500) serverErrorCount += 1;
  } catch {
    invalidCount += 1;
  }
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  parsedCount,
  invalidCount,
  errorCount,
  serverErrorCount,
  clean: invalidCount === 0 && errorCount === 0 && serverErrorCount === 0,
};
mkdirSync(dirname(jsonOut), { recursive: true });
writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(
  `Vercel runtime log summary: parsed=${parsedCount} errors=${errorCount} `
  + `serverErrors=${serverErrorCount} invalid=${invalidCount}`
);
if (!report.clean) process.exit(1);
