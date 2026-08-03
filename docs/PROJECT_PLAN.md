# PageVoice — 项目计划与设计

> 目的：本仓库的设计/架构/里程碑文档。每个 Agent 接手时从 `../AGENTS.md` 索引进入，按需读这份。
> 目标读者：开发者（用户本人）+ 跨 AI 工具接手。
> 如何阅读：先看 AGENTS.md 的「当前状态」与「下一步 TODO」；本文件是详细设计/历史。完整计划见 `/Users/Zhuanz/.claude/plans/14-idempotent-engelbart.md`。

---

## 1. 目标

一个纯静态、零服务器、移动端可用的英文拍照读书 PWA。14 岁女儿拍英文书页 → 本地 OCR → 逐句朗读 + 点击单词查中文释义。

---

## 2. 技术栈（已与用户确认）

| 层 | 选型 |
|---|---|
| 前端框架 | 纯 HTML + 原生 ES Module（无构建工具） |
| 样式 | 手写 CSS + CSS 变量（无 Tailwind） |
| OCR | Tesseract.js v5，自托管 wasm + eng.traineddata.gz |
| 图片压缩 | browser-image-compression |
| 存储 | IndexedDB（idb 库）+ LocalStorage（设置） |
| 句子切分 | sentence-splitter（azu / textlint-rule） |
| 词典 | ECDICT 裁剪版（~5 MB gzip），按词频取 5–8 千词 |
| 朗读 | Web Speech API（speechSynthesis） |
| 离线 | 手写 service worker + 版本哨兵 |
| 部署 | GitHub Pages |

---

## 3. 核心架构决策

### 3.1 纯静态方案可行性

**结论：核心 MVP 在 iOS Safari / Android Chrome / 桌面浏览器都能跑。**

**iOS Safari speechSynthesis 风险**（来自订正后的研究）：
- ✅ 可用（iOS 7+）
- ⚠️ `onboundary` 不可靠（MDN 标 Limited availability）→ 不用词级高亮
- ⚠️ 长句「幽灵截断」→ 句级 ≤ 150 字 + onend 队列 + 超时 fallback
- ⚠️ 必须用户手势 → UI 入口强制 click/tap
- ⚠️ `pause()/resume()` 不可靠 → 自研状态机
- ⚠️ utterance GC 风险 → 挂闭包变量
- ❌ 不能保存为 MP3/WAV → 第一版不做

### 3.2 不可行的功能

- iOS / 移动端把 TTS 输出保存为音频
- 可靠的逐词高亮

---

## 4. 数据结构

```js
// IndexedDB: pagevoice
{
  books: { bookId, title, coverBlob, pageIds, createdAt, updatedAt },
  pages: { [bookId, pageIndex], imageBlob, ocrText, sentences, currentSentenceIdx, createdAt, updatedAt },
  settings: { key: 'global', rate, voiceURI, theme }
}
```

---

## 5. 分阶段开发计划

| 阶段 | 内容 | 工时 |
|---|---|---|
| 0 | 项目骨架 + 部署链路 | 0.5 天 |
| 1 | PWA + 离线基础 | 1 天 |
| 2 | 拍照 + 选图 + 压缩 + OCR | 1 天 |
| 3 | 句子切分 + 朗读核心 | 2 天 |
| 4 | 单词点击 + 词典 | 1.5 天 |
| 5 | 书架 + 持久化 | 1.5 天 |
| 6 | 打磨 + 部署 | 1 天 |
| 7 | 跨设备测试（里程碑） | 1 天 |

**总工期：~8–9 天**

---

## 6. 关键参考

- 完整计划：`/Users/Zhuanz/.claude/plans/14-idempotent-engelbart.md`
- iOS Web Speech 研究：`/Users/Zhuanz/.claude/plans/14-idempotent-engelbart-agent-a74664f2058124b63.md`
- PWA / IndexedDB 研究：`/Users/Zhuanz/.claude/plans/14-idempotent-engelbart-agent-adb1a16d87d9142dc.md`

---

## 变更记录
| 日期 | 变更内容 |
|------|---------|
| 2026-08-03 | 初始创建：与 `~/.claude/plans/14-idempotent-engelbart.md` 主计划同步 |
