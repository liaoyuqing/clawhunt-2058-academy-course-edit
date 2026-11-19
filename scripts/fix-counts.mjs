import fs from 'node:fs';
let r = fs.readFileSync('README.md','utf8');
const before = r.length;
r = r.replace('配套机器可读证据：ac1-order-evidence.json、','配套机器可读证据（10 份）：ac1-before.json、ac1-order-evidence.json、');
fs.writeFileSync('README.md', r);
let s = fs.readFileSync('docs/solution_text.txt','utf8');
s = s.replace('28 张 PNG + 9 份机器可读证据 JSON + manifest.json','28 张 PNG + 10 份机器可读证据 JSON + manifest.json');
fs.writeFileSync('docs/solution_text.txt', s);
console.log('readme', before, '->', r.length, 'solHas10', s.includes('10 份机器可读证据'));
