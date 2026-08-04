// services/image.js —— 图片处理：压缩 + 灰度化 + 旋转 + 镜像
// 浏览器 ESM 不能直接 import UMD；UMD 挂在 window 上。

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
 * 压缩 + 灰度化 + 自动 EXIF 旋转
 * 注意：browser-image-compression 默认会自动按 EXIF orientation 旋转像素，
 * 所以这里出来的图已是「正立」的。
 */
export async function compressAndGrayscale(file) {
  const imageCompression = await loadImageCompressionLib();

  const compressed = await imageCompression(file, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.85,
    alwaysKeepResolution: false,
  });

  const grayscaled = await toGrayscale(compressed);
  const dataUrl = await blobToDataURL(grayscaled);
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
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);
  bitmap.close?.();
  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}

/**
 * 旋转图片 Blob（顺时针）
 * @param {Blob} blob
 * @param {0|90|180|270} degrees
 * @returns {Promise<Blob>}
 */
export async function rotateImage(blob, degrees) {
  if (!degrees || degrees === 0) return blob;
  const bitmap = await createImageBitmap(blob);
  const swap = degrees === 90 || degrees === 270;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? bitmap.height : bitmap.width;
  canvas.height = swap ? bitmap.width : bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close?.();
  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}

/**
 * 镜像翻转（水平）
 */
export async function flipImage(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(bitmap, 0, 0);
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