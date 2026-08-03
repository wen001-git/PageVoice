// views/home.js —— 书架首页（阶段 0 占位：欢迎页 + 「开始拍照」按钮）
// 阶段 5 会改造为真实的书列表。

import { navigate } from '../router.js';
import { getStoredTheme, setTheme, applyTheme } from '../utils/theme.js';

export function mountHome(root, params) {
  root.innerHTML = `
    <div class="view">
      <header class="view-header">
        <h1 class="view-title">PageVoice</h1>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary" data-action="theme" aria-label="切换主题" style="padding: 0.5em 0.9em;">
            <span data-theme-icon>${themeIcon(getStoredTheme())}</span>
          </button>
          <a class="btn btn-secondary" href="#/settings" style="padding: 0.5em 0.9em;">设置</a>
        </div>
      </header>

      <div class="view-body" style="align-items: center; text-align: center; padding: 3rem 1rem;">
        <h2 style="font-size: 2.2rem; font-weight: 700; line-height: 1.3; margin-bottom: 1rem;">
          拍下英文书页<br>轻松跟读
        </h2>
        <p style="color: var(--text-muted); max-width: 32ch; margin: 0 auto 2.5rem;">
          拍照即可识别英文，逐句朗读并高亮。<br>点单词听发音、看中文释义。
        </p>

        <button class="btn btn-large btn-accent" data-action="capture" style="min-width: 12rem;">
          📷 开始拍照
        </button>

        <div style="margin-top: 3rem; padding: 1.5rem; background: var(--bg-elevated); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); text-align: left; max-width: 28rem; width: 100%;">
          <h3 style="font-size: var(--font-size-base); margin-bottom: 0.75rem;">📖 当前进度</h3>
          <p style="color: var(--text-muted); font-size: var(--font-size-sm);">
            还没有保存的书。<br>点上面按钮开始拍第一页。
          </p>
        </div>
      </div>
    </div>
  `;

  // 事件绑定
  root.querySelector('[data-action="capture"]').addEventListener('click', () => {
    // 阶段 2 实现：拍照 + 选图 + OCR
    alert('阶段 2 才会实装拍照功能 🚧\n当前是阶段 0 骨架。');
  });

  root.querySelector('[data-action="theme"]').addEventListener('click', () => {
    const next = cycleTheme(getStoredTheme());
    setTheme(next);
    applyTheme(next);
    // 更新图标
    root.querySelector('[data-theme-icon]').textContent = themeIcon(next);
  });
}

function cycleTheme(current) {
  if (current === 'light') return 'dark';
  if (current === 'dark') return 'auto';
  return 'light';
}

function themeIcon(t) {
  return t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '🌓';
}
