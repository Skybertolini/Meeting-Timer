/*! index_article_window_1.0.js
    Populates the article <select> with:
      - This week's article
      - Previous week's article
      - Next 4 weeks
    (Up to 6 items total, depending on availability)
    Data sources (in priority order):
      1) window.__VT_ITEMS (array of {week_start:'YYYY-MM-DD', title:'...'})
      2) window.getItems() -> same shape
      3) Optional fetch from <select data-src="./data/no-2025.json">
    Select detection (first match wins):
      #articleSelect, #article, [data-role="article-select"], select.articles
*/
(function(){
  'use strict';

  function $(sel, root){ return (root||document).querySelector(sel); }
  function $all(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }
  function whenReady(cb){
    if (document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', cb); }
    else cb();
  }

  const SELS = ['#articleSelect', '#article', '[data-role="article-select"]', 'select.articles'];

  function findSelect(){
    for (const s of SELS){
    const el = $(s);
      if (el && el.tagName && el.tagName.toLowerCase()==='select') return el;
    }
    return null;
  }

  function parseISODate(s){
    // expects YYYY-MM-DD
    const [y,m,d] = (s||'').split('-').map(Number);
    if (!y||!m||!d) return null;
    return new Date(Date.UTC(y, m-1, d));
  }

  function fmtDate(d){
    // YYYY-MM-DD in UTC
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth()+1).padStart(2,'0');
    const day = String(d.getUTCDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function mondayOfToday(){
    const now = new Date();
    // Normalize to UTC date for week_start comparison
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    // JS: 0=Sunday..6=Saturday. We want Monday as first day (1).
    const dow = (d.getUTCDay()+6)%7; // Mon=0, Tue=1, ... Sun=6
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - dow);
    monday.setUTCHours(0,0,0,0);
    return monday;
  }

  function normalizeItems(raw){
    const arr = (raw||[]).map(it => {
      const ds = parseISODate(it.week_start);
      return ds ? { week_start: fmtDate(ds), ts: ds.getTime(), title: String(it.title||'Uten tittel') } : null;
    }).filter(Boolean);
    arr.sort((a,b)=> a.ts - b.ts);
    return arr;
  }

  function pickWindow(items){
    if (!items.length) return [];

    const mon = mondayOfToday().getTime();
    // Find index of exact current Monday; if not found, choose greatest week_start <= today Monday
    let idx = items.findIndex(x => x.ts === mon);
    if (idx === -1){
      let best = -1, bestTs = -Infinity;
      for (let i=0;i<items.length;i++){
        if (items[i].ts <= mon && items[i].ts > bestTs){ bestTs = items[i].ts; best = i; }
      }
      if (best !== -1) idx = best;
      else idx = 0; // fallback: earliest
    }

    const picked = [];
    // previous week (if any)
    if (idx-1 >= 0) picked.push(items[idx-1]);
    // current
    picked.push(items[idx]);
    // next up to 4
    for (let k=1; k<=4; k++){
      const j = idx + k;
      if (j < items.length) picked.push(items[j]);
    }

    // Ensure uniqueness and keep order as assembled
    const seen = new Set();
    return picked.filter(it => {
      if (seen.has(it.ts)) return false;
      seen.add(it.ts);
      return true;
    });
  }

  function renderOptions(sel, items, currentTs){
    // Keep a placeholder if present
    const placeholder = Array.from(sel.options).find(o => !o.value);
    sel.innerHTML = '';
    if (placeholder){
      sel.appendChild(placeholder);
    }

    items.forEach(it => {
      const opt = document.createElement('option');
      opt.value = it.week_start;
      opt.textContent = it.title;
      if (it.ts === currentTs) opt.selected = true;
      sel.appendChild(opt);
    });

    // Trigger change for host app if it listens
    const ev = new Event('change', {bubbles:true});
    sel.dispatchEvent(ev);
  }

  async function getItemsFromAnywhere(sel){
    if (Array.isArray(window.__VT_ITEMS) && window.__VT_ITEMS.length){
      return normalizeItems(window.__VT_ITEMS);
    }
    if (typeof window.getItems === 'function'){
      try{
        const raw = window.getItems() || [];
        const norm = normalizeItems(raw);
        if (norm.length) return norm;
      }catch(_){}
    }
    // Fallback: fetch from data-src on the select
    const src = sel && sel.getAttribute('data-src');
    if (src){
      try{
        const r = await fetch(src, {cache:'no-store'});
        if (!r.ok) throw new Error('HTTP '+r.status);
        const j = await r.json();
        if (j && Array.isArray(j.items)) return normalizeItems(j.items);
        if (Array.isArray(j)) return normalizeItems(j);
      }catch(_){}
    }
    return [];
  }

  async function init(){
    const sel = findSelect();
    if (!sel) return;

    const items = await getItemsFromAnywhere(sel);
    if (!items.length) return;

    const mon = mondayOfToday();
    const windowItems = pickWindow(items);
    renderOptions(sel, windowItems, mon.getTime());
  }

  whenReady(init);
  // Optional manual refresh for host app after it loads items asynchronously
  window.__vtRefreshArticleWindow = init;
})();