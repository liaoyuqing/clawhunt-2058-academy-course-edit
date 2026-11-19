import fs from 'node:fs';
const p = 'docs/solution_text.txt';
let s = fs.readFileSync(p, 'utf8');
const subs = [
  ['可证伪断言（tests/outline.test.ts、tests/page-ac1-ac3.test.tsx，共 20 条）：', '可证伪断言（tests/outline.test.ts 10 条 + tests/page-ac1-ac3.test.tsx 中 AC1 的 4 条）：'],
  ['可证伪断言（tests/instructors.test.ts、tests/page-ac2-ac4.test.tsx，共 23 条）：', '可证伪断言（tests/instructors.test.ts 11 条 + tests/page-ac2-ac4.test.tsx 中 AC2 的 3 条）：'],
  ['可证伪断言（tests/dirty-and-validation.test.ts、tests/page-ac1-ac3.test.tsx，共 32 条）：', '可证伪断言（tests/dirty-and-validation.test.ts 22 条 + tests/page-ac1-ac3.test.tsx 中 AC3 的 6 条）：'],
  ['可证伪断言（tests/page-ac2-ac4.test.tsx，共 12 条，逐类控件数了 disabled 数量）：', '可证伪断言（tests/page-ac2-ac4.test.tsx 中 AC4 的 8 条，逐类控件数了 disabled 数量，另有 1 条草稿对照）：'],
];
for (const [a, b] of subs) { if (!s.includes(a)) throw new Error('not found: ' + a.slice(0, 30)); s = s.replace(a, b); }
fs.writeFileSync(p, s);
fs.writeFileSync('docs/precheck_payload.json', JSON.stringify({ solution_text: s }));
console.log('chars', s.length);
