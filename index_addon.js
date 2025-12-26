// index_addon.js
// Ryddet versjon: ingen glød, ingen aktiv-logikk, ingen klikkhåndtering.
// Beholder kun en enkel wrapper rundt ikonene for konsistent struktur.

(function () {
  const SELECTORS = {
    play:  ['[data-action="play"]',  '.btn--play',  '#btnPlay'],
    pause: ['[data-action="pause"]', '.btn--pause', '#btnPause'],
    stop:  ['[data-action="stop"]',  '.btn--stop',  '#btnStop'],
  };

  const ICON_CANDIDATES = ['.icon', 'svg', 'i', 'span', '*'];

  // Finn første knapp som matcher en av selektorene
  const qsAny = (selectors) => {
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  };

  // Wrapper så ikonene får en konsistent struktur (.mt-icon / .mt-has-icon)
  function ensureIconWrapper(btn) {
    if (!btn) return null;
    let icon = null;

    for (const ic of ICON_CANDIDATES) {
      const candidate = btn.querySelector(ic);
      if (candidate) {
        icon = candidate.classList.contains('icon')
          ? candidate
          : candidate.closest('.icon') || candidate;
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

    // Fallback: merk knappen selv hvis vi ikke fant et eget ikon-element
    btn.classList.add('mt-has-icon');
    return btn;
  }

  // Finn knapper (hvis de finnes)
  const btnPlay  = qsAny(SELECTORS.play);
  const btnPause = qsAny(SELECTORS.pause);
  const btnStop  = qsAny(SELECTORS.stop);

  // Pakk inn ikonene, men ikke gjør noe mer
  [btnPlay, btnPause, btnStop].forEach(ensureIconWrapper);

  // Eksponer en no-op for kompatibilitet hvis noe annen kode kaller TimerUI.setActive(...)
  function setActive(/* which */) {
    // Bevisst tom – ingen aktiv-logikk lenger
  }

  function init() {
    // Ikke noe mer å gjøre her nå
  }

  // Legg på no-op API
  window.TimerUI = Object.assign(window.TimerUI || {}, { setActive });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
