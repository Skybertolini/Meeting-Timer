// index_addon.js
// Varm "pære"-glød bak ikonene for play/pause/stop
// (Krever ingen endring i index.html)

(function () {
  const SELECTORS = {
    play:  ['[data-action="play"]',  '.btn--play',  '#btnPlay'],
    pause: ['[data-action="pause"]', '.btn--pause', '#btnPause'],
    stop:  ['[data-action="stop"]',  '.btn--stop',  '#btnStop'],
  };
  const ICON_CANDIDATES = ['.icon', 'svg', 'i', 'span', '*'];

  function injectGlowAssetsOnce() {
    if (document.getElementById('mt-lamp-style')) return;
    const style = document.createElement('style');
    style.id = 'mt-lamp-style';
    style.textContent = `
:root {
  --lamp-amber:#FFD66B;
  --lamp-warm:#FFC247;
  --lamp-deep:#FF9E1C;
}
@keyframes mt-lamp-breathe {
  0%,100% { opacity:.95; filter:saturate(1.1); }
  50%     { opacity:.80; filter:saturate(1.0); }
}
.mt-has-icon,
.mt-has-icon .icon {
  position:relative;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
.mt-active .mt-icon svg {
  fill: var(--lamp-amber);
  stroke: var(--lamp-amber);
  filter: url(#mt-bulbGlow);
  animation: mt-lamp-breathe 2.4s ease-in-out infinite;
}
.mt-active .mt-icon::after {
  content:"";
  position:absolute; inset:0;
  margin:auto;
  width:1.6em; height:1.6em; border-radius:50%;
  pointer-events:none;
  background:
    radial-gradient(closest-side at 50% 45%,
      rgba(255,214,107,.90) 0%,
      rgba(255,194,71,.55) 50%,
      rgba(255,158,28,.20) 75%,
      rgba(255,158,28,0) 100%);
  mix-blend-mode:screen;
  filter:blur(1.5px);
  animation: mt-lamp-breathe 2.4s ease-in-out infinite;
}
.mt-active {
  box-shadow:
    inset 0 0 .8rem rgba(255,180,60,.08),
    0 0 .6rem rgba(255,160,40,.18);
  transition: box-shadow .2s ease;
}`;
    document.head.appendChild(style);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('style', 'position:absolute');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `
  <defs>
    <filter id="mt-bulbGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="b1"/>
      <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="b2"/>
      <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="b3"/>
      <feMerge result="g">
        <feMergeNode in="b3"/><feMergeNode in="b2"/><feMergeNode in="b1"/>
      </feMerge>
      <feColorMatrix in="g" type="matrix"
        values="1 0 0 0 1
                0 1 0 0 0.85
                0 0 1 0 0.35
                0 0 0 1 0" result="warm"/>
      <feMerge>
        <feMergeNode in="warm"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>`;
    document.body.appendChild(svg);
  }

  const qsAny = (selectors) => {
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  };

  function ensureIconWrapper(btn) {
    if (!btn) return null;
    let icon = null;
    for (const ic of ICON_CANDIDATES) {
      const candidate = btn.querySelector(ic);
      if (candidate) {
        icon = candidate.classList.contains('icon') ? candidate : candidate.closest('.icon') || candidate;
        break;
      }
    }
    if (icon && !icon.classList.contains('mt-icon')) {
      const wrap = document.createElement('span');
      wrap.className = 'mt-icon';
      icon.parentNode.insertBefore(wrap, icon);
      wrap.appendChild(icon);
      btn.classList.add('mt-has-icon');
      return wrap;
    }
    if (icon) {
      icon.classList.add('mt-icon');
      btn.classList.add('mt-has-icon');
      return icon;
    }
    btn.classList.add('mt-has-icon');
    return btn;
  }

  const btnPlay  = qsAny(SELECTORS.play);
  const btnPause = qsAny(SELECTORS.pause);
  const btnStop  = qsAny(SELECTORS.stop);
  [btnPlay, btnPause, btnStop].forEach(ensureIconWrapper);

  function setActive(which) {
    const all = [btnPlay, btnPause, btnStop].filter(Boolean);
    all.forEach(b => b.classList.remove('mt-active'));
    if (which === 'play'  && btnPlay)  btnPlay.classList.add('mt-active');
    if (which === 'pause' && btnPause) btnPause.classList.add('mt-active');
    if (which === 'stop'  && btnStop)  btnStop.classList.add('mt-active');
  }

  function attachClicks() {
    btnPlay  && btnPlay .addEventListener('click', () => setActive('play'));
    btnPause && btnPause.addEventListener('click', () => setActive('pause'));
    btnStop  && btnStop .addEventListener('click', () => setActive('stop'));
  }

  function init() {
    injectGlowAssetsOnce();
    attachClicks();
  }

  window.TimerUI = Object.assign(window.TimerUI || {}, { setActive });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
