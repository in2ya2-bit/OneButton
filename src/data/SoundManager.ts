import { SaveManager, SettingsData } from './SaveManager';

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let bgmGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let currentBgm: OscillatorNode[] = [];
let bgmInterval: ReturnType<typeof setInterval> | null = null;
let currentBgmId = '';
let settings: SettingsData = SaveManager.loadSettings();

function ensureCtx() {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = settings.muted ? 0 : settings.bgmVolume * 0.3;
    bgmGain.connect(masterGain);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = settings.muted ? 0 : settings.sfxVolume;
    sfxGain.connect(masterGain);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function stopBgm() {
  if (bgmInterval !== null) { clearInterval(bgmInterval); bgmInterval = null; }
  currentBgm.forEach(o => { try { o.stop(); } catch { /* */ } });
  currentBgm = [];
  currentBgmId = '';
}

function playNote(freq: number, type: OscillatorType, dur: number, gain: GainNode, vol = 0.15, delay = 0) {
  const c = ensureCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + delay);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + delay + 0.02);
  g.gain.linearRampToValueAtTime(0, c.currentTime + delay + dur);
  osc.connect(g);
  g.connect(gain);
  osc.start(c.currentTime + delay);
  osc.stop(c.currentTime + delay + dur + 0.05);
  return osc;
}

function loopBgm(id: string, notes: [number, OscillatorType, number][], tempo: number, gain: GainNode) {
  if (currentBgmId === id) return;
  stopBgm();
  currentBgmId = id;
  const c = ensureCtx();
  let time = c.currentTime + 0.1;
  const totalDur = notes.reduce((s, n) => s + n[2] * tempo, 0);

  const schedule = () => {
    for (const [freq, type, beats] of notes) {
      const dur = beats * tempo;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.12, time);
      g.gain.linearRampToValueAtTime(0, time + dur - 0.02);
      osc.connect(g);
      g.connect(gain);
      osc.start(time);
      osc.stop(time + dur);
      currentBgm.push(osc);
      time += dur;
    }
  };

  schedule();
  bgmInterval = setInterval(() => {
    if (!ctx || currentBgmId !== id) { if (bgmInterval !== null) { clearInterval(bgmInterval); bgmInterval = null; } return; }
    time = ctx.currentTime + 0.05;
    currentBgm.forEach(o => { try { o.stop(); } catch { /* */ } });
    currentBgm = [];
    schedule();
  }, totalDur * 1000 - 200);
}

/* ========== BGM DEFINITIONS ========== */

const TITLE_NOTES: [number, OscillatorType, number][] = [
  [220, 'sine', 2], [262, 'sine', 2], [330, 'sine', 2], [294, 'sine', 2],
  [262, 'sine', 2], [247, 'sine', 2], [220, 'sine', 2], [196, 'sine', 2],
  [220, 'sine', 2], [262, 'sine', 1], [330, 'sine', 1], [349, 'sine', 2], [330, 'sine', 2],
  [294, 'sine', 2], [262, 'sine', 2], [247, 'sine', 2], [220, 'sine', 2],
];

const BATTLE_NOTES: [number, OscillatorType, number][] = [
  [165, 'sawtooth', 1], [196, 'sawtooth', 1], [220, 'sawtooth', 1], [247, 'sawtooth', 1],
  [220, 'sawtooth', 1], [196, 'sawtooth', 1], [165, 'sawtooth', 2],
  [175, 'sawtooth', 1], [220, 'sawtooth', 1], [262, 'sawtooth', 1], [220, 'sawtooth', 1],
  [175, 'sawtooth', 2], [165, 'sawtooth', 2],
];

const BOSS_NOTES: [number, OscillatorType, number][] = [
  [110, 'square', 1], [131, 'square', 1], [110, 'square', 1], [147, 'square', 1],
  [131, 'square', 1], [110, 'square', 1], [98, 'square', 2],
  [110, 'square', 1], [147, 'square', 1], [165, 'square', 1], [147, 'square', 1],
  [131, 'square', 1], [110, 'square', 1], [98, 'square', 2],
];

/* ========== PUBLIC API ========== */

export const SoundManager = {
  init() { ensureCtx(); },

  updateSettings(s: SettingsData) {
    settings = s;
    if (bgmGain) bgmGain.gain.value = s.muted ? 0 : s.bgmVolume * 0.3;
    if (sfxGain) sfxGain.gain.value = s.muted ? 0 : s.sfxVolume;
  },

  /* ---- BGM ---- */

  playTitleBgm() { ensureCtx(); if (bgmGain) loopBgm('title', TITLE_NOTES, 0.45, bgmGain); },
  playBattleBgm() { ensureCtx(); if (bgmGain) loopBgm('battle', BATTLE_NOTES, 0.22, bgmGain); },
  playBossBgm() { ensureCtx(); if (bgmGain) loopBgm('boss', BOSS_NOTES, 0.18, bgmGain); },

  playClearFanfare() {
    ensureCtx();
    if (!sfxGain) return;
    [523, 659, 784, 1047].forEach((f, i) => playNote(f, 'square', 0.4, sfxGain!, 0.15, i * 0.15));
  },

  playGameOverBgm() {
    stopBgm();
    ensureCtx();
    if (!bgmGain) return;
    [110, 98, 87, 82].forEach((f, i) => playNote(f, 'sine', 1.5, bgmGain!, 0.12, i * 0.5));
  },

  stopBgm() { stopBgm(); },

  /* ---- SFX ---- */

  sfxHit() { ensureCtx(); if (sfxGain) playNote(800, 'square', 0.06, sfxGain, 0.2); },
  sfxCritical() {
    ensureCtx(); if (!sfxGain) return;
    playNote(1000, 'sawtooth', 0.08, sfxGain, 0.25);
    playNote(1400, 'sawtooth', 0.06, sfxGain, 0.2, 0.04);
  },
  sfxFireball() {
    ensureCtx(); if (!sfxGain) return;
    playNote(200, 'sawtooth', 0.3, sfxGain, 0.15);
    playNote(400, 'sawtooth', 0.15, sfxGain, 0.1, 0.1);
  },
  sfxPoison() { ensureCtx(); if (sfxGain) playNote(300, 'sine', 0.2, sfxGain, 0.12); },
  sfxExplosion() {
    ensureCtx(); if (!sfxGain) return;
    playNote(100, 'sawtooth', 0.3, sfxGain, 0.2);
    playNote(60, 'square', 0.2, sfxGain, 0.15, 0.05);
  },
  sfxShield() { ensureCtx(); if (sfxGain) playNote(500, 'triangle', 0.15, sfxGain, 0.15); },
  sfxManaBurst() {
    ensureCtx(); if (!sfxGain) return;
    playNote(600, 'sine', 0.2, sfxGain, 0.15);
    playNote(900, 'sine', 0.15, sfxGain, 0.12, 0.08);
  },
  sfxShadow() { ensureCtx(); if (sfxGain) playNote(350, 'square', 0.1, sfxGain, 0.18); },
  sfxIce() {
    ensureCtx(); if (!sfxGain) return;
    playNote(1400, 'sine', 0.12, sfxGain, 0.12);
    playNote(1800, 'sine', 0.08, sfxGain, 0.1, 0.05);
  },
  sfxLightning() {
    ensureCtx(); if (!sfxGain) return;
    playNote(100, 'sawtooth', 0.04, sfxGain, 0.25);
    playNote(2200, 'square', 0.06, sfxGain, 0.2, 0.02);
    playNote(600, 'sawtooth', 0.08, sfxGain, 0.12, 0.06);
  },
  sfxBuff() {
    ensureCtx(); if (!sfxGain) return;
    [500, 700, 900].forEach((f, i) => playNote(f, 'triangle', 0.15, sfxGain!, 0.1, i * 0.06));
  },
  sfxDebuff() {
    ensureCtx(); if (!sfxGain) return;
    playNote(300, 'sawtooth', 0.2, sfxGain, 0.12);
    playNote(200, 'sawtooth', 0.15, sfxGain, 0.1, 0.08);
  },
  sfxStealth() {
    ensureCtx(); if (!sfxGain) return;
    playNote(800, 'sine', 0.2, sfxGain, 0.06);
    playNote(600, 'sine', 0.15, sfxGain, 0.04, 0.1);
  },
  sfxLevelUp() {
    ensureCtx(); if (!sfxGain) return;
    [440, 554, 659, 880].forEach((f, i) => playNote(f, 'sine', 0.2, sfxGain!, 0.12, i * 0.08));
  },
  sfxPotion() {
    ensureCtx(); if (!sfxGain) return;
    playNote(600, 'sine', 0.15, sfxGain, 0.1);
    playNote(800, 'sine', 0.1, sfxGain, 0.08, 0.08);
  },
  sfxBossWarning() {
    ensureCtx(); if (!sfxGain) return;
    playNote(80, 'sawtooth', 0.8, sfxGain, 0.2);
    playNote(75, 'square', 0.6, sfxGain, 0.15, 0.3);
  },
  sfxCardSelect() {
    ensureCtx(); if (!sfxGain) return;
    playNote(1200, 'triangle', 0.04, sfxGain, 0.1);
    playNote(1600, 'triangle', 0.03, sfxGain, 0.08, 0.03);
  },
  sfxAchievement() {
    ensureCtx(); if (!sfxGain) return;
    [660, 880, 1100, 1320].forEach((f, i) => playNote(f, 'triangle', 0.2, sfxGain!, 0.1, i * 0.1));
  },
  sfxGold() { ensureCtx(); if (sfxGain) playNote(2000, 'triangle', 0.05, sfxGain, 0.08); },
  sfxGameOver() {
    ensureCtx(); if (!sfxGain) return;
    [220, 196, 165, 131].forEach((f, i) => playNote(f, 'sine', 0.5, sfxGain!, 0.12, i * 0.3));
  },
  sfxClick() { ensureCtx(); if (sfxGain) playNote(1000, 'triangle', 0.03, sfxGain, 0.08); },

  sfxPlayerHit() {
    ensureCtx(); if (!sfxGain) return;
    playNote(120, 'sawtooth', 0.12, sfxGain, 0.2);
    playNote(80, 'square', 0.08, sfxGain, 0.15, 0.04);
  },
  sfxBossHit() {
    ensureCtx(); if (!sfxGain) return;
    playNote(70, 'sawtooth', 0.2, sfxGain, 0.25);
    playNote(50, 'square', 0.15, sfxGain, 0.2, 0.06);
    playNote(90, 'sawtooth', 0.1, sfxGain, 0.12, 0.12);
  },
  sfxHeartbeat() {
    ensureCtx(); if (!sfxGain) return;
    playNote(55, 'sine', 0.12, sfxGain, 0.2);
    playNote(55, 'sine', 0.1, sfxGain, 0.18, 0.18);
  },
};
