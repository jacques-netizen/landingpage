// Fails when an em dash (U+2014) appears in tracked source, content or docs.
// Section 3, rule 8: no em dashes anywhere.
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const EM = String.fromCharCode(0x2014);
const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter(f => f && /\.(tsx?|mjs|js|json|md|css|html|txt|vtt|sh|ya?ml)$/.test(f) && !f.endsWith('package-lock.json')
    // Written and rewritten by `next dev` itself, not authored here.
    && f !== 'AGENTS.md');
const hits = [];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (line.includes(EM)) hits.push(`${f}:${i + 1}`);
  });
}
if (hits.length) {
  console.error('Em dashes found:\n' + hits.join('\n'));
  process.exit(1);
}
console.log(`No em dashes in ${files.length} files.`);
