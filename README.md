# PageVoice · 英文拍照读书

> 目的：让 14 岁用户拍照/选图 → 本地 OCR → 逐句朗读英文 + 单词释义。
> 目标读者：开发者（用户本人）+ 跨 AI 工具接手。
> 如何阅读：先看 [AGENTS.md](./AGENTS.md) 的当前状态与下一步 TODO；本文件只记开发约定。

## 本地开发

**重要**：必须用 HTTP server 跑起来，**不能直接 `file://` 打开**——service worker 需 HTTP 协议。

```bash
# 方案 A：Python（任何机器都自带）
cd /Users/Zhuanz/Claude/PageVoice
python3 -m http.server 8000

# 方案 B：Node（如果有）
npx http-server -p 8000
```

然后浏览器打开 <http://localhost:8000/>。

## 浏览器

- **开发主力**：桌面 Chrome / Edge（DevTools 完整、移动端模拟器好）
- **移动端真机**：iPhone Safari、iPad Safari、Android Chrome（如能借到）
- **Service Worker 测试**：DevTools → Application → Service Workers（确认注册成功）

## 目录结构

```
.
├── AGENTS.md               # 状态索引 + 关键实现备忘
├── docs/PROJECT_PLAN.md    # 详细设计与里程碑
├── index.html              # 单页入口
├── manifest.webmanifest    # PWA 清单（阶段 1）
├── sw.js                   # service worker（阶段 1）
├── css/                    # 主题 + 响应式
├── js/
│   ├── main.js             # 入口
│   ├── router.js           # hash 路由
│   ├── views/              # 页面组件
│   ├── services/           # OCR / TTS / DB / 词典
│   └── utils/              # 主题、UI、平台
├── vendor/                 # 自托管 Tesseract wasm + 训练数据（阶段 2）
├── data/                   # ECDICT 裁剪版（阶段 4）
├── icons/                  # PWA 图标
└── .nojekyll               # GitHub Pages 用
```

## 关键约束

- 纯静态前端，零服务器
- 图片和文字仅在浏览器本地处理，不上传
- Tesseract.js 钉死 **v5.1.1**（v6/v7 在 iOS 18.x 有 Load failed）
- OCR 前图片长边压到 **1600 px**（避免 wasm OOM）
- **iOS speechSynthesis 全部对策**（详见 AGENTS.md）：句级 ≤ 150 字、onend 链式、用户手势、闭包挂 utterance 防 GC、visibilitychange、超时 fallback、不依赖 pause/resume

## 部署

本地测试通过后再部署，详见 AGENTS.md 阶段 8。GitHub Pages / Render / Cloudflare Pages 都行，静态站点零成本。

## 许可

仅供家庭使用。
