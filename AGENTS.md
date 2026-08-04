# PageVoice — 项目交接

> 状态：**本地开发阶段**（先本地全流程跑通，再部署）
> 一句话定位：纯静态网页，让 14 岁用户拍照/选图 → 本地 OCR → 逐句朗读英文 + 单词释义。
> 部署：GitHub Pages / Render / 任意静态托管（最后阶段再做）

## 当前状态
- 计划文件已审批（`~/.claude/plans/14-idempotent-engelbart.md`），git 仓库已 push 到 `git@github.com:wen001-git/PageVoice.git`。
- **当前策略（用户已确认）**：先把系统在本地实现并测试通过，部署留到本地跑通后再做。
- **阶段 0~7 全部完成**（commit `b59a74d`）：项目骨架 + PWA + 拍照/OCR + 句级朗读 + 单词查义 + 书架 + IndexedDB + 设置页。
- **下一步**：阶段 8（部署到 GitHub Pages 或 Render）或真机测试反馈迭代。

## 硬约束
- 纯静态前端，不购买服务器
- 图片与文字仅在浏览器本地处理，不上传
- 部署到任意静态托管（GitHub Pages / Render 等）
- 必须适配 iPhone / iPad Safari、Android Chrome、桌面浏览器
- 中文单词释义：纯离线 ECDICT 裁剪版（已确认）
- Tesseract.js **钉死 v5.1.1**（v6/v7 在 iOS 18.x 有 Load failed / 崩溃问题）

## 本地开发约定
- **启动方式**：`python3 -m http.server 8000`（或 `npx http-server`）— 必须用 HTTP server，不能 file:// 打开（service worker 需 HTTP）
- **访问地址**：`http://localhost:8000/`
- **测试浏览器**：桌面 Chrome / Edge（开发主力）+ 移动端模拟器（DevTools → Toggle device toolbar）；如借得到真机用真机
- **每完成一阶段必须做里程碑测试**，通过才进下一阶段（不跳过）

## 关键实现备忘（规划阶段已固化）
- **Tesseract.js v5.1.1**（npm tag `5`，不追 v6/v7）
- **OCR 前图片长边压到 1600 px**（不是 2000，避免 wasm OOM）
- **sentence-splitter 维护者是 azu / textlint-rule**（**不是** wooorm——npm registry 已验证：maintainer=azu, repo=github.com/textlint-rule/sentence-splitter）
- **eng.traineddata.gz 实测 2.95 MB**（naptha/tessdata `4.0.0_best_int/`），用 `gzip: true` 拉取
- **wasm worker 用完定期 `worker.terminate()`**（wasm 堆只增不降，避免 OOM）
- **仓库根放 `.nojekyll`**（GitHub Pages 用 Jekyll 时会忽略 `_` 开头的文件）
- **`sw.js` 必须放仓库根**（service worker scope 限制）
- **句切分用 sentence-splitter**，不直接用 `Intl.Segmenter`（U.S./e.g./St. 误切）
- **iOS speechSynthesis 所有对策**（详见 plan §3）：句级 ≤ 150 字、onend 链式队列、用户手势、GC 防护、visibilitychange、超时 fallback、不依赖 pause/resume
- **GitHub Pages 无 SharedArrayBuffer**（COOP/COEP 不可设）。Tesseract 多线程默认关够用，不上 coi-serviceworker 折腾
- **不要做**：TTS 输出存 MP3、词级高亮（iOS 不可靠）、弯曲书页矫正、多语言 OCR

## 下一阶段 TODO
- [x] git init + 推 plan 文件到 GitHub（commit 796a003）
- [x] **阶段 0**：本地 http server + index.html 骨架 + 主题 + 路由（commit 1c57863）
- [x] **阶段 1**：PWA + 离线基础（manifest + Apple meta + service worker）
- [x] **阶段 2**：拍照 + 选图 + 压缩 + 自托管 Tesseract v5.1.1 OCR
- [x] **阶段 3**：句子切分 + 朗读核心（含 iOS 全部对策）
- [x] **阶段 4**：单词点击 + ECDICT 词典
- [x] **阶段 5**：书架 + 持久化（idb）
- [x] **阶段 6**：设置页 + 错误处理
- [x] **阶段 7**：本地端到端测试（Playwright 自动化 + 截图验证）
- [ ] **阶段 8**（最后）：部署到 GitHub Pages 或 Render
- [ ] 真机测试（iOS Safari / Android Chrome）— **用户负责**
- [ ] 根据真机反馈迭代

## 阶段 0 关键备忘
- **路由 bug 教训**：`routes.get(path) || routes.get('/')` 让 404 永远不可达（`routes.get('/')` 总 truthy）。改成 `if (handler) ... else renderNotFound()`。
- **ES Module 缓存陷阱**：调试时改 `js/*.js` 后浏览器仍用旧版。Playwright `page.goto(?nocache=N)` 或 `Ctrl+Shift+R` 强刷；不要只看 query string 不同。
- **温柔护眼主题**：浅色 `#FBF7F0` 米黄 / 主色 `#7B9E89` 绿 / 强调 `#C18C5D` 暖橙；深色 `#1F1B16` / `#A8C4A2` / `#D4A574`。
- **响应式断点**：`< 768px` 单列；`>= 768px` 居中 max-width 720px。

## 阶段 1~7 关键备忘
- **sentence-splitter 走 esm.sh**（不要自托管 — npm 内部依赖链太深）；SW 用 SWR 缓存 CDN。
- **Tesseract.js v5.1.1 钉死**（v6/v7 在 iOS 18.x 有 Load failed）。
- **OCR 前图片长边 ≤ 1600 px**（避免 wasm OOM）。
- **iOS speechSynthesis 对策**（见 `services/tts.js`）：句级 ≤ 150 字 + onend 链式 + 闭包挂 utterance 防 GC + visibilitychange + 单句超时 fallback + 不依赖 pause/resume。
- **ECDICT 排序**：collins desc + bnc/frq asc（top 20 = the/be/of/and/a/to/have/it/he/for...）。
- **dictionary.js 返回字段**：`{ word, p, d, t }`（不是 `phonetic/translation/definition`）。reader.js 里的命名一致性很重要。
- **router 解析**：`path` 和 `query` 分开 split 在第一个 `?`，否则 `#/read?bookId=...&pageIndex=1` 整串当 path。
- **SW 缓存策略**：app shell 文件用 stale-while-revalidate 而不是 cache-first（开发期更新友好）。
- **结构**：js/services/（OCR/TTS/sentences/dictionary/db/image）+ js/views/（home/capture/edit/reader/settings）+ js/utils/theme.js + js/main.js（bootstrap）+ js/router.js（hash 路由）。
- **vendor 21MB**（wasm 17MB + Tesseract 3MB + 词典 1.1MB + idb/bic 60KB）。GitHub Pages 单文件 100MB 限制 OK。

## 文件地图
- `AGENTS.md`（本文件）— 状态索引 + 关键实现备忘
- `docs/PROJECT_PLAN.md` — 详细设计与里程碑（已建）
- `~/.claude/plans/14-idempotent-engelbart.md` — 主计划（已审批）
- `~/.claude/plans/14-idempotent-engelbart-agent-a1849e1a8ee2dc641.md` — OCR/Tesseract.js 研究
- `~/.claude/plans/14-idempotent-engelbart-agent-a74664f2058124b63.md` — iOS Web Speech 研究（含订正）
- `~/.claude/plans/14-idempotent-engelbart-agent-adb1a16d87d9142dc.md` — PWA/IndexedDB/部署研究

## 变更记录
| 日期 | 变更内容 |
|------|---------|
| 2026-08-03 | 初始创建 |
| 2026-08-03 | 整合 OCR/Tesseract.js 最终报告：钉死 v5.1.1、图片 ≤ 1600 px、wasm worker 定期销毁；订正 sentence-splitter 归属（azu/textlint-rule，非 wooorm） |
| 2026-08-03 | git init + 推送计划文件到 git@github.com:wen001-git/PageVoice.git（commit 796a003） |
| 2026-08-03 | 策略调整：先本地实现并测试通过，部署留到最后（commit ec7c64b） |
| 2026-08-03 | 阶段 0 完成：项目骨架 + hash 路由 + 温柔护眼主题（commit 1c57863）。修路由 bug：404 不可达因 `|| routes.get('/')` 兜底 |
| 2026-08-03 | 文档：阶段 0 收尾记录到 AGENTS.md（commit c5c94fb） |
| 2026-08-04 | **阶段 1~7 全部完成**：PWA + OCR + 句级朗读 + 单词查义 + 书架 + IndexedDB + 设置页（commit b59a74d，3052 行） |

