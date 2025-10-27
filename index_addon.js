/*! index_addon_1.38.js — ONLY grouped message text (no left text), group-aware colors, ordered pin stacking */
(function(){
  'use strict';

  function $(sel, root){ return (root||document).querySelector(sel); }
  function $all(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }
  function raf(fn){ return requestAnimationFrame(fn); }
  function containsX(r, x){ return x >= r.left && x <= r.right; }

  function cssVarOr(name, fallback){
    const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return val || fallback;
  }
  const GREEN_LIGHT = cssVarOr('--tl-green-1', cssVarOr('--green-2', '#e8f5ec'));
  const GREEN_MED   = cssVarOr('--tl-green-2', cssVarOr('--green',   '#bfe6cd'));

  let scheduled = false;
  function coalesced(fn){
    if (scheduled) return;
    scheduled = true;
    raf(()=>{ scheduled=false; try{ fn(); }catch(_){ } });
  }

  function getCursorX(){
    const ph = $('#playhead') || $('.playhead') || $('#elapsed') || $('.elapsed');
    if (ph){
      const r = ph.getBoundingClientRect();
      return r.right - 1;
    }
    const tl = $('#timeline'); if (!tl) return null;
    const tr = tl.getBoundingClientRect();
    return tr.left + tr.width/2;
  }

  function activeParaIndex(){
    const tl = $('#timeline'); if (!tl) return -1;
    const x = getCursorX(); if (x==null) return -1;
    const slots = $all('.para-slot', tl);
    for (let i=0;i<slots.length;i++){
      const r = slots[i].getBoundingClientRect();
      if (containsX(r, x)) return i;
    }
    if (slots.length){
      const last = slots[slots.length-1].getBoundingClientRect();
      if (x > last.right) return slots.length-1;
    }
    return -1;
  }

  function normalizeRanges(ranges, n){
    if (!Array.isArray(ranges)) return [];
    const arr = ranges.map(r => ({
      from: Math.max(1, Math.min(n, Number(r.from||0))),
      to:   Math.max(1, Math.min(n, Number(r.to||0)))
    })).filter(r => r.from <= r.to);
    arr.sort((a,b)=> a.from - b.from || a.to - b.to);
    const merged = [];
    for (const r of arr){
      const last = merged[merged.length-1];
      if (!last || r.from > last.to + 0){ merged.push({...r}); }
      else { last.to = Math.max(last.to, r.to); }
    }
    return merged;
  }

  function groupRangesFromData(n){
    const out = [];
    if (Array.isArray(window.__VT_GROUPS) && window.__VT_GROUPS.length){
      for (const g of window.__VT_GROUPS){
        if (Array.isArray(g) && g.length){
          const a = Math.min(...g), b = Math.max(...g);
          out.push({from:a, to:b});
        }
      }
      return normalizeRanges(out, n);
    }
    if (typeof window.getGroups === 'function'){
      try{
        const raw = window.getGroups() || [];
        for (const item of raw){
          if (Array.isArray(item) && item.length===2){
            const a = Math.min(item[0], item[1]);
            const b = Math.max(item[0], item[1]);
            out.push({from:a, to:b});
          } else if (item && typeof item==='object' && item.from!=null && item.to!=null){
            const a = Math.min(item.from, item.to);
            const b = Math.max(item.from, item.to);
            out.push({from:a, to:b});
          } else if (typeof item==='number'){
            out.push({from:item, to:item});
          }
        }
        return normalizeRanges(out, n);
      }catch(_){}
    }
    return null;
  }

  function inferGroupFromGeometry(n){
    const tl = $('#timeline'); if (!tl) return [];
    const overlays = $all('[class*="group"]', tl).filter(el => !el.classList.contains('para-slot'));
    const slots = $all('.para-slot', tl);
    const res = [];
    for (const el of overlays){
      const rr = el.getBoundingClientRect();
      if (!rr.width || !rr.height) continue;
      let first=-1, last=-1;
      for (let i=0;i<slots.length;i++){
        const sr = slots[i].getBoundingClientRect();
        const overlap = Math.max(0, Math.min(rr.right, sr.right) - Math.max(rr.left, sr.left));
        if (overlap>0){
          if (first===-1) first=i;
          last=i;
        }
      }
      if (first!==-1 && last!==-1) res.push({from:first+1, to:last+1});
    }
    return normalizeRanges(res, n);
  }

  function getNormalizedGroups(n){
    return groupRangesFromData(n) || inferGroupFromGeometry(n) || [];
  }

  function computeBlocks(n, groups){
    const blocks = [];
    let i = 1;
    while (i <= n){
      let matched = null;
      for (let k=0;k<groups.length;k++){
        const g = groups[k];
        if (g.from === i){ matched = g; break; }
      }
      if (matched){
        blocks.push({from: matched.from, to: matched.to, isGroup:true});
        i = matched.to + 1;
      } else {
        blocks.push({from: i, to: i, isGroup:false});
        i++;
      }
    }
    return blocks;
  }

  function applyGroupAwareColors(){
    const tl = $('#timeline'); if (!tl) return;
    const slots = $all('.para-slot', tl);
    const n = slots.length; if (!n) return;
    const groups = getNormalizedGroups(n);
    const blocks = computeBlocks(n, groups);

    let useLight = true;
    for (const b of blocks){
      for (let p=b.from; p<=b.to; p++){
        const slot = slots[p-1];
        slot.style.background = useLight ? GREEN_LIGHT : GREEN_MED;
      }
      useLight = !useLight;
    }
  }

  function formatGroupLabel(arr){
    if (!arr || !arr.length) return '';
    if (arr.length === 1) return `Avsnitt ${arr[0]}`;
    if (arr.length === 2) return `Avsnittene ${arr[0]} og ${arr[1]}`;
    return `Avsnittene ${arr[0]} - ${arr[arr.length-1]}`;
  }

  function atWhichFrame(){
    const x = getCursorX(); if (x==null) return null;
    const frames = [
      { el: $('#introSlot'),  key:'intro'  },
      { el: $('#reviewSlot'), key:'review' },
      { el: $('#outroSlot'),  key:'outro'  }
    ];
    for (const f of frames){
      if (!f.el) continue;
      const r = f.el.getBoundingClientRect();
      if (containsX(r, x)) return f.key;
    }
    return null;
  }

  function currentGroupForIndex(i0){
    const tl = $('#timeline'); if (!tl) return [i0+1];
    const n = $all('.para-slot', tl).length;
    const groups = getNormalizedGroups(n);
    const i1 = i0 + 1;
    for (const g of groups){
      if (i1 >= g.from && i1 <= g.to){
        const arr = [];
        for (let v=g.from; v<=g.to; v++) arr.push(v);
        return arr;
      }
    }
    return [i1];
  }

  function computeMessage(){
    const fr = atWhichFrame();
    if (fr==='intro')  return 'Introduksjon (maks 1,5 min)';
    if (fr==='review') return 'Repetisjonsspørsmål';
    if (fr==='outro')  return 'Avslutning (maks 1,5 min)';
    const idx0 = activeParaIndex(); if (idx0 < 0) return '';
    const grpArr = currentGroupForIndex(idx0);
    return formatGroupLabel(grpArr);
  }

  function findMessageHost(){
    const sel = [
      '#message', '#messageBox', '#message-field', '#msg', '#status',
      '[data-role="message"]', '.message', '.status-line', '.msg', '.hud-message'
    ].join(', ');
    return $(sel);
  }

  function updateMessageField(){
    const host = findMessageHost(); if (!host) return;
    const txt = computeMessage();

    let span = host.querySelector('.msg-group-only');
    if (!span){
      span = document.createElement('span');
      span.className = 'msg-group-only';
      span.style.opacity = '0.95';
      span.style.fontWeight = '800';
      span.style.whiteSpace = 'nowrap';
    }
    span.textContent = txt;

    // Replace entire content so duplicates can't occur:
    host.replaceChildren(span);
  }

  function stackPinsVerticallyOrdered(){
    const tl = $('#timeline'); if (!tl) return;
    const slots = $all('.para-slot', tl); if (!slots.length) return;
    const BASE = 20, GAP = 18;
    for (const slot of slots){
      const pins = $all('.read-pin, .image-pin, .frame-pin', slot);
      if (!pins.length) continue;
      const withMeta = pins.map((el, i) => {
        let pr = 99;
        const c = el.classList;
        if (c.contains('read-pin'))       pr = 0;
        else if (c.contains('image-pin')) pr = 1;
        else if (c.contains('frame-pin')) pr = 2;
        return { el, pr, i };
      }).sort((a,b)=> (a.pr - b.pr) || (a.i - b.i));
      withMeta.forEach((item, idx) => {
        const el = item.el;
        el.style.position  = 'absolute';
        el.style.left      = '50%';
        el.style.transform = 'translateX(-50%)';
        el.style.bottom    = (-(BASE + idx*GAP)) + 'px';
        if (!el.style.zIndex) el.style.zIndex = '5';
        el.style.transition = 'none';
      });
    }
  }

  function refreshAll(){
    applyGroupAwareColors();
    stackPinsVerticallyOrdered();
    updateMessageField();
  }

  function startObservers(){
    const tl = $('#timeline'); if (!tl) return;
    const mo = new MutationObserver(muts => {
      for (const m of muts){
        if (m.type === 'childList'){ coalesced(refreshAll); break; }
      }
    });
    mo.observe(tl, { childList:true, subtree:true });
    if ('ResizeObserver' in window){
      const ro = new ResizeObserver(()=> coalesced(refreshAll));
      ro.observe(tl);
    }
    coalesced(refreshAll);
  }

  (function waitForTL(){
    if ($('#timeline')){ startObservers(); return; }
    const t0 = Date.now();
    (function poll(){
      if ($('#timeline')){ startObservers(); return; }
      if (Date.now() - t0 > 10000) return;
      raf(poll);
    })();
  })();

})();
