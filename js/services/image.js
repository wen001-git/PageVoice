// services/image.js —— 图片压缩 + 灰度化
// 浏览器 ESM 不能直接 import UMD；UMD 挂在 window 上。
// 调用方先确保页面加载了 vendor/browser-image-compression/browser-image-compression.js
// （在 main.js 或 capture 视图里 import 它一次）

let imageCompressionPromise = null;

async function loadImageCompressionLib() {
  if (window.imageCompression) return window.imageCompression;
  if (!imageCompressionPromise) {
    imageCompressionPromise = import('../../vendor/browser-image-compression/browser-image-compression.js')
      .then(() => window.imageCompression);
  }
  return imageCompressionPromise;
}

/**
 * 压缩 + 灰度化照片
 * @param {File|Blob} file
 * @returns {Promise<{ blob: Blob, dataUrl: string, width: number, height: number }>}
 */
export async function compressAndGrayscale(file) {
  const imageCompression = await loadImageCompressionLib();

  // 1) 压缩：长边 1600 px（按 OCR 经验值，避免 wasm OOM），target ≤ 500 KB
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.85,
    alwaysKeepResolution: false,
  });

  // 2) 灰度化：OCR Tesseract 对灰度更友好；canvas 转灰度再存为 JPEG
  const grayscaled = await toGrayscale(compressed);

  // 3) 取 dataURL 用于预览
  const dataUrl = await blobToDataURL(grayscaled);

  // 4) 读尺寸
  const { width, height } = await readImageSize(grayscaled);

  return { blob: grayscaled, dataUrl, width, height };
}

async function toGrayscale(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    // ITU-R BT.601 灰度系数
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);
  bitmap.close?.();
  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

function readImageSize(blob) {
  return createImageBitmap(blob).then((bm) => {
    const size = { width: bm.width, height: bm.height };
    bm.close?.();
    return size;
  });
}