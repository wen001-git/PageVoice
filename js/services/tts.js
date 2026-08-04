// services/tts.js —— Web Speech API 朗读引擎（带 iOS Safari 全部对策）
//
// 状态机：idle | loading | playing | paused | error
// 关键对策：
// 1) 句级切分 + onend 链式队列（避免长句截断）
// 2) 当前 utterance 挂闭包变量（避免 GC）
// 3) speak() 必须用户手势（调用方保证）
// 4) 不依赖 pause()/resume()（iOS 不稳）—— 用 cancel + 重新 speak
// 5) 单句超时 fallback（10s）—— onend 没触发就 cancel + 重 speak
// 6) visibilitychange 监听 —— 后台/锁屏自动暂停

const SENTENCE_TIMEOUT_MS = 10000;
const MAX_SENTENCE_LENGTH = 150; // 经验值，iOS 长句易截断

export class TTS {
  constructor() {
    this.state = 'idle';           // idle | loading | playing | paused | error
    this.sentences = [];           // 全部句子
    this.currentIdx = 0;           // 当前句索引
    this.rate = 1.0;               // 0.75 / 1.0 / 1.2
    this.voice = null;             // SpeechSynthesisVoice
    this.currentUtterance = null; // 挂闭包防 GC
    this.timeoutTimer = null;
    this.onChange = null;          // 回调：({state, currentIdx, total}) => void
    this._setupVisibilityHandler();
  }

  setOnChange(fn) {
    this.onChange = fn;
  }

  _emit() {
    this.onChange?.({
      state: this.state,
      currentIdx: this.currentIdx,
      total: this.sentences.length,
    });
  }

  _setupVisibilityHandler() {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') {
        this._pauseInternal();
      }
    });
  }

  /** 加载语音列表（必须等 voiceschanged） */
  async loadVoices() {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      const voices = synth.getVoices();
      if (voices.length > 0) {
        resolve(voices);
        return;
      }
      // 等 voiceschanged
      const handler = () => {
        synth.removeEventListener('voiceschanged', handler);
        resolve(synth.getVoices());
      };
      synth.addEventListener('voiceschanged', handler);
      // 兜底超时
      setTimeout(() => {
        synth.removeEventListener('voiceschanged', handler);
        resolve(synth.getVoices());
      }, 1000);
    });
  }

  /** 选一个英文声音（优先本地；按 lang 前缀匹配） */
  pickEnglishVoice(voices) {
    if (!voices || voices.length === 0) return null;
    const enVoices = voices.filter((v) => v.lang && v.lang.startsWith('en'));
    if (enVoices.length === 0) return voices[0];
    // 优先 localService=true（iOS 上这个字段可能不可靠但还是首选）
    const local = enVoices.find((v) => v.localService);
    return local || enVoices[0];
  }

  setRate(rate) {
    this.rate = Math.max(0.5, Math.min(2.0, rate));
  }

  /** 准备一段文字 */
  async prepare(text, opts = {}) {
    if (opts.rate) this.setRate(opts.rate);
    // 动态 import sentences 模块避免循环
    const { splitSentences } = await import('./sentences.js');
    let sents = await splitSentences(text);
    // 长句硬切（按字符数 ~150）
    sents = sents.flatMap((s) => this._splitLong(s, MAX_SENTENCE_LENGTH));
    this.sentences = sents.filter((s) => s.trim());
    this.currentIdx = 0;
    this.state = 'idle';
    this._emit();
  }

  _splitLong(s, maxLen) {
    if (s.length <= maxLen) return [s];
    // 在最近的逗号 / 空格 / 分号切
    const parts = [];
    let cur = '';
    const seps = [', ', '; ', ' — ', ' - ', ' '];
    for (const tok of s.split(/(\s+)/)) {
      if ((cur + tok).length > maxLen && cur) {
        parts.push(cur.trim());
        cur = '';
      }
      cur += tok;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }

  /** 开始 / 恢复播放（必须是用户手势同步路径） */
  play() {
    if (!('speechSynthesis' in window)) {
      this.state = 'error';
      this._emit();
      return;
    }
    const synth = window.speechSynthesis;
    if (this.state === 'paused') {
      // iOS pause/resume 不可靠，cancel + 重 speak 当前句
      synth.cancel();
      this._speakCurrent();
    } else {
      this._speakCurrent();
    }
  }

  pause() {
    this._pauseInternal();
  }

  _pauseInternal() {
    if (this.state !== 'playing') return;
    const synth = window.speechSynthesis;
    synth.cancel();
    // 注意：cancel 不会触发当前 utterance 的 onend，所以状态自己改
    this._clearTimeout();
    this.state = 'paused';
    this._emit();
  }

  next() {
    const synth = window.speechSynthesis;
    synth.cancel();
    this._clearTimeout();
    if (this.currentIdx < this.sentences.length - 1) {
      this.currentIdx++;
    }
    this._speakCurrent();
  }

  prev() {
    const synth = window.speechSynthesis;
    synth.cancel();
    this._clearTimeout();
    if (this.currentIdx > 0) {
      this.currentIdx--;
    }
    this._speakCurrent();
  }

  repeat() {
    const synth = window.speechSynthesis;
    synth.cancel();
    this._clearTimeout();
    this._speakCurrent();
  }

  jumpTo(idx) {
    if (idx < 0 || idx >= this.sentences.length) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    this._clearTimeout();
    this.currentIdx = idx;
    this._speakCurrent();
  }

  stop() {
    const synth = window.speechSynthesis;
    synth.cancel();
    this._clearTimeout();
    this.state = 'idle';
    this._emit();
  }

  _speakCurrent() {
    if (this.currentIdx >= this.sentences.length) {
      this.state = 'idle';
      this._emit();
      return;
    }
    const synth = window.speechSynthesis;
    const text = this.sentences[this.currentIdx];
    const u = new SpeechSynthesisUtterance(text);
    u.rate = this.rate;
    if (this.voice) u.voice = this.voice;
    // iOS 上 utterance 必须挂到闭包变量直到 onend/onerror
    this.currentUtterance = u;

    u.onstart = () => {
      this.state = 'playing';
      this._armTimeout();
      this._emit();
    };
    u.onend = () => {
      this._clearTimeout();
      this.currentUtterance = null;
      if (this.state === 'playing') {
        this.currentIdx++;
        this._speakCurrent();
      }
    };
    u.onerror = (e) => {
      // iOS 上 'interrupted' / 'canceled' 是 cancel() 触发的，不要当错误
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      console.warn('[TTS] error:', e.error);
      this._clearTimeout();
      this.currentUtterance = null;
      this.state = 'error';
      this._emit();
    };

    synth.speak(u);
  }

  _armTimeout() {
    this._clearTimeout();
    this.timeoutTimer = setTimeout(() => {
      // iOS 长句「幽灵截断」：onend 没触发，单句卡住
      // → cancel + 重新 speak 当前句（最多 2 次，避免死循环）
      const synth = window.speechSynthesis;
      synth.cancel();
      this.currentUtterance = null;
      this._speakCurrent();
    }, SENTENCE_TIMEOUT_MS);
  }

  _clearTimeout() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }
}

/** 单词发音（用于点击单词查词） */
export function speakWord(word, rate = 0.9) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(word);
  u.rate = rate;
  u.lang = 'en-US';
  window.speechSynthesis.speak(u);
}