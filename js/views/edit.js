// views/edit.js —— OCR 文本编辑（含图片旋转）
// 用户可在此手动扭转图片方向后重新识别；或保存现状继续到 reader。

import { navigate } from '../router.js';
import { rotateImage, flipImage, compressAndGrayscale } from '../services/image.js';
import { recognizeImage, terminate as terminateOcr } from '../services/ocr.js';

export function mountEdit(root, params) {
  let { imageId, text } = params;
  let currentBlob = null;       // 当前图的 Blob（可旋转后更新）
  let currentDataUrl = null;    // 当前图的 dataURL

  // 从 sessionStorage 恢复图
  const initDataUrl = imageId ? sessionStorage.getItem(`pv:cap:${imageId}`) : null;

  root.innerHTML = `
    <div class="view">
      <header class="view-header">
        <a class="btn btn-secondary" href="#/capture" style="padding: 0.5em 0.9em;">← 重拍</a>
        <h1 class="view-title">校对文字</h1>
        <span style="width: 4rem;"></span>
      </header>

      <div class="view-body">
        <div style="position: relative; background: var(--bg-elevated); border-radius: var(--radius-md); overflow: hidden;">
          <img id="preview" alt="原图" style="width: 100%; display: block;">
          <div id="preview-status" style="position: absolute; top: 0.5rem; right: 0.5rem; padding: 0.25rem 0.5rem; background: rgba(0,0,0,0.6); color: white; border-radius: var(--radius-sm); font-size: 0.75rem;"></div>
        </div>

        <!-- 旋转 / 重识别 工具栏 -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">
          <button class="btn btn-secondary" data-action="rotate-ccw" style="font-size: 0.85rem; padding: 0.6em 0.4em;" title="逆时针旋转 90°">
            ↺ 左转
          </button>
          <button class="btn btn-secondary" data-action="rotate-cw" style="font-size: 0.85rem; padding: 0.6em 0.4em;" title="顺时针旋转 90°">
            ↻ 右转
          </button>
          <button class="btn btn-secondary" data-action="flip" style="font-size: 0.85rem; padding: 0.6em 0.4em;" title="镜像翻转">
            ⇋ 镜像
          </button>
          <button class="btn btn-accent" data-action="reocr" style="font-size: 0.85rem; padding: 0.6em 0.4em;" title="用当前方向重新识别">
            🔄 重识别
          </button>
        </div>

        <label style="display: block; color: var(--text-muted); font-size: var(--font-size-sm);">
          识别结果（可修改）
        </label>
        <textarea id="text" style="
          width: 100%;
          min-height: 14rem;
          padding: 1rem;
          font-size: var(--font-size-base);
          line-height: var(--line-height);
          font-family: inherit;
          background: var(--bg-elevated);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          resize: vertical;
        ">${escapeHtml(text || '')}</textarea>

        <div id="status" style="padding: 0.75rem; background: var(--bg-elevated); border-radius: var(--radius-md); color: var(--text-muted); font-size: var(--font-size-sm); text-align: center; min-height: 2.5rem;">
          ${text ? '文字已识别，可修改后继续' : '等待识别…'}
        </div>

        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button class="btn btn-secondary" data-action="clear">清空</button>
          <button class="btn btn-accent" data-action="next" style="min-width: 8rem;">
            下一步 →
          </button>
        </div>
      </div>
    </div>
  `;

  const preview = root.querySelector('#preview');
  const status = root.querySelector('#status');
  const previewStatus = root.querySelector('#preview-status');
  const textarea = root.querySelector('#text');
  const rotateCwBtn = root.querySelector('[data-action="rotate-cw"]');
  const rotateCcwBtn = root.querySelector('[data-action="rotate-ccw"]');
  const flipBtn = root.querySelector('[data-action="flip"]');
  const reocrBtn = root.querySelector('[data-action="reocr"]');

  // 初次加载图
  if (initDataUrl) {
    preview.src = initDataUrl;
    // 把 dataURL 转成 Blob 供 rotate/flip
    dataUrlToBlob(initDataUrl).then((blob) => {
      currentBlob = blob;
    });
    // 同时存到 sessionStorage 作 reader 用（暂存当前 dataURL）
    currentDataUrl = initDataUrl;
    sessionStorage.setItem('pv:reader:image', initDataUrl);
    previewStatus.textContent = '';
  } else {
    previewStatus.textContent = '无原图';
    rotateCwBtn.disabled = rotateCcwBtn.disabled = flipBtn.disabled = reocrBtn.disabled = true;
  }

  function setStatus(html, busy = false) {
    status.innerHTML = html;
    status.style.color = busy ? 'var(--primary)' : 'var(--text-muted)';
  }

  async function applyTransform(fn, label) {
    if (!currentBlob) return;
    setStatus(`正在${label}…`, true);
    rotateCwBtn.disabled = rotateCcwBtn.disabled = flipBtn.disabled = reocrBtn.disabled = true;
    try {
      currentBlob = await fn(currentBlob);
      currentDataUrl = URL.createObjectURL(currentBlob);
      preview.src = currentDataUrl;
      // 更新 reader 暂存
      sessionStorage.setItem('pv:reader:image', currentDataUrl);
      previewStatus.textContent = `已${label}`;
      setStatus(`已${label}。如需识别新内容，点「重识别」`, false);
    } catch (e) {
      setStatus(`${label}失败：${e.message}`);
    } finally {
      rotateCwBtn.disabled = rotateCcwBtn.disabled = flipBtn.disabled = false;
      reocrBtn.disabled = !currentBlob;
    }
  }

  rotateCcwBtn.addEventListener('click', () => applyTransform((b) => rotateImage(b, 270), '左转 90°'));
  rotateCwBtn.addEventListener('click', () => applyTransform((b) => rotateImage(b, 90), '右转 90°'));
  flipBtn.addEventListener('click', () => applyTransform((b) => flipImage(b), '镜像'));
  reocrBtn.addEventListener('click', async () => {
    if (!currentBlob) return;
    setStatus('正在重新识别…', true);
    rotateCwBtn.disabled = rotateCcwBtn.disabled = flipBtn.disabled = reocrBtn.disabled = true;
    try {
      // 先压缩成灰度（OCR 友好）
      const { blob: ocrBlob } = await compressAndGrayscale(new File([currentBlob], 'rot.jpg', { type: 'image/jpeg' }));
      const result = await recognizeImage(ocrBlob, (p) => {
        setStatus(`重新识别中… ${(p * 100).toFixed(0)}%`);
      });
      if (!result.text.trim()) {
        setStatus('重识别后仍无文字，请尝试其他方向或重拍');
      } else {
        textarea.value = result.text;
        setStatus('✓ 已用当前方向重新识别');
      }
    } catch (e) {
      setStatus('重识别失败：' + e.message);
    } finally {
      rotateCwBtn.disabled = rotateCcwBtn.disabled = flipBtn.disabled = false;
      reocrBtn.disabled = false;
    }
  });

  root.querySelector('[data-action="clear"]').addEventListener('click', () => {
    if (confirm('清空全部文字？')) textarea.value = '';
  });

  root.querySelector('[data-action="next"]').addEventListener('click', () => {
    const edited = textarea.value.trim();
    if (!edited) {
      alert('文字不能为空');
      return;
    }
    sessionStorage.setItem(`pv:reader:text`, edited);
    navigate('/read');
  });
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}