// services/ocr.js —— Tesseract.js v5.1.1 自托管 OCR
// 资源全部从 /vendor/ 自托管，不依赖 cdn。

import { navigate } from '../router.js';

// 全局只一个 worker（OCR 慢，重复创建 worker 耗资源 + wasm 堆只增不降）
let workerPromise = null;

async function loadTesseractLib() {
  // 触发主库加载（副作用：window.Tesseract 出现）
  if (!window.Tesseract) {
    await import('../../vendor/tesseract/tesseract.min.js');
  }
  return window.Tesseract;
}

async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const Tesseract = await loadTesseractLib();
      const worker = await Tesseract.createWorker('eng', 1, {
        workerPath: '/vendor/tesseract/worker.min.js',
        corePath: '/vendor/tesseract-core',  // 目录；Tesseract.js 自动选 4 个 wasm 变体里最佳的
        langPath: '/vendor/tessdata',        // 目录（不带尾斜杠）
        gzip: true,
        cacheMethod: 'readOnly',             // SW 接管缓存
        workerBlobURL: true,
        logger: (m) => {
          if (onProgress && m.status === 'recognizing text') {
            onProgress(m.progress);
          }
        },
      });
      return worker;
    })();
  }
  return workerPromise;
}

/**
 * 识别一张图片
 * @param {Blob} blob - 已压缩 + 灰度化的 JPEG
 * @param {(progress: number) => void} onProgress - 0~1
 * @returns {Promise<{ text: string, words: Array<{ text: string, confidence: number, bbox: {x0,y0,x1,y1} }> }>}
 */
export async function recognizeImage(blob, onProgress) {
  const worker = await getWorker(onProgress);
  const url = URL.createObjectURL(blob);
  try {
    const { data } = await worker.recognize(url);
    return {
      text: data.text,
      words: (data.words || []).map((w) => ({
        text: w.text,
        confidence: w.confidence,
        bbox: w.bbox,
      })),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 主动销毁 worker（释放 wasm 堆；建议在长时间不用时调）
 */
export async function terminate() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}

/**
 * 预热：在应用启动时后台加载 worker + 语言包，
 * 首次识别时就不卡在初始化上。
 */
export function preload() {
  return getWorker(() => {}).catch((e) => {
    console.warn('[ocr] preload failed:', e.message);
  });
}