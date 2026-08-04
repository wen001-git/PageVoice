// main.js —— 应用入口
// 负责：主题初始化 + 启动检测（持久化请求）+ hash 路由 + 视图挂载

import { initRouter } from './router.js';
import { mountHome } from './views/home.js';
import { mountCapture } from './views/capture.js';
import { mountEdit } from './views/edit.js';
import { mountReader } from './views/reader.js';
import { mountSettings } from './views/settings.js';
import { applyTheme, getStoredTheme } from './utils/theme.js';
import { preload as preloadOcr } from './services/ocr.js';
import { preload as preloadDict } from './services/dictionary.js';

// 计算当前部署的 base path
// 例：https://wen001-git.github.io/PageVoice/js/main.js → '/PageVoice/'
// 例：http://localhost:8000/js/main.js                  → '/'
const BASE_PATH = new URL('.', import.meta.url).pathname.replace(/js\/$/, '');
// 暴露给其他模块（Tesseract 资源、词典等需要绝对 URL 拼接 base）
window.__BASE_PATH__ = BASE_PATH;

// ---- 应用启动 ----
async function bootstrap() {
  // 1. 应用主题（浅色 / 深色 / 跟随系统）
  applyTheme(getStoredTheme());

  // 2. iOS PWA：申请持久化存储
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => { /* ignore */ });
  }

  // 3. 注册 service worker（相对路径，兼容子路径部署）
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register(`${BASE_PATH}sw.js`);
    } catch (e) {
      console.debug('Service worker 注册失败（开发期可能正常）:', e);
    }
  }

  // 4. 启动 hash 路由
  initRouter({
    '/': mountHome,
    '/capture': mountCapture,
    '/edit': mountEdit,
    '/read': mountReader,
    '/settings': mountSettings,
  });

  // 5. 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredTheme() === 'auto') applyTheme('auto');
  });

  // 6. 后台预热 Tesseract worker + 词典
  preloadOcr();
  preloadDict();
}

bootstrap().catch((err) => {
  console.error('启动失败：', err);
  document.getElementById('app').innerHTML =
    `<div style="padding: 2rem; color: #c18c5d;">应用启动失败：${escapeHtml(err.message || String(err))}</div>`;
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}