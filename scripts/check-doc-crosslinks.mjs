import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');
const README_PATH = path.join(DOCS_DIR, 'README.md');
const AGENTS_PATH = path.join(ROOT_DIR, 'AGENTS.md');

const HISTORICAL_FILES = new Set([
  path.join(ROOT_DIR, 'docs', 'specs', 'admin-page-ia-change-log.md'),
  path.join(ROOT_DIR, 'logs', 'admin-doc-update-log.md')
]);

const DOC_REFERENCE_PATTERN = /`((?:docs|logs)\/[^`\r\n]+?\.md)`/g;

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

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function toPosix(value) {
  return value.replaceAll(path.sep, '/');
}

async function main() {
  const docsFiles = await listMarkdownFiles(DOCS_DIR);
  const readmeContent = await fs.readFile(README_PATH, 'utf8');
  const sourceFiles = [...docsFiles.filter((filePath) => !HISTORICAL_FILES.has(filePath)), AGENTS_PATH];

  const brokenReferences = [];

  for (const sourcePath of sourceFiles) {
    const content = await fs.readFile(sourcePath, 'utf8');

    for (const match of content.matchAll(DOC_REFERENCE_PATTERN)) {
      const relativeReference = match[1];
      if (relativeReference.includes('*')) {
        continue;
      }
      const absoluteReference = path.join(ROOT_DIR, relativeReference);

      if (!(await pathExists(absoluteReference))) {
        brokenReferences.push({
          sourcePath,
          relativeReference
        });
      }
    }
  }

  const missingReadmeEntries = docsFiles
    .filter((filePath) => filePath !== README_PATH)
    .filter((filePath) => !HISTORICAL_FILES.has(filePath))
    .filter((filePath) => {
      const relativePath = toPosix(path.relative(DOCS_DIR, filePath));
      const baseName = path.basename(filePath);
      return !readmeContent.includes(relativePath) && !readmeContent.includes(baseName);
    });

  if (brokenReferences.length > 0 || missingReadmeEntries.length > 0) {
    console.error('Doc crosslink check failed.');

    if (brokenReferences.length > 0) {
      console.error('\nBroken references:');
      for (const reference of brokenReferences) {
        console.error(`- ${toPosix(path.relative(ROOT_DIR, reference.sourcePath))} -> ${reference.relativeReference}`);
      }
    }

    if (missingReadmeEntries.length > 0) {
      console.error('\nREADME index missing entries:');
      for (const filePath of missingReadmeEntries) {
        console.error(`- docs/${toPosix(path.relative(DOCS_DIR, filePath))}`);
      }
    }

    process.exit(1);
  }

  console.log(
    `Doc crosslink check passed. ${docsFiles.length - 1} indexed markdown docs validated against README and in-repo references.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
