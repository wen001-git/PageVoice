// scripts/build-mini-ecdict.mjs —— 从 ECDICT CSV 裁剪到 top N 词
// 用法：node scripts/build-mini-ecdict.mjs [count] [input.csv] [output.json]

import { readFileSync, writeFileSync } from 'fs';

const COUNT = parseInt(process.argv[2] || '20000', 10);
const INPUT = process.argv[3] || '/tmp/ecdict.csv';
const OUTPUT = process.argv[4] || 'data/ecdict-mini.json';

console.log('Reading ' + INPUT + '...');
const lines = readFileSync(INPUT, 'utf8').split('\n');

// 简单 CSV 解析（处理引号）
function parseLine(line) {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const next = line[i + 1];
    if (c === '"' && line[i - 1] !== '\\') {
      inQuote = !inQuote;
    } else if (c === ',' && !inQuote) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

const headerRaw = lines[0].replace(/\r$/, '');
const header = parseLine(headerRaw);
const idxWord = header.indexOf('word');
const idxPhonetic = header.indexOf('phonetic');
const idxDef = header.indexOf('definition');
const idxTrans = header.indexOf('translation');
const idxBNC = header.indexOf('bnc');
const idxFRQ = header.indexOf('frq');
const idxCollins = header.indexOf('collins');

if (idxWord < 0 || idxFRQ < 0 || idxBNC < 0) {
  console.error('Column parse failed. header =', header);
  process.exit(1);
}

const entries = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].replace(/\r$/, '').trim();
  if (!line) continue;
  const cols = parseLine(line);
  const word = cols[idxWord];
  if (!word || !/^[a-zA-Z][a-zA-Z'\-]*$/.test(word)) continue;
  const collins = parseInt(cols[idxCollins] || '0', 10) || 0;
  const bnc = parseInt(cols[idxBNC] || '0', 10) || 0;
  const frq = parseInt(cols[idxFRQ] || '0', 10) || 0;
  if (collins === 0 && bnc === 0 && frq === 0) continue;
  if (word.length > 20) continue;
  entries.push({
    w: word,
    p: cols[idxPhonetic] || '',
    d: cols[idxDef] || '',
    t: cols[idxTrans] || '',
    collins,
    bnc,
    frq,
  });
}

console.log('Valid entries: ' + entries.length);

// 排序：collins desc → bnc asc → frq asc
entries.sort((a, b) => {
  if (a.collins !== b.collins) return b.collins - a.collins;
  const aBnc = a.bnc > 0 ? a.bnc : 999999;
  const bBnc = b.bnc > 0 ? b.bnc : 999999;
  if (aBnc !== bBnc) return aBnc - bBnc;
  const aFrq = a.frq > 0 ? a.frq : 999999;
  const bFrq = b.frq > 0 ? b.frq : 999999;
  return aFrq - bFrq;
});

const top = entries.slice(0, COUNT);
console.log('Top 10 of ' + COUNT + ':');
for (let i = 0; i < 10 && i < top.length; i++) {
  const e = top[i];
  console.log('  ' + (i + 1) + '. ' + e.w + ' (collins=' + e.collins + ', bnc=' + e.bnc + ')');
}

const wordToRank = new Map();
top.forEach((e, i) => wordToRank.set(e.w, i + 1));
const testWords = ['revalidation', 'syringe', 'shipman', 'inquiry', 'hobble', 'endlessly', 'purred'];
console.log('');
console.log('Test words coverage:');
for (const w of testWords) {
  const r = wordToRank.get(w);
  console.log('  ' + w + ': ' + (r ? 'rank ' + r : 'NOT IN TOP ' + COUNT));
}

const dictOut = {};
for (const e of top) {
  dictOut[e.w] = { p: e.p, d: e.d, t: e.t };
}
const jsonStr = JSON.stringify(dictOut, null, '').replace(/":"/g, '":"').replace(/","p":"/g, '","p":"');
// 真正紧凑的 JSON（不依赖上面 replace）
const compact = JSON.stringify(dictOut);
console.log('');
console.log('Output size: ' + (compact.length / 1024).toFixed(0) + ' KB');

writeFileSync(OUTPUT, compact);
console.log('Wrote ' + OUTPUT);