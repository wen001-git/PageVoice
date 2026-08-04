// scripts/build-mini-ecdict.mjs
// 从 ECDICT CSV 按 BNC/frq 词频取前 N 词，输出压缩 JSON
// 用法：node scripts/build-mini-ecdict.mjs [count] [input] [output]
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const COUNT = parseInt(process.argv[2] || '5000', 10);
const INPUT = process.argv[3] || '/tmp/ecdict.csv';
const OUTPUT = process.argv[4] || resolve('data/ecdict-mini.json');

console.log(`Reading ${INPUT}...`);
const lines = readFileSync(INPUT, 'utf8').split('\n');
console.log(`Total lines: ${lines.length}`);

// 简单 CSV 解析（处理引号转义）
function parseLine(line) {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
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

// 第一行是 header（注意：CSV 行结尾可能带 \r）
const headerRaw = lines[0].replace(/\r$/, '');
const header = parseLine(headerRaw);
console.log('Header:', header);
const idxWord = header.indexOf('word');
const idxPhonetic = header.indexOf('phonetic');
const idxDef = header.indexOf('definition');
const idxTrans = header.indexOf('translation');
const idxBNC = header.indexOf('bnc');
const idxFRQ = header.indexOf('frq');

// 校验列索引
if (idxWord < 0 || idxFRQ < 0 || idxBNC < 0) {
  console.error('列索引解析失败。header =', header);
  process.exit(1);
}
console.log(`Indices: word=${idxWord} phonetic=${idxPhonetic} def=${idxDef} trans=${idxTrans} bnc=${idxBNC} frq=${idxFRQ}`);

// 校验：第一条数据行
console.log('First data row sample:', lines[1].slice(0, 200));

// 收集有效条目
const entries = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].replace(/\r$/, '').trim();
  if (!line) continue;
  const cols = parseLine(line);
  const word = cols[idxWord];
  if (!word || !/^[a-zA-Z]+$/.test(word)) continue; // 只要纯英文单词
  const bnc = parseInt(cols[idxBNC] || '0', 10);
  const frq = parseInt(cols[idxFRQ] || '0', 10);
  // 跳过无词频（=罕见词）；或词太长（专有名词）
  if (frq === 0 && bnc === 0) continue;
  if (word.length > 20) continue;
  entries.push({
    w: word,
    p: cols[idxPhonetic] || '',
    d: cols[idxDef] || '',
    t: cols[idxTrans] || '',
    f: frq + bnc * 100, // 综合分数
  });
}

console.log(`Valid entries: ${entries.length}`);

// 按综合分数排序，取前 N
entries.sort((a, b) => b.f - a.f);
const top = entries.slice(0, COUNT);
console.log(`Top ${COUNT}: from ${top[0].w} (f=${top[0].f}) to ${top[top.length - 1].w} (f=${top[top.length - 1].f})`);

// 输出为 { word: { p, d, t } } 紧凑对象（去掉词频字段）
const dict = {};
for (const e of top) {
  dict[e.w] = { p: e.p, d: e.d, t: e.t };
}
const json = JSON.stringify(dict);
console.log(`Output size: ${(json.length / 1024).toFixed(0)} KB`);
writeFileSync(OUTPUT, json);
console.log(`Wrote ${OUTPUT}`);