// views/settings.js —— 设置页
// - 语速默认值
// - 声音选择（getVoices() 列表）
// - 清空所有数据
// - 关于

import { getSettings, saveSettings, clearAll } from '../services/db.js';
import { applyTheme, getStoredTheme, setTheme } from '../utils/theme.js';

export async function mountSettings(root, params) {
  const settings = await getSettings();
  const voices = await loadVoices();

  root.innerHTML = `
    <div class="view">
      <header class="view-header">
        <a class="btn btn-secondary" href="#/" style="padding: 0.5em 0.9em;">← 书架</a>
        <h1 class="view-title">设置</h1>
        <span style="width: 4rem;"></span>
      </header>

      <div class="view-body">
        <!-- 主题 -->
        <section style="background: var(--bg-elevated); border-radius: var(--radius-md); padding: 1rem;">
          <h3 style="font-size: var(--font-size-base); margin-bottom: 0.75rem;">主题</h3>
          <div style="display: flex; gap: 0.5rem;">
            ${['light', 'dark', 'auto'].map((t) => `
              <button class="btn ${getStoredTheme() === t ? 'btn-accent' : 'btn-secondary'}" data-theme="${t}" style="flex: 1;">
                ${t === 'light' ? '☀️ 浅色' : t === 'dark' ? '🌙 深色' : '🌓 跟随系统'}
              </button>
            `).join('')}
          </div>
        </section>

        <!-- 默认语速 -->
        <section style="background: var(--bg-elevated); border-radius: var(--radius-md); padding: 1rem;">
          <h3 style="font-size: var(--font-size-base); margin-bottom: 0.75rem;">默认语速</h3>
          <div style="display: flex; gap: 0.5rem;">
            ${[0.75, 1.0, 1.2].map((r) => `
              <button class="btn ${settings.rate === r ? 'btn-accent' : 'btn-secondary'}" data-rate="${r}" style="flex: 1;">
                ${r}x
              </button>
            `).join('')}
          </div>
        </section>

        <!-- 声音 -->
        <section style="background: var(--bg-elevated); border-radius: var(--radius-md); padding: 1rem;">
          <h3 style="font-size: var(--font-size-base); margin-bottom: 0.75rem;">朗读声音</h3>
          <select id="voice-select" style="
            width: 100%;
            padding: 0.6rem;
            font-size: var(--font-size-base);
            background: var(--bg);
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
          ">
            ${voices.map((v) => `
              <option value="${escapeAttr(v.voiceURI)}" ${settings.voiceURI === v.voiceURI ? 'selected' : ''}>
                ${escapeHtml(v.name)} (${v.lang})${v.localService ? ' · 本机' : ''}
              </option>
            `).join('')}
          </select>
          <button class="btn btn-secondary" data-action="preview-voice" style="margin-top: 0.5rem; width: 100%;">
            🔊 试听
          </button>
        </section>

        <!-- 添加到主屏引导 -->
        <section style="background: var(--bg-elevated); border-radius: var(--radius-md); padding: 1rem;">
          <h3 style="font-size: var(--font-size-base); margin-bottom: 0.5rem;">📱 添加到主屏</h3>
          <p style="color: var(--text-muted); font-size: var(--font-size-sm); line-height: 1.5;">
            iOS：在 Safari 打开本页 → 点底部「分享」⬆️ → 「添加到主屏幕」<br>
            Android：Chrome 菜单 → 「添加到主屏幕」<br>
            <br>
            添加后能享受独立窗口 + 完整存储空间。
          </p>
        </section>

        <!-- 清空数据 -->
        <section style="background: var(--bg-elevated); border-radius: var(--radius-md); padding: 1rem;">
          <h3 style="font-size: var(--font-size-base); margin-bottom: 0.75rem; color: #c0392b;">⚠️ 清空所有数据</h3>
          <p style="color: var(--text-muted); font-size: var(--font-size-sm); margin-bottom: 0.75rem;">
            删除所有书、阅读进度、设置。不可恢复。
          </p>
          <button class="btn" data-action="clear-all" style="background: #c0392b; color: white;">
            清空全部
          </button>
        </section>

        <!-- 关于 -->
        <section style="padding: 0.5rem; text-align: center; color: var(--text-subtle); font-size: var(--font-size-sm);">
          PageVoice v0.1 · 纯静态 PWA · 完全离线可用
        </section>
      </div>
    </div>
  `;

  // 主题
  root.querySelectorAll('[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.theme;
      setTheme(t);
      applyTheme(t);
      // 重 mount 刷新按钮状态
      mountSettings(root);
    });
  });

  // 语速
  root.querySelectorAll('[data-rate]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const r = parseFloat(btn.dataset.rate);
      await saveSettings({ rate: r });
      mountSettings(root);
    });
  });

  // 声音
  const select = root.querySelector('#voice-select');
  select.addEventListener('change', async () => {
    await saveSettings({ voiceURI: select.value });
  });
  root.querySelector('[data-action="preview-voice"]').addEventListener('click', () => {
    const uri = select.value;
    const voice = voices.find((v) => v.voiceURI === uri);
    const u = new SpeechSynthesisUtterance('Hello, this is a preview of my voice.');
    u.rate = 1.0;
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  });

  // 清空
  root.querySelector('[data-action="clear-all"]').addEventListener('click', async () => {
    if (!confirm('确定要清空所有数据吗？')) return;
    if (!confirm('真的？所有书、进度、设置都会消失。')) return;
    await clearAll();
    alert('已清空');
    location.hash = '#/';
    location.reload();
  });
}

async function loadVoices() {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const v = synth.getVoices();
    if (v.length > 0) {
      resolve(v.filter((x) => x.lang.startsWith('en')));
      return;
    }
    const handler = () => {
      synth.removeEventListener('voiceschanged', handler);
      resolve(synth.getVoices().filter((x) => x.lang.startsWith('en')));
    };
    synth.addEventListener('voiceschanged', handler);
    setTimeout(() => {
      synth.removeEventListener('voiceschanged', handler);
      resolve(synth.getVoices().filter((x) => x.lang.startsWith('en')));
    }, 1000);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function escapeAttr(s) {
  return escapeHtml(s);
}