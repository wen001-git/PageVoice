# PageVoice — 项目交接

> 状态：规划阶段（用户已审批计划文件）
> 一句话定位：纯静态网页，让 14 岁用户拍照/选图 → 本地 OCR → 逐句朗读英文 + 单词释义。
> 部署：GitHub Pages

## 当前状态
- 计划文件已审批（`~/.claude/plans/14-idempotent-engelbart.md`）。
- 仓库尚未 `git init`，仅本地有 `AGENTS.md` + `docs/PROJECT_PLAN.md`。
- 等待用户选下一步：**A) 收尾（git init + commit + push 计划文件）** 还是 **B) 直接进入阶段 0（项目骨架 + 部署 GitHub Pages）**。

## 硬约束
- 纯静态前端，不购买服务器
- 图片与文字仅在浏览器本地处理，不上传
- 部署到 GitHub Pages
- 必须适配 iPhone / iPad Safari、Android Chrome、桌面浏览器
- 中文单词释义：纯离线 ECDICT 裁剪版（已确认）
- Tesseract.js **钉死 v5.1.1**（v6/v7 在 iOS 18.x 有 Load failed / 崩溃问题）

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
- [ ] **决策点**：收尾（推计划）还是直接进入阶段 0？
- [ ] **阶段 0**：git init + 推 GitHub + 启用 GitHub Pages + index.html "Hello PageVoice"
- [ ] **阶段 1**：PWA + 离线基础（manifest + Apple meta + service worker + 主题）
- [ ] **阶段 2**：拍照 + 选图 + 压缩 + 自托管 Tesseract v5.1.1 OCR（图片长边 ≤ 1600 px）
- [ ] **阶段 3**：句子切分（sentence-splitter azu 版）+ 朗读核心（含 iOS 全部对策）
- [ ] **阶段 4**：单词点击 + ECDICT 词典
- [ ] **阶段 5**：书架 + 持久化（idb）
- [ ] **阶段 6**：打磨 + 部署
- [ ] **阶段 7**：跨设备真机测试（里程碑）

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

