// views/reader.js —— 阅读视图（核心页）
// 阶段 3：句级切分 + 朗读 + 高亮 + 控制条 + 单词点击（阶段 4 充实）

import { TTS, speakWord } from '../services/tts.js';
import { splitSentences, tokenizeWords } from '../services/sentences.js';
import { lookup } from '../services/dictionary.js';
import { addPage, updatePageProgress, getPage } from '../services/db.js';

export async function mountReader(root, params) {
  const text = sessionStorage.getItem(`pv:reader:text`) || '';
  const imageUrl = sessionStorage.getItem(`pv:reader:image`);

  if (!text) {
    root.innerHTML = `
      <div class="view">
        <div class="view-body" style="text-align: center; padding: 3rem;">
          <p>没有可读的文字。</p>
          <a class="btn btn-accent" href="#/capture" style="margin-top: 1rem;">去拍照</a>
        </div>
      </div>
    `;
    return;
  }

  // 解析 URL ?bookId=&pageIndex= 直接读书架的某一页
  const directBookId = params.bookId;
  const directPageIndex = params.pageIndex != null ? parseInt(params.pageIndex, 10) : null;
  let loadedFromShelf = false;
  if (directBookId && directPageIndex != null) {
    const page = await getPage(directBookId, directPageIndex);
    if (page) {
      // 直接用书架里的内容
      sessionStorage.setItem(`pv:reader:text`, page.ocrText);
      if (page.imageBlob) {
        sessionStorage.setItem(`pv:reader:image`, URL.createObjectURL(page.imageBlob));
      }
      loadedFromShelf = true;
    }
  }

  // 句级切分
  root.innerHTML = `
    <div class="view" style="padding-bottom: 0;">
      <header class="view-header">
        <a class="btn btn-secondary" href="${loadedFromShelf ? '#/' : '#/edit'}" style="padding: 0.5em 0.9em;">${loadedFromShelf ? '← 书架' : '← 编辑'}</a>
        <h1 class="view-title">阅读</h1>
        <button class="btn btn-secondary" data-action="save" style="padding: 0.5em 0.9em; font-size: 0.85rem;" ${loadedFromShelf ? 'disabled' : ''}>保存</button>
      </header>

      ${imageUrl ? `<details style="margin-bottom: 1rem;"><summary style="color: var(--text-muted); cursor: pointer;">查看原图</summary><img src="${imageUrl}" alt="原图" style="width: 100%; margin-top: 0.5rem; border-radius: var(--radius-md);"></details>` : ''}

      <div id="sentences" style="
        flex: 1;
        padding: 1.25rem;
        font-size: var(--font-size-lg);
        line-height: var(--line-height);
        background: var(--bg-elevated);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
        margin-bottom: 1rem;
        word-break: break-word;
      ">
        <div style="color: var(--text-muted); text-align: center;">正在分句…</div>
      </div>

      <div id="control-bar" style="
        padding: 0.75rem 1.25rem calc(0.75rem + var(--safe-bottom));
        background: var(--bg-overlay);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-top: 1px solid var(--border);
        margin: 0 -1.5rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.4rem;
        position: sticky;
        bottom: 0;
      ">
        <button class="ctrl" data-action="prev" aria-label="上一句">⏮</button>
        <button class="ctrl ctrl-follow" data-action="follow" aria-label="跟读模式" title="跟读模式：每句重复 3 次">👂</button>
        <button class="ctrl ctrl-primary" data-action="play" aria-label="播放">▶</button>
        <button class="ctrl" data-action="next" aria-label="下一句">⏭</button>
        <button class="ctrl" data-action="repeat" aria-label="重复本句">🔁</button>
        <button class="ctrl" data-action="rate" aria-label="语速" style="font-size: 0.85em; min-width: 3.5rem;">1.0x</button>
      </div>
    </div>

    <style>
      .ctrl {
        background: transparent;
        border: 1px solid var(--border);
        color: var(--text);
        width: 3rem;
        height: 3rem;
        border-radius: 50%;
        font-size: 1.2rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.15s ease, transform 0.1s ease;
      }
      .ctrl:hover { background: var(--bg-elevated); }
      .ctrl:active { transform: scale(0.94); }
      .ctrl-primary {
        background: var(--primary);
        color: var(--primary-text);
        border-color: var(--primary);
        width: 3.5rem;
        height: 3.5rem;
        font-size: 1.4rem;
      }
      .ctrl-primary:hover { background: var(--primary-hover); }
      .sentence {
        padding: 0.25rem 0.4rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: background 0.15s ease;
        display: inline;
      }
      .sentence:hover { background: var(--bg); }
      .sentence.active {
        background: var(--highlight);
        color: var(--highlight-text);
      }
      .word {
        cursor: pointer;
        border-radius: 3px;
        padding: 0 1px;
      }
      .word:hover { background: var(--bg); }

      .word-popover {
        position: fixed;
        left: 50%;
        bottom: 6rem;
        transform: translateX(-50%);
        max-width: 92vw;
        width: 28rem;
        padding: 1rem 1.25rem;
        background: var(--bg-elevated);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        z-index: 100;
        border: 1px solid var(--border);
      }
      .word-popover .wp-head {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.5rem;
      }
      .word-popover .wp-word {
        font-size: 1.4rem;
        font-weight: 600;
      }
      .word-popover .wp-phonetic {
        color: var(--text-muted);
        font-family: 'Lucida Sans Unicode', 'Arial Unicode MS', sans-serif;
        font-size: 0.95rem;
      }
      .word-popover .wp-speak {
        margin-left: auto;
        background: var(--primary);
        color: var(--primary-text);
        width: 2.4rem;
        height: 2.4rem;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        font-size: 1.1rem;
      }
      .word-popover .wp-translation {
        color: var(--text);
        line-height: 1.5;
        white-space: pre-wrap;
      }
      .word-popover .wp-def {
        margin-top: 0.5rem;
        color: var(--text-muted);
        font-size: 0.9rem;
        line-height: 1.5;
        white-space: pre-wrap;
        max-height: 12rem;
        overflow-y: auto;
      }
      .word-popover .wp-empty {
        color: var(--text-subtle);
        font-style: italic;
      }
      .word-popover .wp-close {
        position: absolute;
        top: 0.5rem;
        right: 0.6rem;
        background: none;
        border: none;
        color: var(--text-muted);
        font-size: 1.4rem;
        cursor: pointer;
        padding: 0.25rem 0.5rem;
      }
    </style>
  `;

  const tts = new TTS();
  const sentencesEl = root.querySelector('#sentences');

  // 1) 准备语音
  const voices = await tts.loadVoices();
  tts.voice = tts.pickEnglishVoice(voices);

  // 2) 切句
  let sentences = await splitSentences(text);
  // 长句硬切（与 tts.prepare 一致；这里只是为了渲染）
  sentences = sentences.flatMap((s) => splitLongForRender(s));

  // 3) 渲染句元素
  sentencesEl.innerHTML = sentences.map((s, i) => `
    <span class="sentence" data-idx="${i}">${renderSentenceWithWords(s)}</span>
  `).join('');

  // 3.5) 加载设置（语速 / 声音）
  try {
    const { getSettings } = await import('../services/db.js');
    const settings = await getSettings();
    tts.setRate(settings.rate);
    if (settings.voiceURI && tts.voice?.voiceURI !== settings.voiceURI) {
      const v = voices.find((x) => x.voiceURI === settings.voiceURI);
      if (v) tts.voice = v;
    }
  } catch {}

  // 4) TTS prepare
  await tts.prepare(text);

  // 5) 控制条事件
  const playBtn = root.querySelector('[data-action="play"]');
  const rateBtn = root.querySelector('[data-action="rate"]');
  const followBtn = root.querySelector('[data-action="follow"]');
  const rateValues = [0.5, 0.6, 0.75, 1.0, 1.2];

  function updatePlayIcon() {
    playBtn.textContent = tts.state === 'playing' ? '⏸' : '▶';
  }
  function updateRateLabel() {
    rateBtn.textContent = `${tts.rate.toFixed(2).replace(/\.?0+$/, '')}x`;
  }
  function updateFollowBtn() {
    followBtn.classList.toggle('ctrl-follow-active', tts.followMode);
    followBtn.style.background = tts.followMode ? 'var(--accent)' : '';
    followBtn.style.color = tts.followMode ? '#fff' : '';
    followBtn.title = tts.followMode ? '跟读模式已开启（点关闭）' : '跟读模式：每句重复 3 次';
  }
  updatePlayIcon();
  updateRateLabel();
  updateFollowBtn();

  tts.setOnChange(({ state, currentIdx }) => {
    updatePlayIcon();
    // 高亮当前句
    const all = sentencesEl.querySelectorAll('.sentence');
    all.forEach((el) => el.classList.remove('active'));
    const cur = sentencesEl.querySelector(`.sentence[data-idx="${currentIdx}"]`);
    if (cur) {
      cur.classList.add('active');
      cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  root.querySelector('[data-action="play"]').addEventListener('click', () => {
    if (tts.state === 'playing') {
      tts.pause();
    } else {
      tts.play();
    }
  });
  root.querySelector('[data-action="next"]').addEventListener('click', () => tts.next());
  root.querySelector('[data-action="prev"]').addEventListener('click', () => tts.prev());
  root.querySelector('[data-action="repeat"]').addEventListener('click', () => tts.repeat());
  rateBtn.addEventListener('click', () => {
    const i = rateValues.indexOf(tts.rate);
    const next = rateValues[(i + 1) % rateValues.length];
    tts.setRate(next);
    updateRateLabel();
  });
  followBtn.addEventListener('click', () => {
    tts.setFollowMode(!tts.followMode);
    updateFollowBtn();
    // 跟读模式开启时如果有当前句在播，restart 让新设置生效
    if (tts.followMode && tts.state === 'playing') {
      tts.stop();
      tts.play();
    }
  });

  // 保存按钮：从 sessionStorage 拿图，建新书，写入第一页
  const saveBtn = root.querySelector('[data-action="save"]');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中…';
      try {
        const { createBook } = await import('../services/db.js');
        const imgUrl = sessionStorage.getItem('pv:reader:image');
        let coverBlob = null;
        if (imgUrl && imgUrl.startsWith('blob:')) {
          const res = await fetch(imgUrl);
          coverBlob = await res.blob();
        }
        const book = await createBook({ title: prompt('给这本书起个名字：', '我的英文书'), coverBlob });
        // 写入第一页
        await addPage({
          bookId: book.bookId,
          pageIndex: 1,
          imageBlob: coverBlob,
          ocrText: text,
          sentences: sentences,
        });
        saveBtn.textContent = '✓ 已保存';
        setTimeout(() => navigate('/'), 600);
      } catch (e) {
        if (e.message.includes('cancel') || e.message.includes('prompt')) return; // 用户取消
        saveBtn.textContent = '保存失败';
        saveBtn.disabled = false;
        alert('保存失败：' + e.message);
      }
    });
  }

  // 自动进度保存：currentIdx 变就触发（节流 1.5s）
  let lastSavedIdx = -1;
  let saveTimer = null;
  if (loadedFromShelf && directBookId && directPageIndex != null) {
    tts.setOnChange(({ currentIdx }) => {
      if (currentIdx === lastSavedIdx) return;
      lastSavedIdx = currentIdx;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        updatePageProgress(directBookId, directPageIndex, currentIdx).catch(() => {});
      }, 1500);
    });
    // 离开页面前保存
    window.addEventListener('beforeunload', () => {
      updatePageProgress(directBookId, directPageIndex, tts.currentIdx).catch(() => {});
    }, { once: true });
  }

  // 6) 点击句子跳转朗读 / 点击单词查词
  sentencesEl.addEventListener('click', async (e) => {
    const wordEl = e.target.closest('.word');
    const sentenceEl = e.target.closest('.sentence');
    if (wordEl) {
      const word = wordEl.dataset.word;
      // 先发单词音（用户点击已满足手势栈）
      speakWord(word);
      await showWordPopover(root, word);
      e.stopPropagation();
      return;
    }
    if (sentenceEl) {
      const idx = parseInt(sentenceEl.dataset.idx, 10);
      tts.jumpTo(idx);
    }
  });
}

async function showWordPopover(root, word) {
  // 移除已有的
  root.querySelector('.word-popover')?.remove();
  const pop = document.createElement('div');
  pop.className = 'word-popover';
  pop.innerHTML = `
    <button class="wp-close" aria-label="关闭">×</button>
    <div class="wp-head">
      <span class="wp-word">${escapeHtml(word)}</span>
      <span class="wp-phonetic"></span>
      <button class="wp-speak" aria-label="听发音">🔊</button>
    </div>
    <div class="wp-translation"><span class="wp-empty">查询中…</span></div>
    <div class="wp-def"></div>
  `;
  root.appendChild(pop);

  // 关闭逻辑
  const close = () => pop.remove();
  pop.querySelector('.wp-close').addEventListener('click', close);
  // 点击弹层外关闭
  setTimeout(() => {
    const onDocClick = (e) => {
      if (!pop.contains(e.target)) {
        close();
        document.removeEventListener('click', onDocClick);
      }
    };
    document.addEventListener('click', onDocClick);
  }, 0);
  // 发音
  pop.querySelector('.wp-speak').addEventListener('click', () => speakWord(word, 0.9));

  // 查询
  try {
    const entry = await lookup(word);
    if (!entry) {
      pop.querySelector('.wp-translation').innerHTML =
        `<span class="wp-empty">词典里没有这个词（top 5000 常用词）</span>`;
      pop.querySelector('.wp-def').textContent = '';
      return;
    }
    pop.querySelector('.wp-phonetic').textContent = entry.p ? `/${entry.p}/` : '';
    pop.querySelector('.wp-translation').textContent = entry.t || '(无翻译)';
    pop.querySelector('.wp-def').textContent = entry.d || '';
  } catch (e) {
    pop.querySelector('.wp-translation').innerHTML =
      `<span class="wp-empty">查询失败：${e.message}</span>`;
  }
}

function renderSentenceWithWords(sentence) {
  // 每个英文单词包成 <span class="word">，标点 + 空格照原文
  return sentence.replace(/[A-Za-z][A-Za-z'\-]*/g, (match) =>
    `<span class="word" data-word="${match.toLowerCase()}">${escapeHtml(match)}</span>`
  ) + ' ';
}

function splitLongForRender(s, max = 150) {
  if (s.length <= max) return [s];
  const parts = [];
  let cur = '';
  for (const tok of s.split(/(\s+)/)) {
    if ((cur + tok).length > max && cur) {
      parts.push(cur.trim());
      cur = '';
    }
    cur += tok;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}