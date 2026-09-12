import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const productionTargets = [
  path.join(root, 'server', 'cognitiveEngine'),
  path.join(root, 'server', 'ragPipeline.ts'),
  path.join(root, 'server', 'ragQueryResolver.ts'),
];

const forbiddenCorpusLiterals = [
  'aurora robotics',
  'ar-10',
  'ar-20',
  'ar-40',
  'apex-9000',
  'singapore central logistics hub',
  'singapore north fulfillment depot',
  'kuala lumpur distribution hub',
  'bangkok regional logistics center',
];

function collectFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];

  const files = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const fullPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'benchmarks') continue;
      files.push(...collectFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

const findings = [];
for (const target of productionTargets) {
  for (const file of collectFiles(target)) {
    const source = fs.readFileSync(file, 'utf8').toLowerCase();
    for (const literal of forbiddenCorpusLiterals) {
      if (source.includes(literal)) {
        findings.push({ file: path.relative(root, file), literal });
      }
    }
  }
}

if (findings.length > 0) {
  console.error('Benchmark/corpus-specific literals found in the production cognitive path:');
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.literal}`);
  }
  console.error('Move corpus fixtures into benchmark-only files instead of production retrieval/reasoning modules.');
  process.exit(1);
}

console.log(`Benchmark leakage guard passed across ${productionTargets.length} production targets.`);
