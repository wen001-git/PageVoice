// services/sentences.js —— 句子切分
// 使用 sentence-splitter (azu / textlint-rule v5) via esm.sh
// 该库基于 Intl.Segmenter + 内置英文缩写表（Mr./Dr./U.S./etc.），避免误切

const IMPORT_URL = 'https://esm.sh/sentence-splitter@5.0.1';

let modPromise = null;

async function getMod() {
  if (!modPromise) {
    modPromise = import(/* @vite-ignore */ IMPORT_URL).then((m) => m.default || m);
  }
  return modPromise;
}

/**
 * 切分英文文本为句子数组。
 * @param {string} text
 * @returns {Promise<string[]>}
 */
export async function splitSentences(text) {
  if (!text || !text.trim()) return [];
  const splitter = await getMod();
  // sentence-splitter 的 split() 返回对象流：{ type: 'Sentence'|'WhiteSpace'|..., value: string }
  const nodes = splitter.split(text);
  const sentences = [];
  for (const node of nodes) {
    // 兼容不同版本的 type 字段
    const t = node.type || (node.raw && 'Sentence');
    if (t === 'Sentence' || t === 'Sentence' || node.typeName === 'Sentence') {
      const value = (node.value ?? node.raw ?? '').trim();
      if (value) sentences.push(value);
    }
  }
  return sentences;
}

/**
 * 把句子里切出单词 + charIndex（用于阶段 4 高亮单词或点击查词）
 * @param {string} sentence
 * @returns {Array<{ text: string, charIndex: number, charLength: number }>}
 */
export function tokenizeWords(sentence) {
  // 英文单词 = 连续字母 + 可选 ' / -
  const re = /[A-Za-z][A-Za-z'\-]*/g;
  const out = [];
  let m;
  while ((m = re.exec(sentence))) {
    out.push({
      text: m[0],
      charIndex: m.index,
      charLength: m[0].length,
    });
  }
  return out;
}