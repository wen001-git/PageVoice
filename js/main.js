// main.js —— 应用入口
// 负责：主题初始化 + 启动检测（持久化请求）+ hash 路由 + 视图挂载

import { initRouter } from './router.js';
import { mountHome } from './views/home.js';
import { applyTheme, getStoredTheme } from './utils/theme.js';

// ---- 应用启动 ----
async function bootstrap() {
  // 1. 应用主题（浅色 / 深色 / 跟随系统）
  applyTheme(getStoredTheme());

  // 2. iOS PWA：申请持久化存储（仅在用户交互后才会被接受，但提前调用没坏处）
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => { /* ignore */ });
  }

  // 3. 注册 service worker（阶段 1 会建 sw.js，这里先防御性写好）
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (e) {
      // sw.js 不存在也不致命（开发期）
      console.debug('Service worker 注册失败（开发期可能正常）:', e);
    }
  }

  // 4. 启动 hash 路由
  initRouter({
    '/': mountHome,
    // 阶段 2 起会陆续加：
    // '/capture': mountCapture,
    // '/edit': mountEdit,
    // '/read': mountReader,
    // '/settings': mountSettings,
  });

  // 5. 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredTheme() === 'auto') applyTheme('auto');
  });
}

bootstrap().catch((err) => {
  console.error('启动失败：', err);
  document.getElementById('app').innerHTML =
    `<div style="padding: 2rem; color: #c18c5d;">应用启动失败：${err.message}</div>`;
});
