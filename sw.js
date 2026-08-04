// sw.js —— PageVoice 服务工作线程
// 策略：
// - 应用 shell（HTML/JS/CSS/manifest）：cache-first + 版本哨兵
// - 自托管库（idb、browser-image-compression）：stale-while-revalidate
// - esm.sh CDN（sentence-splitter 等）：stale-while-revalidate
// - Tesseract 资源（阶段 2 加入）：stale-while-revalidate
// - 导航请求：网络优先，失败回退到 cache，确保离线可用
// - 永远不要缓存 fetch() with method != GET / 跨域非 200 响应

const VERSION = 'pv-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/reset.css',
  '/css/app.css',
  '/js/main.js',
  '/js/router.js',
  '/js/utils/theme.js',
  '/js/views/home.js',
  '/js/views/capture.js',
  '/js/views/edit.js',
  '/js/views/reader.js',
  '/js/views/settings.js',
  '/js/services/image.js',
  '/js/services/ocr.js',
  '/js/services/sentences.js',
  '/js/services/tts.js',
  '/js/services/dictionary.js',
  '/js/services/db.js',
  '/data/ecdict-mini.json',
  '/vendor/idb/idb.umd.js',
  '/vendor/browser-image-compression/browser-image-compression.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon-180x180.png',
];

// ===== 安装 =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      // 用 addAll 但忽略单个失败（开发期常见）
      return Promise.all(
        SHELL_FILES.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
            console.warn('[SW] shell precache failed:', url, err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ===== 激活：清理旧版本缓存 =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// ===== 拦截 =====
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 同源
  if (url.origin === self.location.origin) {
    // 导航请求：network-first（保证部署后能立即更新）
    if (req.mode === 'navigate') {
      event.respondWith(networkFirst(req));
      return;
    }
    // 应用 shell 文件：stale-while-revalidate（开发期更新友好；生产也能后台更新）
    if (SHELL_FILES.includes(url.pathname)) {
      event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
      return;
    }
    // 其它同源：stale-while-revalidate
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 跨域：esm.sh CDN（sentence-splitter 等）
  if (url.host === 'esm.sh' || url.host === 'cdn.jsdelivr.net') {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 其它跨域：放行
  return;
});

// ===== 策略 =====

async function cacheFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return new Response('离线 + 缓存未命中：' + req.url, { status: 503 });
  }
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // 最后兜底：返回 index.html（SPA 路由）
    return cache.match('/index.html') || cache.match('/');
  }
}

async function staleWhileRevalidate(req, cacheName = RUNTIME_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await networkPromise) || new Response('离线', { status: 503 });
}
