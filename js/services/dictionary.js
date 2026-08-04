// services/dictionary.js —— ECDICT 离线词典
// 启动时懒加载 data/ecdict-mini.json 到内存 Map。
// 词典 5000 高频词，~1MB，可全内存常驻。

let dict = null;
let loadingPromise = null;

const DICT_URL = '/data/ecdict-mini.json';

async function load() {
  if (dict) return dict;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const res = await fetch(DICT_URL);
    if (!res.ok) throw new Error('词典加载失败：HTTP ' + res.status);
    dict = await res.json();
    return dict;
  })();
  return loadingPromise;
}

/**
 * 查一个单词。
 * @param {string} word
 * @returns {Promise<{ word: string, phonetic?: string, definition?: string, translation?: string } | null>}
 */
export async function lookup(word) {
  if (!word) return null;
  const w = word.toLowerCase().replace(/[^a-z']/g, '');
  if (!w) return null;
  await load();
  const entry = dict[w];
  if (!entry) return null;
  return { word: w, ...entry };
}

/**
 * 预加载词典（应用启动时调用，让首次查词不卡）
 */
export function preload() {
  return load().catch((e) => {
    console.warn('[dict] preload failed:', e.message);
  });
}

/** 词典大小（用于设置页展示） */
export function getSize() {
  return dict ? Object.keys(dict).length : 0;
}