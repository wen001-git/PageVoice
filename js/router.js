// router.js —— 极简 hash 路由
// 路径写法：#/ / #/capture / #/read?bookId=xxx&page=1

const routes = new Map();
let appEl = null;

export function initRouter(routeMap) {
  appEl = document.getElementById('app');
  for (const [path, handler] of Object.entries(routeMap)) {
    routes.set(path, handler);
  }
  window.addEventListener('hashchange', handleRoute);
  // 启动时立即跑一次（处理首屏）
  if (!location.hash) {
    location.hash = '#/';
  } else {
    handleRoute();
  }
}

export function navigate(path) {
  if (location.hash === '#' + path) {
    handleRoute(); // 同路径强制刷新
  } else {
    location.hash = '#' + path;
  }
}

function handleRoute() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const queryIdx = raw.indexOf('?');
  const path = queryIdx === -1 ? raw : raw.slice(0, queryIdx);
  const query = queryIdx === -1 ? '' : raw.slice(queryIdx + 1);
  const params = Object.fromEntries(new URLSearchParams(query));

  const handler = routes.get(path);
  if (handler) {
    // 简单卸载（后续可加 lifecycle）
    appEl.innerHTML = '';
    handler(appEl, params);
  } else {
    renderNotFound();
  }
}

function renderNotFound() {
  appEl.innerHTML = `
    <div class="view">
      <div class="view-header">
        <h1 class="view-title">找不到页面</h1>
      </div>
      <div class="view-body">
        <p>路径 <code>${location.hash}</code> 没有对应页面。</p>
        <a class="btn" href="#/">返回首页</a>
      </div>
    </div>
  `;
}
