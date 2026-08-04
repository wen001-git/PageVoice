// views/home.js —— 书架首页
// 列出已保存的书（封面 + 标题 + 进度）+ 新建书的入口

import { navigate } from '../router.js';
import { getStoredTheme, setTheme, applyTheme } from '../utils/theme.js';
import { listBooks, getStorageEstimate } from '../services/db.js';

export async function mountHome(root, params) {
  const books = await listBooks();
  const estimate = await getStorageEstimate();
  const usageMB = estimate?.usage ? (estimate.usage / 1024 / 1024).toFixed(1) : null;
  const quotaMB = estimate?.quota ? (estimate.quota / 1024 / 1024).toFixed(0) : null;

  root.innerHTML = `
    <div class="view">
      <header class="view-header">
        <h1 class="view-title">书架</h1>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary" data-action="theme" aria-label="切换主题" style="padding: 0.5em 0.9em;">
            <span data-theme-icon>${themeIcon(getStoredTheme())}</span>
          </button>
          <a class="btn btn-secondary" href="#/settings" style="padding: 0.5em 0.9em;">设置</a>
        </div>
      </header>

      <div class="view-body">
        ${books.length === 0 ? `
          <div style="text-align: center; padding: 3rem 1rem;">
            <h2 style="font-size: 2rem; font-weight: 700; line-height: 1.3; margin-bottom: 1rem;">
              拍下英文书页<br>轻松跟读
            </h2>
            <p style="color: var(--text-muted); max-width: 32ch; margin: 0 auto 2.5rem;">
              拍照即可识别英文，逐句朗读并高亮。<br>点单词听发音、看中文释义。
            </p>
            <button class="btn btn-large btn-accent" data-action="capture" style="min-width: 12rem;">
              📷 开始拍照
            </button>
          </div>
        ` : `
          <button class="btn btn-accent" data-action="capture" style="width: 100%; margin-bottom: 1rem;">
            📷 拍新的一页
          </button>
          <div id="book-grid" style="
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
            gap: 1rem;
          ">
            ${books.map(bookCard).join('')}
          </div>
          ${usageMB ? `<p style="color: var(--text-subtle); font-size: var(--font-size-sm); text-align: center; margin-top: 1rem;">已用 ${usageMB} MB${quotaMB ? ` / ${quotaMB} MB` : ''}</p>` : ''}
        `}
      </div>
    </div>
  `;

  // 事件
  root.querySelector('[data-action="capture"]').addEventListener('click', () => {
    navigate('/capture');
  });
  root.querySelector('[data-action="theme"]').addEventListener('click', () => {
    const next = cycleTheme(getStoredTheme());
    setTheme(next);
    applyTheme(next);
    root.querySelector('[data-theme-icon]').textContent = themeIcon(next);
  });

  // 书卡片点击：默认进第一页
  root.querySelectorAll('.book-card').forEach((card) => {
    card.addEventListener('click', () => {
      const bookId = card.dataset.bookid;
      navigate(`/read?bookId=${bookId}&pageIndex=1`);
    });
    // 长按删除（移动端友好）
    let pressTimer = null;
    const startPress = () => {
      pressTimer = setTimeout(() => {
        if (confirm(`删除「${card.dataset.title}」？所有页面都会删除。`)) {
          import('../services/db.js').then(({ deleteBook }) =>
            deleteBook(bookId).then(() => mountHome(root))
          );
        }
      }, 800);
    };
    const cancelPress = () => clearTimeout(pressTimer);
    card.addEventListener('mousedown', startPress);
    card.addEventListener('touchstart', startPress, { passive: true });
    card.addEventListener('mouseup', cancelPress);
    card.addEventListener('mouseleave', cancelPress);
    card.addEventListener('touchend', cancelPress);
  });
}

function bookCard(book) {
  const coverSrc = book.coverBlob ? URL.createObjectURL(book.coverBlob) : '';
  const pageCount = (book.pageIds || []).length;
  return `
    <div class="book-card" data-bookid="${book.bookId}" data-title="${escapeHtml(book.title)}"
         style="
           cursor: pointer;
           background: var(--bg-elevated);
           border-radius: var(--radius-md);
           overflow: hidden;
           box-shadow: var(--shadow-sm);
           transition: transform 0.15s ease, box-shadow 0.15s ease;
           user-select: none;
         ">
      <div style="
        aspect-ratio: 3/4;
        background: var(--bg);
        background-image: url('${coverSrc}');
        background-size: cover;
        background-position: center;
        border-bottom: 1px solid var(--border);
      "></div>
      <div style="padding: 0.5rem 0.6rem;">
        <div style="
          font-size: var(--font-size-sm);
          font-weight: 500;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        ">${escapeHtml(book.title)}</div>
        <div style="
          font-size: 0.75rem;
          color: var(--text-subtle);
          margin-top: 0.25rem;
        ">${pageCount} 页</div>
      </div>
    </div>
  `;
}

function cycleTheme(current) {
  if (current === 'light') return 'dark';
  if (current === 'dark') return 'auto';
  return 'light';
}

function themeIcon(t) {
  return t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '🌓';
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}