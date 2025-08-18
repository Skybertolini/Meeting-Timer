// i18n/i18n.js
(function(){
  const I18N_PATH = 'i18n';           // Mappe der språkfilene ligger
  const DEFAULT_LANG = 'no';          // Norsk standard
  let current = DEFAULT_LANG;
  let dict = {};

  function getSelect(){ return document.getElementById('langSelect'); }

  function detectLang(){
    const ls = localStorage.getItem('studyTimer.lang');
    if (ls) return ls;
    const sel = getSelect();
    return (sel && sel.value) ? sel.value : DEFAULT_LANG;
  }

  async function load(lang){
    const url = `${I18N_PATH}/${lang}.json`;
    console.log('[i18n] Laster', url);
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`Kunne ikke laste ${url} (status ${res.status})`);
    }
    dict = await res.json();
    current = lang;
    localStorage.setItem('studyTimer.lang', current);
    console.log('[i18n] OK:', lang);
  }

  function t(key){
    return (dict && Object.prototype.hasOwnProperty.call(dict, key)) ? dict[key] : key;
  }

  function apply(){
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (val) el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
      const key = el.getAttribute('data-i18n-placeholder');
      const val = t(key);
      if (val) el.setAttribute('placeholder', val);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el=>{
      const key = el.getAttribute('data-i18n-title');
      const val = t(key);
      if (val) el.setAttribute('title', val);
    });
  }

  async function init(){
    try {
      const sel = getSelect();
      const want = detectLang();
      if (sel) sel.value = want;
      await load(want);
      apply();

      if (sel){
        sel.addEventListener('change', async (e)=>{
          const lang = e.target.value || DEFAULT_LANG;
          try {
            await load(lang);
            apply();
          } catch (err) {
            console.error('[i18n] Bytte språk feilet:', err);
            alert('Kunne ikke laste språkfilen (' + lang + ').');
          }
        });
      }
    } catch (e) {
      console.error('[i18n] Init feilet, prøver fallback:', e);
      // fallback til default
      try {
        await load(DEFAULT_LANG);
        apply();
        const sel = getSelect();
        if (sel) sel.value = DEFAULT_LANG;
      } catch (e2) {
        console.error('[i18n] Fallback feilet:', e2);
      }
    }
  }

  window.i18n = { init, t };

  document.addEventListener('DOMContentLoaded', init);
})();