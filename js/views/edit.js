// views/edit.js —— OCR 文本编辑
// 阶段 2：展示 OCR 结果，可手动修正。阶段 3 会把 text 转句子；阶段 5 接书架。
// 第一版：只展示 + 编辑，保存到 sessionStorage（阶段 5 才进 IDB）。

import { navigate } from '../router.js';

export function mountEdit(root, params) {
  const { imageId, text } = params;
  const dataUrl = imageId ? sessionStorage.getItem(`pv:cap:${imageId}`) : null;

  root.innerHTML = `
    <div class="view">
      <header class="view-header">
        <a class="btn btn-secondary" href="#/capture" style="padding: 0.5em 0.9em;">← 重拍</a>
        <h1 class="view-title">校对文字</h1>
        <span style="width: 4rem;"></span>
      </header>

      <div class="view-body">
        ${dataUrl ? `
          <details style="background: var(--bg-elevated); border-radius: var(--radius-md); padding: 0.5rem 1rem;">
            <summary style="cursor: pointer; color: var(--text-muted);">查看原图</summary>
            <img src="${dataUrl}" alt="原图" style="width: 100%; margin-top: 0.5rem; border-radius: var(--radius-md);">
          </details>
        ` : ''}

        <label style="display: block; color: var(--text-muted); font-size: var(--font-size-sm);">
          识别结果（可修改）
        </label>
        <textarea id="text" style="
          width: 100%;
          min-height: 18rem;
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

        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button class="btn btn-secondary" data-action="clear">清空</button>
          <button class="btn btn-accent" data-action="next" style="min-width: 8rem;">
            下一步 →
          </button>
        </div>

        <p style="color: var(--text-subtle); font-size: var(--font-size-sm);">
          提示：OCR 可能识别错几个字，正常改一改就好。
        </p>
      </div>
    </div>
  `;

  const textarea = root.querySelector('#text');

  root.querySelector('[data-action="clear"]').addEventListener('click', () => {
    if (confirm('清空全部文字？')) textarea.value = '';
  });

  root.querySelector('[data-action="next"]').addEventListener('click', () => {
    const edited = textarea.value.trim();
    if (!edited) {
      alert('文字不能为空');
      return;
    }
    // 暂存到 sessionStorage，reader 页读
    sessionStorage.setItem(`pv:reader:text`, edited);
    if (dataUrl) sessionStorage.setItem(`pv:reader:image`, dataUrl);
    navigate('/read');
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}