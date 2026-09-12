import fs from 'node:fs';

const target = new URL('../server/cognitiveEngine/knowledgeCognitiveEngine.ts', import.meta.url);
const source = fs.readFileSync(target, 'utf8').toLowerCase();

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

const leaked = forbiddenCorpusLiterals.filter((literal) => source.includes(literal));

if (leaked.length > 0) {
  console.error('Benchmark/corpus-specific literals found in production cognitive engine:');
  for (const literal of leaked) console.error(`- ${literal}`);
  process.exit(1);
}

console.log('Benchmark leakage guard passed. Production cognitive engine is corpus-agnostic.');
