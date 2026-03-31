import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROUTER_PATH = path.join(ROOT_DIR, 'src', 'app', 'router', 'app-router.tsx');
const PAGE_IA_DIR = path.join(ROOT_DIR, 'docs', 'specs', 'page-ia');

const ROUTE_ENTRY_PATTERN = /<Route\s+path="([^"]+)"[\s\S]*?element=\{([\s\S]*?)\}\s*\/>/g;
const EXCLUDED_ROUTES = new Set(['/', '*']);
const DISALLOWED_SECOND_SEGMENTS = new Set([
  'api',
  'architecture',
  'features',
  'generated',
  'guidelines',
  'harness',
  'model',
  'pages',
  'scripts',
  'specs',
  'styles',
  'templates'
]);

async function listMarkdownFiles(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function toPosix(value) {
  return value.replaceAll(path.sep, '/');
}

async function main() {
  const routerSource = await fs.readFile(ROUTER_PATH, 'utf8');
  const canonicalRoutes = new Set();
  const redirectRoutes = new Set();

  for (const match of routerSource.matchAll(ROUTE_ENTRY_PATTERN)) {
    const routePath = match[1];
    const routeElement = match[2];

    if (EXCLUDED_ROUTES.has(routePath)) {
      continue;
    }

    if (routeElement.includes('<Navigate')) {
      redirectRoutes.add(routePath);
      continue;
    }

    canonicalRoutes.add(routePath);
  }

  const knownRoutePrefixes = [...new Set(
    [...canonicalRoutes, ...redirectRoutes]
      .map((routePath) => routePath.split('/').filter(Boolean)[0])
      .filter(Boolean)
  )];

  const routeLikePattern = new RegExp(
    `\\/(?:${knownRoutePrefixes.join('|')})(?:\\/(?:[a-z0-9-]+|:[A-Za-z][A-Za-z0-9]*))*`,
    'g'
  );

  const pageIaFiles = await listMarkdownFiles(PAGE_IA_DIR);
  const coverage = new Map();
  const staleDocRoutes = [];

  for (const filePath of pageIaFiles) {
    const content = await fs.readFile(filePath, 'utf8');
    const docRoutes = new Set(
      (content.match(routeLikePattern) ?? []).filter((routePath) => {
        const [, secondSegment = ''] = routePath.split('/').filter(Boolean);
        return !DISALLOWED_SECOND_SEGMENTS.has(secondSegment);
      })
    );

    for (const routePath of docRoutes) {
      if (canonicalRoutes.has(routePath)) {
        const owners = coverage.get(routePath) ?? [];
        owners.push(toPosix(path.relative(ROOT_DIR, filePath)));
        coverage.set(routePath, owners);
        continue;
      }

      if (!redirectRoutes.has(routePath)) {
        staleDocRoutes.push({
          filePath: toPosix(path.relative(ROOT_DIR, filePath)),
          routePath
        });
      }
    }
  }

  const missingCoverage = [...canonicalRoutes].filter((routePath) => !coverage.has(routePath));

  if (missingCoverage.length > 0 || staleDocRoutes.length > 0) {
    console.error('Route-doc coverage check failed.');

    if (missingCoverage.length > 0) {
      console.error('\nRoutes missing page IA coverage:');
      for (const routePath of missingCoverage) {
        console.error(`- ${routePath}`);
      }
    }

    if (staleDocRoutes.length > 0) {
      console.error('\nDocumented routes not present in app router:');
      for (const entry of staleDocRoutes) {
        console.error(`- ${entry.filePath}: ${entry.routePath}`);
      }
    }

    process.exit(1);
  }

  console.log(
    `Route-doc coverage check passed. ${canonicalRoutes.size} canonical routes are covered by ${pageIaFiles.length} page IA docs.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
