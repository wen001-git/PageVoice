// views/capture.js —— 拍照 / 选图 → 压缩 → OCR → 进入编辑页
// 阶段 2 完整实现拍照 + OCR 流程。OCR 完成后跳到 #/edit?imageId=... & text=...

import { compressAndGrayscale } from '../services/image.js';
import { recognizeImage } from '../services/ocr.js';
import { navigate } from '../router.js';

export async function mountCapture(root, params) {
  root.innerHTML = `
    <div class="view">
      <header class="view-header">
        <a class="btn btn-secondary" href="#/" style="padding: 0.5em 0.9em;">← 书架</a>
        <h1 class="view-title">拍照 / 选图</h1>
        <span style="width: 4rem;"></span>
      </header>

      <div class="view-body" style="gap: 1rem;">
        <label class="btn btn-large btn-accent" for="file-input" style="cursor: pointer; min-width: 12rem;">
          📷 拍照 / 从相册选择
        </label>
        <input id="file-input" type="file" accept="image/*" capture="environment" multiple hidden>

        <div id="status" style="padding: 1rem; background: var(--bg-elevated); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); min-height: 6rem; display: flex; align-items: center; justify-content: center; text-align: center; color: var(--text-muted);">
          选好照片后，会自动识别并跳转编辑。
        </div>

        <div id="preview-container" style="display: none;">
          <img id="preview" alt="预览" style="width: 100%; border-radius: var(--radius-md); box-shadow: var(--shadow-md);">
          <p id="preview-meta" style="margin-top: 0.5rem; font-size: var(--font-size-sm); color: var(--text-muted); text-align: center;"></p>
        </div>
      </div>
    </div>
  `;

  const fileInput = root.querySelector('#file-input');
  const status = root.querySelector('#status');
  const previewContainer = root.querySelector('#preview-container');
  const previewImg = root.querySelector('#preview');
  const previewMeta = root.querySelector('#preview-meta');

  function setStatus(html, busy = false) {
    status.innerHTML = html;
    status.style.color = busy ? 'var(--primary)' : 'var(--text-muted)';
  }

  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 第一版只处理第一张（多张留给阶段 5）
    const file = files[0];
    setStatus('正在压缩图片…', true);
    let compressed;
    try {
      compressed = await compressAndGrayscale(file);
    } catch (err) {
      setStatus(`压缩失败：${err.message}<br><br><span style="font-size: var(--font-size-sm);">可以试试更小的图片</span>`);
      return;
    }

    previewContainer.style.display = 'block';
    previewImg.src = compressed.dataUrl;
    previewMeta.textContent = `${compressed.width} × ${compressed.height} · ${(compressed.blob.size / 1024).toFixed(0)} KB`;

    setStatus('正在识别英文（首次加载约需几秒）…', true);

    let result;
    try {
      result = await recognizeImage(compressed.blob, (p) => {
        setStatus(`识别中… ${(p * 100).toFixed(0)}%`);
      });
    } catch (err) {
      setStatus(`识别失败：${err.message}`);
      return;
    }

    if (!result.text.trim()) {
      setStatus('未识别到文字，请换张照片重试。');
      return;
    }

    // 把压缩后的图 + OCR 结果暂存到 sessionStorage，edit 页读
    const imageId = `cap_${Date.now()}`;
    sessionStorage.setItem(`pv:cap:${imageId}`, compressed.dataUrl);
    navigate(`/edit?imageId=${imageId}&text=${encodeURIComponent(result.text)}`);
  });
}