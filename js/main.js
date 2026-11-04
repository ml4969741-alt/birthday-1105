/* =========================================================
   11.05 · 生日快乐
   vanilla JS · no dependencies · works offline
   ========================================================= */
(() => {
  'use strict';

  /* ---------- tiny helpers ---------- */
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
  const clamp = (min, value, max) => Math.min(Math.max(value, min), max);
  const pad = (n) => String(n).padStart(2, '0');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(window.location.search);

  /* ---------- personalisation (?to=名字&from=名字) ---------- */
  const HER_NAME = (params.get('to') || '宝贝').trim().slice(0, 16) || '宝贝';
  const FROM_NAME = (params.get('from') || '我').trim().slice(0, 16) || '我';
  $$('[data-to]').forEach((el) => { el.textContent = HER_NAME; });
  $$('[data-from-name]').forEach((el) => { el.textContent = FROM_NAME; });
  document.title = `11.05 · 生日快乐，${HER_NAME}`;

  /* ---------- elements ---------- */
  const sceneEls = {
    intro: $('#sceneIntro'),
    desktop: $('#sceneDesktop'),
    story: $('#sceneStory'),
    cake: $('#sceneCake'),
    gacha: $('#sceneGacha'),
    finale: $('#sceneFinale')
  };
  const notesLayer = $('#notesLayer');
  const counterText = $('#counterText');
  const counterPill = $('#counterPill');
  const toastEl = $('#toast');
  const heroWindow = $('#heroWindow');
  const wishBtn = $('#wishBtn');
  const storyBtn = $('#storyWishBtn');
  const blowBtn = $('#blowBtn');
  const clockEl = $('#clock');
  const sceneFinale = sceneEls.finale;

  let currentScene = 'intro';
  let zTop = 10;

  /* ---------- scenes ---------- */
  function activate(name) {
    const target = sceneEls[name];
    if (!target) return;
    target.style.zIndex = String(++zTop + 10);
    target.classList.add('is-active');
    Object.entries(sceneEls).forEach(([key, el]) => {
      if (key !== name) el.classList.remove('is-active');
    });
    currentScene = name;
    document.body.dataset.scene = name;
    if (name !== 'intro') Stars.stop();
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(message, ms = 2300) {
    if (!toastEl) return;
    window.clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    toastTimer = window.setTimeout(() => toastEl.classList.remove('is-visible'), ms);
  }

  /* =========================================================
     sound · a tiny music box
     ========================================================= */
  const Sound = (() => {
    let ctx = null;
    let master = null;
    let musicBus = null;
    let delayNode = null;
    let delayFeedback = null;
    let delayWet = null;
    let noiseBuffer = null;
    let started = false;
    let muted = false;
    let loopTimer = null;

    const BEAT = 0.6;
    const FREQ = {
      C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
      C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
      C6: 1046.5, E6: 1318.51, G6: 1567.98
    };

    /* Happy Birthday, in a music-box register */
    const MELODY = [
      ['G4', .5], ['G4', .5], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
      ['G4', .5], ['G4', .5], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
      ['G4', .5], ['G4', .5], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 1],
      ['F5', .5], ['F5', .5], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 2.5]
    ];

    function ensure() {
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return true;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        ctx = new AC();
      } catch (err) {
        return false;
      }
      master = ctx.createGain();
      master.gain.value = .95;
      master.connect(ctx.destination);

      musicBus = ctx.createGain();
      musicBus.gain.value = .13;
      musicBus.connect(master);

      // a little echo, for the music-box shimmer
      delayNode = ctx.createDelay(1.2);
      delayNode.delayTime.value = .29;
      delayFeedback = ctx.createGain();
      delayFeedback.gain.value = .27;
      delayWet = ctx.createGain();
      delayWet.gain.value = .3;
      musicBus.connect(delayNode);
      delayNode.connect(delayFeedback);
      delayFeedback.connect(delayNode);
      delayNode.connect(delayWet);
      delayWet.connect(master);

      return true;
    }

    function bell(freq, when, vel = .55, decay = 1.9) {
      if (!ctx) return;
      const partials = [[1, 1], [2.01, .32], [3.02, .12], [4.16, .05]];
      partials.forEach(([mult, amount]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq * mult;
        const peak = Math.max(.0002, vel * amount);
        gain.gain.setValueAtTime(.0001, when);
        gain.gain.exponentialRampToValueAtTime(peak, when + .01);
        gain.gain.exponentialRampToValueAtTime(.0001, when + decay);
        osc.connect(gain);
        gain.connect(musicBus);
        osc.start(when);
        osc.stop(when + decay + .05);
      });
    }

    function schedule(fromTime) {
      if (!ctx) return;
      window.clearTimeout(loopTimer);
      let time = fromTime != null ? fromTime : ctx.currentTime + .15;
      const start = time;
      MELODY.forEach(([name, beats]) => {
        if (name && FREQ[name]) bell(FREQ[name], time, .55, 1.9);
        time += beats * BEAT;
      });
      const total = time - start;
      loopTimer = window.setTimeout(() => {
        if (started && ctx) schedule(ctx.currentTime + .1);
      }, (total + 2.9) * 1000);
    }

    function applyVolume() {
      if (!ctx) return;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(muted ? 0 : .95, now, .06);
    }

    function start() {
      if (!ensure()) return false;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (started) return true;
      started = true;
      muted = false;
      applyVolume();
      schedule(ctx.currentTime + .25);
      return true;
    }

    function toggle() {
      if (!ctx) return false;
      muted = !muted;
      applyVolume();
      return true;
    }

    function restart() {
      if (!ensure()) return false;
      started = true;
      muted = false;
      applyVolume();
      schedule(ctx.currentTime + .2);
      return true;
    }

    function tone(freq, duration = .3, volume = .06, type = 'sine', offset = 0) {
      if (!ctx || muted) return;
      const t = ctx.currentTime + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + duration + .04);
    }

    function pop() {
      if (!ctx) return;
      tone(540, .18, .05, 'sine');
      tone(810, .16, .022, 'sine', .025);
    }

    function sparkle() {
      if (!ctx || muted) return;
      [1318.5, 1567.98, 2093].forEach((freq, i) => tone(freq, .4, .022, 'sine', i * .055));
    }

    function coin() {
      if (!ctx || muted) return;
      tone(1320, .18, .035, 'sine');
      tone(1980, .22, .022, 'sine', .045);
    }

    function crank() {
      if (!ctx || muted) return;
      for (let i = 0; i < 9; i += 1) {
        tone(280 - i * 12, .04, .012, 'triangle', i * .06);
      }
      tone(170, .2, .03, 'sine', .56);
    }

    function capsule() {
      if (!ctx || muted) return;
      tone(196, .14, .05, 'triangle');
      tone(720, .35, .025, 'sine', .05);
    }

    function puff() {
      if (!ctx || muted) return;
      if (!noiseBuffer) {
        noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .8), ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      }
      const t = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, t);
      filter.frequency.exponentialRampToValueAtTime(320, t + .5);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(.0001, t);
      gain.gain.exponentialRampToValueAtTime(.16, t + .035);
      gain.gain.exponentialRampToValueAtTime(.0001, t + .55);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(t);
      source.stop(t + .6);
    }

    function chord() {
      if (!ctx || muted) return;
      [261.63, 329.63, 392.0, 523.25, 659.25].forEach((freq, i) => {
        bell(freq, ctx.currentTime + .06 + i * .075, .5, 3.4);
      });
    }

    return {
      start, restart, toggle, pop, sparkle, puff, chord, coin, crank, capsule,
      isStarted: () => started,
      isMuted: () => muted
    };
  })();

  function syncMusicUI() {
    const playing = Sound.isStarted() && !Sound.isMuted();
    $$('[data-music]').forEach((btn) => {
      btn.classList.toggle('is-muted', !playing);
      btn.setAttribute('aria-pressed', String(playing));
      btn.setAttribute('aria-label', playing ? '关闭音乐' : '打开音乐');
    });
  }

  $$('[data-music]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!Sound.isStarted()) {
        if (!Sound.start()) {
          toast('音乐暂时打不开，但祝福已经送到啦');
          return;
        }
      } else {
        Sound.toggle();
      }
      syncMusicUI();
      if (Sound.isStarted()) Sound.pop();
    });
  });

  /* =========================================================
     intro · star field
     ========================================================= */
  const Stars = (() => {
    const canvas = $('#starCanvas');
    if (!canvas) return { start() {}, stop() {}, resize() {} };
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let dpr = 1;
    let stars = [];
    let raf = null;
    let running = false;
    let last = 0;
    let shooting = null;
    let nextShoot = 5;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeStars();
      if (!running) drawStatic();
    }

    function makeStars() {
      const count = Math.min(150, Math.floor((w * h) / 11000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.25 + .25,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * .55 + .18,
        alpha: Math.random() * .55 + .2
      }));
    }

    function drawStatic() {
      ctx.clearRect(0, 0, w, h);
      stars.forEach((star) => {
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 244, 228, ${star.alpha})`;
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function draw(now) {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, .05);
      last = now;
      const time = now / 1000;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < stars.length; i += 1) {
        const star = stars[i];
        const alpha = star.alpha * (.55 + .45 * Math.sin(time * star.speed + star.phase));
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 244, 228, ${alpha})`;
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
        if (star.r > 1.08) {
          ctx.beginPath();
          ctx.fillStyle = `rgba(255, 230, 210, ${alpha * .1})`;
          ctx.arc(star.x, star.y, star.r * 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      nextShoot -= dt;
      if (!shooting && nextShoot <= 0) {
        shooting = {
          x: w * (.15 + Math.random() * .5),
          y: h * (.08 + Math.random() * .3),
          vx: 250 + Math.random() * 180,
          vy: 110 + Math.random() * 90,
          life: 1
        };
        nextShoot = 8 + Math.random() * 8;
      }
      if (shooting) {
        shooting.life -= dt * .55;
        shooting.x += shooting.vx * dt;
        shooting.y += shooting.vy * dt;
        if (shooting.life <= 0) {
          shooting = null;
        } else {
          const tailX = shooting.x - shooting.vx * .2;
          const tailY = shooting.y - shooting.vy * .2;
          const gradient = ctx.createLinearGradient(shooting.x, shooting.y, tailX, tailY);
          gradient.addColorStop(0, `rgba(255, 245, 225, ${shooting.life * .8})`);
          gradient.addColorStop(1, 'rgba(255, 245, 225, 0)');
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(shooting.x, shooting.y);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();
          ctx.beginPath();
          ctx.fillStyle = `rgba(255, 250, 238, ${shooting.life})`;
          ctx.arc(shooting.x, shooting.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      raf = window.requestAnimationFrame(draw);
    }

    function start() {
      if (running) return;
      resize();
      if (reducedMotion) return;
      running = true;
      last = performance.now();
      raf = window.requestAnimationFrame(draw);
    }

    function stop() {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = null;
    }

    window.addEventListener('resize', () => {
      if (sceneEls.intro.classList.contains('is-active')) resize();
    });

    return { start, stop, resize };
  })();

  /* =========================================================
     notes
     ========================================================= */
  const NOTES = [
    { e: '🌷', t: '今天要开心哦', c: 'blush' },
    { e: '🧣', t: '天冷了，多穿一点', c: 'butter' },
    { e: '🌙', t: '别熬夜啦', c: 'lilac' },
    { e: '☁️', t: '累了就歇一会儿', c: 'sky' },
    { e: '🍚', t: '好好吃饭', c: 'mint' },
    { e: '🌸', t: '你笑起来最好看', c: 'peach' },
    { e: '☀️', t: '天天都要元气满满', c: 'butter' },
    { e: '🍰', t: '想吃蛋糕就多吃一块', c: 'blush' },
    { e: '✨', t: '许的愿望都会实现', c: 'lilac' },
    { e: '💌', t: '有人一直在想你', c: 'cream' },
    { e: '🧸', t: '今天也要被偏爱', c: 'mint' },
    { e: '🎂', t: '11.05 生日快乐', c: 'peach' }
  ];

  const LAYOUTS = {
    wide: [
      [.08, .17], [.24, .10], [.76, .105], [.92, .18],
      [.04, .45], [.145, .615], [.055, .82],
      [.875, .45], [.83, .615], [.895, .82],
      [.225, .86], [.60, .87]
    ],
    mid: [
      [.015, .18], [.90, .16],
      [.015, .42], [.90, .40],
      [.02, .66], [.89, .64],
      [.05, .84], [.85, .83]
    ],
    mobile: [
      [.14, .16], [.50, .145], [.86, .16],
      [.14, .84], [.50, .855], [.86, .84]
    ]
  };

  const noteState = {
    layout: '',
    visible: [],
    queue: [],
    closed: 0,
    z: 12,
    ready: false
  };

  const ICON_MIN = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 5h6"/></svg>';
  const ICON_MAX = '<svg viewBox="0 0 10 10" aria-hidden="true"><rect x="2" y="2" width="6" height="6" rx=".8"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2 2 8"/></svg>';

  function layoutMode() {
    if (window.innerWidth >= 1180) return 'wide';
    if (window.innerWidth >= 900) return 'mid';
    return 'mobile';
  }

  function createNoteElement(note, index) {
    const el = document.createElement('div');
    el.className = `note note--${note.c}`;
    el.style.setProperty('--rot', `${(Math.random() * 3.4 - 1.7).toFixed(2)}deg`);
    el.dataset.note = String(index);
    el.innerHTML = `
      <div class="note-titlebar">
        <span class="note-app"><span class="note-icon" aria-hidden="true">${note.e}</span>温馨提示</span>
        <span class="note-controls">
          <button class="note-btn note-min" type="button" aria-label="收起这条悄悄话">${ICON_MIN}</button>
          <button class="note-btn note-max" type="button" aria-label="放大这条悄悄话">${ICON_MAX}</button>
          <button class="note-btn note-close" type="button" aria-label="关闭这条悄悄话">${ICON_CLOSE}</button>
        </span>
      </div>
      <div class="note-body">${note.t}</div>`;
    return el;
  }

  function positionNote(entry) {
    const anchors = LAYOUTS[noteState.layout];
    const anchor = anchors[entry.anchorIndex % anchors.length];
    const w = entry.el.offsetWidth || 180;
    const h = entry.el.offsetHeight || 78;
    const x = clamp(10, anchor[0] * window.innerWidth - w / 2, window.innerWidth - w - 10);
    const y = clamp(62, anchor[1] * window.innerHeight - h / 2, window.innerHeight - h - 62);
    entry.el.style.left = `${x + w / 2}px`;
    entry.el.style.top = `${y + h / 2}px`;
  }

  function bringNoteFront(entry) {
    noteState.z += 1;
    entry.el.style.zIndex = String(noteState.z);
  }

  function makeDraggable(entry) {
    const el = entry.el;
    let drag = null;

    el.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target.closest('button')) return;
      const rect = el.getBoundingClientRect();
      drag = {
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top,
        w: rect.width,
        h: rect.height
      };
      entry.dragged = true;
      el.classList.add('is-dragging');
      bringNoteFront(entry);
      try { el.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
    });

    el.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const x = clamp(8, event.clientX - drag.dx, window.innerWidth - drag.w - 8);
      const y = clamp(8, event.clientY - drag.dy, window.innerHeight - drag.h - 8);
      el.style.left = `${x + drag.w / 2}px`;
      el.style.top = `${y + drag.h / 2}px`;
    });

    const endDrag = (event) => {
      if (!drag) return;
      drag = null;
      el.classList.remove('is-dragging');
      try {
        if (el.hasPointerCapture && el.hasPointerCapture(event.pointerId)) {
          el.releasePointerCapture(event.pointerId);
        }
      } catch (err) { /* ignore */ }
    };
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('lostpointercapture', () => {
      drag = null;
      el.classList.remove('is-dragging');
    });
  }

  function spawnSparks(x, y) {
    const colors = ['#f4b8c6', '#f7dfb0', '#c9b5f2', '#a9d8c4', '#fff5e2'];
    for (let i = 0; i < 8; i += 1) {
      const spark = document.createElement('i');
      spark.className = 'spark';
      const angle = Math.random() * Math.PI * 2;
      const dist = 26 + Math.random() * 38;
      spark.style.left = `${x}px`;
      spark.style.top = `${y}px`;
      spark.style.width = `${3 + Math.random() * 4}px`;
      spark.style.height = spark.style.width;
      spark.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
      spark.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
      spark.style.setProperty('--c', colors[i % colors.length]);
      document.body.appendChild(spark);
      window.setTimeout(() => spark.remove(), 760);
    }
  }

  function updateCounter(animate) {
    const total = NOTES.length;
    if (noteState.closed >= total) {
      counterText.textContent = `${total} 句悄悄话，都收好啦 ♡`;
      counterPill.classList.add('is-complete');
    } else {
      counterText.textContent = `已收下 ${noteState.closed} / ${total} 句悄悄话`;
      counterPill.classList.remove('is-complete');
    }
    if (animate) {
      counterPill.classList.remove('is-pulse');
      void counterPill.offsetWidth;
      counterPill.classList.add('is-pulse');
    }
  }

  function closeNote(entry) {
    if (entry.closing) return;
    entry.closing = true;
    const rect = entry.el.getBoundingClientRect();
    spawnSparks(rect.left + rect.width / 2, rect.top + rect.height / 2);
    Sound.sparkle();
    entry.el.classList.add('is-closing');
    noteState.visible = noteState.visible.filter((item) => item !== entry);
    noteState.closed = Math.min(NOTES.length, noteState.closed + 1);
    updateCounter(true);
    window.setTimeout(() => entry.el.remove(), 380);

    if (noteState.queue.length > 0) {
      const nextIndex = noteState.queue.shift();
      window.setTimeout(() => {
        if (currentScene === 'desktop') {
          spawnNote(nextIndex, entry.anchorIndex, 40);
        }
      }, 470);
    }
  }

  function spawnNote(noteIndex, anchorIndex, delay = 0) {
    const el = createNoteElement(NOTES[noteIndex], noteIndex);
    const entry = {
      el,
      noteIndex,
      anchorIndex,
      dragged: false,
      closing: false
    };
    el.style.animationDelay = `${delay}ms`;
    notesLayer.appendChild(el);
    noteState.visible.push(entry);
    noteState.z += 1;
    el.style.zIndex = String(noteState.z);
    positionNote(entry);
    makeDraggable(entry);
    el.querySelector('.note-close').addEventListener('click', (event) => {
      event.stopPropagation();
      closeNote(entry);
    });
    el.querySelector('.note-min').addEventListener('click', (event) => {
      event.stopPropagation();
      entry.el.classList.toggle('is-minimized');
      entry.el.classList.remove('is-expanded');
      bringNoteFront(entry);
      entry.dragged = false;
      requestAnimationFrame(() => positionNote(entry));
      Sound.pop();
    });
    el.querySelector('.note-max').addEventListener('click', (event) => {
      event.stopPropagation();
      entry.el.classList.toggle('is-expanded');
      entry.el.classList.remove('is-minimized');
      bringNoteFront(entry);
      entry.dragged = false;
      requestAnimationFrame(() => positionNote(entry));
      Sound.pop();
    });
  }

  function initNotes(fast = false) {
    if (noteState.ready) return;
    noteState.ready = true;
    noteState.layout = layoutMode();
    noteState.visible = [];
    noteState.queue = [];
    noteState.closed = 0;
    const anchors = LAYOUTS[noteState.layout];
    const initial = Math.min(NOTES.length, anchors.length);
    const baseDelay = fast ? 120 : (reducedMotion ? 0 : 700);
    const step = fast ? 90 : (reducedMotion ? 40 : 215);
    for (let i = 0; i < initial; i += 1) {
      spawnNote(i, i, baseDelay + i * step);
    }
    for (let i = initial; i < NOTES.length; i += 1) {
      noteState.queue.push(i);
    }
    updateCounter(false);
  }

  function reflowNotes() {
    if (!noteState.ready) return;
    const nextMode = layoutMode();
    if (nextMode !== noteState.layout) {
      noteState.layout = nextMode;
      noteState.visible.forEach((entry) => { entry.dragged = false; });
    }
    noteState.visible.forEach((entry) => {
      if (!entry.dragged) positionNote(entry);
      else {
        const rect = entry.el.getBoundingClientRect();
        const x = clamp(8, rect.left, window.innerWidth - rect.width - 8);
        const y = clamp(8, rect.top, window.innerHeight - rect.height - 8);
        entry.el.style.left = `${x + rect.width / 2}px`;
        entry.el.style.top = `${y + rect.height / 2}px`;
      }
    });
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      reflowNotes();
      FX.resize();
    }, 120);
  });

  /* hero window close · playful */
  $('#heroClose').addEventListener('click', () => {
    heroWindow.classList.remove('is-wiggling');
    void heroWindow.offsetWidth;
    heroWindow.classList.add('is-wiggling');
    toast('这扇窗，今天不许关哦 ♡');
    Sound.pop();
  });

  /* =========================================================
     cake
     ========================================================= */
  const candles = $$('.candle');
  let blownCount = 0;
  let wishFinished = false;

  function setBlowLabel(text) {
    const span = blowBtn.querySelector('span');
    if (span) span.textContent = text;
  }

  function finishWish() {
    if (wishFinished) return;
    wishFinished = true;
    blowBtn.disabled = true;
    setBlowLabel('愿望已送达 ♡');
    $('#cakeStage').classList.add('is-wished');
    window.setTimeout(() => {
      activate('gacha');
      Sound.sparkle();
    }, 850);
  }

  function blowCandle(candle) {
    if (!candle || candle.classList.contains('is-out')) return;
    candle.classList.add('is-out');
    blownCount += 1;
    Sound.puff();
    if (blownCount >= candles.length) {
      window.setTimeout(finishWish, 780);
    }
  }

  candles.forEach((candle) => {
    candle.addEventListener('click', () => blowCandle(candle));
    candle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        blowCandle(candle);
      }
    });
  });

  blowBtn.addEventListener('click', () => {
    if (blowBtn.disabled || wishFinished) return;
    blowBtn.disabled = true;
    Sound.puff();
    const remaining = candles.filter((candle) => !candle.classList.contains('is-out'));
    setBlowLabel('呼——');
    remaining.forEach((candle, index) => {
      window.setTimeout(() => blowCandle(candle), 180 + index * 300);
    });
    window.setTimeout(() => {
      if (!wishFinished) setBlowLabel('愿望正在送达…');
    }, 300);
  });

  wishBtn.addEventListener('click', () => {
    if (wishBtn.disabled) return;
    wishBtn.disabled = true;
    Sound.pop();
    window.setTimeout(() => {
      activate('story');
      wishBtn.disabled = false;
    }, 240);
  });

  storyBtn.addEventListener('click', () => {
    if (storyBtn.disabled) return;
    storyBtn.disabled = true;
    Sound.pop();
    window.setTimeout(() => {
      activate('cake');
      storyBtn.disabled = false;
    }, 240);
  });

  /* =========================================================
     gacha · three little gifts
     ========================================================= */
  const GIFTS = [
    { text: '撒娇喊老婆', emoji: '🥺', cap: ['#f7a1b8', '#ffd36a'] },
    { text: '一个爱的亲亲', emoji: '💋', cap: ['#ff8f9f', '#ffc7d1'] },
    { text: '一个爱的抱抱', emoji: '🤗', cap: ['#f6b36a', '#ffe3a8'] },
    { text: '一个大蛋糕', emoji: '🍰', cap: ['#ff9f8a', '#ffd36a'] },
    { text: '帮你吹一次头发', emoji: '💇', cap: ['#9bb7f4', '#d7e6ff'] },
    { text: '认真听你吐槽不顶嘴', emoji: '👂', cap: ['#b9a3ee', '#e6dcff'] },
    { text: '满足一个小心愿', emoji: '🌟', cap: ['#ffd36a', '#fff0b5'] },
    { text: '命令我背你一小段路', emoji: '🐷', cap: ['#f5a6c8', '#ffd9e8'] },
    { text: '帮你按摩肩颈十分钟', emoji: '💆', cap: ['#8fd2b3', '#d5f1e3'] }
  ];

  const gachaState = { remaining: [], drawn: [], spinning: false, initialized: false };
  const gachaStage = $('#gachaStage');
  const gachaBtn = $('#gachaBtn');
  const gachaBtnText = $('#gachaBtnText');
  const gachaLeft = $('#gachaLeft');
  const gachaLatest = $('#gachaLatest');
  const gachaCoins = $$('.gacha-coins i');
  const gachaTickets = $$('.gacha-ticket');
  const gachaNextBtn = $('#gachaNextBtn');
  const gachaSkipBtn = $('#gachaSkipBtn');
  const gachaCapsule = $('#gachaCapsule');

  function initGacha() {
    gachaState.remaining = GIFTS.map((_, index) => index);
    gachaState.drawn = [];
    gachaState.spinning = false;
    gachaState.initialized = true;
    gachaStage.classList.remove('is-spinning', 'is-dispensing', 'has-capsule');
    gachaBtn.disabled = false;
    gachaBtnText.textContent = '投一枚硬币';
    gachaLatest.textContent = '投一枚硬币，看看今天的手气';
    gachaLatest.classList.remove('is-pop');
    gachaNextBtn.hidden = true;
    gachaSkipBtn.hidden = false;
    gachaTickets.forEach((ticket) => {
      ticket.classList.remove('is-filled', 'is-new');
      ticket.querySelector('.ticket-emoji').textContent = '✦';
      ticket.querySelector('.ticket-text').textContent = '等待一枚硬币';
      ticket.querySelector('.ticket-stamp').textContent = '待扭出';
    });
    updateGachaUI();
  }

  function updateGachaUI() {
    const used = gachaState.drawn.length;
    const left = Math.max(0, 3 - used);
    gachaLeft.textContent = String(left);
    gachaCoins.forEach((coin, index) => {
      coin.classList.toggle('is-used', index < used);
    });
    if (used >= 3) {
      gachaBtn.disabled = true;
      if (!gachaState.spinning) gachaBtnText.textContent = '三次礼物都收好啦';
      gachaNextBtn.hidden = false;
      gachaSkipBtn.hidden = true;
    } else if (!gachaState.spinning) {
      gachaBtn.disabled = false;
      gachaBtnText.textContent = used > 0 ? '再投一枚' : '投一枚硬币';
      gachaNextBtn.hidden = true;
      gachaSkipBtn.hidden = false;
    }
  }

  function drawGacha() {
    if (gachaState.spinning || gachaState.drawn.length >= 3) return;
    if (!gachaState.initialized) initGacha();
    const slot = gachaState.drawn.length;
    const pick = Math.floor(Math.random() * gachaState.remaining.length);
    const gift = GIFTS[gachaState.remaining.splice(pick, 1)[0]];
    gachaState.drawn.push(gift);
    gachaState.spinning = true;

    gachaStage.classList.remove('has-capsule');
    gachaStage.classList.add('is-spinning');
    gachaCapsule.style.setProperty('--cap-a', gift.cap[0]);
    gachaCapsule.style.setProperty('--cap-b', gift.cap[1]);
    gachaBtn.disabled = true;
    gachaBtnText.textContent = '扭动中…';
    Sound.coin();
    window.setTimeout(() => Sound.crank(), 120);

    window.setTimeout(() => {
      gachaStage.classList.remove('is-spinning');
      gachaStage.classList.add('is-dispensing');
      Sound.capsule();
      const ticket = gachaTickets[slot];
      ticket.querySelector('.ticket-emoji').textContent = gift.emoji;
      ticket.querySelector('.ticket-text').textContent = gift.text;
      ticket.querySelector('.ticket-stamp').textContent = '已收下';
      ticket.classList.add('is-filled');
      ticket.classList.remove('is-new');
      void ticket.offsetWidth;
      ticket.classList.add('is-new');
      gachaLatest.textContent = `扭到：${gift.text}`;
      gachaLatest.classList.remove('is-pop');
      void gachaLatest.offsetWidth;
      gachaLatest.classList.add('is-pop');
    }, 950);

    window.setTimeout(() => {
      gachaStage.classList.remove('is-dispensing');
      gachaStage.classList.add('has-capsule');
      gachaState.spinning = false;
      Sound.sparkle();
      updateGachaUI();
    }, 1550);
  }

  function startFinale() {
    if (currentScene === 'finale') return;
    activate('finale');
    FX.start();
    Sound.chord();
    window.setTimeout(() => sceneFinale.classList.add('is-revealed'), 60);
  }

  gachaBtn.addEventListener('click', drawGacha);
  gachaNextBtn.addEventListener('click', () => {
    if (gachaState.drawn.length < 3) return;
    Sound.pop();
    startFinale();
  });
  gachaSkipBtn.addEventListener('click', () => {
    Sound.pop();
    startFinale();
  });
  initGacha();

  /* =========================================================
     finale · confetti & fireworks
     ========================================================= */
  const FX = (() => {
    const canvas = $('#fxCanvas');
    if (!canvas) return { start() {}, resize() {} };
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let dpr = 1;
    let particles = [];
    let raf = null;
    let running = false;
    let last = 0;
    let spawnUntil = 0;
    let nextFirework = 0;
    const colors = ['#e58ca0', '#f3c98b', '#fff3dc', '#b9a7e8', '#9fd6c1', '#f39c8e', '#f6dcae'];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function addConfetti(count) {
      for (let i = 0; i < count; i += 1) {
        particles.push({
          type: 'confetti',
          x: Math.random() * w,
          y: -20 - Math.random() * h * .25,
          vx: (Math.random() - .5) * 70,
          vy: 70 + Math.random() * 130,
          w: 4 + Math.random() * 5,
          h: 6 + Math.random() * 7,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - .5) * 5,
          sway: Math.random() * Math.PI * 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 0,
          maxLife: 7 + Math.random() * 4
        });
      }
    }

    function addCannon(x, y, baseAngle) {
      for (let i = 0; i < 26; i += 1) {
        const angle = baseAngle + (Math.random() - .5) * .5;
        const speed = 280 + Math.random() * 430;
        particles.push({
          type: 'confetti',
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          w: 4 + Math.random() * 5,
          h: 6 + Math.random() * 7,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - .5) * 7,
          sway: Math.random() * Math.PI * 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 0,
          maxLife: 4.5 + Math.random() * 3
        });
      }
    }

    function addFirework(x, y) {
      const hueColor = colors[Math.floor(Math.random() * colors.length)];
      const count = 34 + Math.floor(Math.random() * 14);
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * .08;
        const speed = 45 + Math.random() * 165;
        particles.push({
          type: 'spark',
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 1 + Math.random() * 1.9,
          color: Math.random() > .32 ? hueColor : '#fff4dc',
          life: 0,
          maxLife: .8 + Math.random() * .9
        });
      }
    }

    function drawConfetti(p) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, (p.maxLife - p.life) * 1.2));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.4 + Math.abs(Math.sin(p.sway)) * .6));
      ctx.restore();
    }

    function loop(now) {
      const dt = Math.min((now - last) / 1000, .04);
      last = now;
      ctx.clearRect(0, 0, w, h);

      if (now < spawnUntil && now > nextFirework) {
        addFirework(w * (.18 + Math.random() * .64), h * (.12 + Math.random() * .34));
        nextFirework = now + 620 + Math.random() * 720;
      }
      if (now < spawnUntil && Math.random() < dt * .7) addConfetti(3);

      ctx.globalCompositeOperation = 'lighter';
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life += dt;
        if (p.type === 'confetti') {
          p.vy += 175 * dt;
          p.vx *= .996;
          p.x += (p.vx + Math.sin(p.sway + p.life * 3) * 18) * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          if (p.life > p.maxLife || p.y > h + 50) {
            particles.splice(i, 1);
            continue;
          }
          ctx.globalCompositeOperation = 'source-over';
          drawConfetti(p);
          ctx.globalCompositeOperation = 'lighter';
        } else {
          p.vy += 45 * dt;
          p.vx *= .985;
          p.vy *= .985;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const alpha = Math.max(0, 1 - p.life / p.maxLife);
          if (alpha <= 0) {
            particles.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.4 + alpha), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      if (particles.length > 0 || now < spawnUntil) {
        raf = window.requestAnimationFrame(loop);
      } else {
        running = false;
        raf = null;
        ctx.clearRect(0, 0, w, h);
      }
    }

    function start() {
      if (reducedMotion) return;
      resize();
      if (running) {
        spawnUntil = Math.max(spawnUntil, performance.now() + 5000);
        addConfetti(70);
        return;
      }
      particles = [];
      running = true;
      last = performance.now();
      spawnUntil = last + 6000;
      nextFirework = last + 350;
      addConfetti(100);
      addCannon(0, h * .78, -1);
      addCannon(w, h * .78, -Math.PI + 1);
      raf = window.requestAnimationFrame(loop);
    }

    return { start, resize };
  })();

  /* =========================================================
     clock & entry
     ========================================================= */
  let clockStarted = false;
  function updateClock() {
    if (!clockEl) return;
    const now = new Date();
    clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  function startClock() {
    if (clockStarted) return;
    clockStarted = true;
    updateClock();
    window.setInterval(updateClock, 15000);
  }

  const enterBtn = $('#enterBtn');
  let entered = false;

  function enterExperience() {
    if (entered) return;
    entered = true;
    activate('desktop');
    startClock();
    const musicOk = Sound.start();
    syncMusicUI();
    initNotes(false);
    if (!musicOk) toast('音乐暂时打不开，但祝福已经送到啦', 3000);
  }

  enterBtn.addEventListener('click', enterExperience);

  /* music replay + restart */
  $('#replayMusic').addEventListener('click', () => {
    if (!Sound.restart()) {
      toast('这个浏览器好像不太会唱歌');
      return;
    }
    syncMusicUI();
    toast('音乐从头开始啦 ♪');
  });

  $('#replayAll').addEventListener('click', () => {
    window.location.reload();
  });

  /* =========================================================
     preview helpers (?preview=desktop|cake|finale)
     ========================================================= */
  const preview = params.get('preview');
  if (preview === 'desktop') {
    activate('desktop');
    startClock();
    initNotes(true);
  } else if (preview === 'story') {
    activate('story');
  } else if (preview === 'gacha') {
    activate('gacha');
  } else if (preview === 'cake') {
    activate('cake');
  } else if (preview === 'finale') {
    activate('finale');
    FX.start();
    window.setTimeout(() => sceneFinale.classList.add('is-revealed'), 80);
  } else {
    Stars.start();
  }

  // keep UI in sync on load
  syncMusicUI();
})();


