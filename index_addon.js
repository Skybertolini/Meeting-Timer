/*! index_addon_1.33.js — annotations + jank fix + VERTICAL PIN STACKING
    - Starts from 1.31 (robust message annotations + coalesced updates).
    - Adds vertical stacking for multiple pins under each paragraph slot:
      * Targets existing Meeting Timer pin classes: .read-pin, .frame-pin, .image-pin
      * Keeps them centered horizontally; stacks downward with 18px spacing.
    - No DOM removals and no element deletions; safe to drop into current page.
*/
(function(){
  'use strict';

  // ---------- config ----------
  var DEBUG = !!window.__vtDebug;

  // ---------- utils ----------
  function $(sel, root){ return (root||document).querySelector(sel); }
  function $all(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }
  function whenTimelineReady(cb){
    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', check);
    } else check();
    function check(){
      const t0 = Date.now();
      (function wait(){
        const tl = $('#timeline');
        if (tl){ cb(tl); return; }
        if (Date.now()-t0 > 10000) return;
        requestAnimationFrame(wait);
      })();
    }
  }
  function rectCenterX(r){ return r.left + r.width/2; }
  function containsX(r, x){ return x >= r.left && x <= r.right; }
  function log(){ if (DEBUG) try{ console.log.apply(console, arguments);}catch(_){ } }

  // ---------- coalesced apply ----------
  let applyScheduled = false;
  function coalescedApply(){
    if (applyScheduled) return;
    applyScheduled = true;
    requestAnimationFrame(() => { applyScheduled = false; safeApply(); });
  }

  // optional hooks from host app
  const originalApplyAll = (typeof window.applyAll === 'function') ? window.applyAll.bind(window) : null;
  const keepMessageStable      = (typeof window.keepMessageStable === 'function') ? window.keepMessageStable.bind(window) : null;
  const updateStats            = (typeof window.updateStats === 'function') ? window.updateStats.bind(window) : null;
  const placeGroupOverlays     = (typeof window.placeGroupOverlays === 'function') ? window.placeGroupOverlays.bind(window) : null;
  const applyTwoToneWithGroups = (typeof window.applyTwoToneWithGroups === 'function') ? window.applyTwoToneWithGroups.bind(window) : null;
  const layoutPins             = (typeof window.layoutPins === 'function') ? window.layoutPins.bind(window) : null;
  const getGroupsFn            = (typeof window.getGroups === 'function') ? window.getGroups.bind(window) : null;
  const getReadsFn             = (typeof window.getReads === 'function') ? window.getReads.bind(window) : null;
  const getFramesFn            = (typeof window.getFrames === 'function') ? window.getFrames.bind(window) : null;
  const getImagesFn            = (typeof window.getImages === 'function') ? window.getImages.bind(window) : null;

  // ---------- active context ----------
  function getCursorX(){
    const cur = $('#cursor') || $('.cursor') || $('#elapsed') || $('.elapsed') || $('#playhead') || $('.playhead');
    if (cur){
      const r = cur.getBoundingClientRect();
      return Math.min(r.right, r.left + r.width/2);
    }
    const tl = $('#timeline');
    if (!tl) return null;
    return rectCenterX(tl.getBoundingClientRect());
  }

  function getActiveParaIndex(){
    const tl = $('#timeline');
    if (!tl) return -1;
    const x = getCursorX();
    if (x == null) return -1;
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

  function atWhichFrame(){
    const x = getCursorX();
    if (x == null) return null;
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

  // ---------- flags & groups ----------
  function isReadPara(idx){
    try{
      if (getReadsFn){
        const reads = getReadsFn() || [];
        const zeroBased = reads.some(n => n === 0);
        return zeroBased ? reads.includes(idx) : reads.includes(idx+1);
      }
    }catch(_){}
    const slot = $all('.para-slot', $('#timeline'))[idx];
    if (!slot) return false;
    const c = slot.classList;
    if (c.contains('read') || c.contains('is-read') || c.contains('scripture') || c.contains('les')) return true;
    const ds = slot.dataset || {};
    if (ds.read==='1' || ds.type==='read' || ds.les==='1' || ds.scripture==='1') return true;
    if (slot.querySelector('[data-icon="read"], .icon-read, .read-icon, [aria-label*="les"], [title*="les"]')) return true;
    return false;
  }

  function hasFrameFlag(idx){
    try{
      if (getFramesFn){
        const arr = getFramesFn() || [];
        const oneIdx = idx+1;
        for (const it of arr){
          if (Array.isArray(it) && it.length===2){
            if (oneIdx>=it[0] && oneIdx<=it[1]) return true;
          } else if (typeof it === 'number'){
            if (it===oneIdx) return true;
          } else if (it && typeof it==='object' && it.from!=null && it.to!=null){
            if (oneIdx>=it.from && oneIdx<=it.to) return true;
          }
        }
      }
    }catch(_){}
    const slot = $all('.para-slot', $('#timeline'))[idx];
    if (!slot) return false;
    const c = slot.classList;
    if (c.contains('frame') || c.contains('has-frame') || c.contains('ramme')) return true;
    const ds = slot.dataset || {};
    if (ds.frame==='1' || ds.ramme==='1') return true;
    if (slot.querySelector('[data-icon="frame"], .icon-frame, .frame-icon, [aria-label*="ramme"], [title*="ramme"]')) return true;
    return false;
  }

  function hasImageFlag(idx){
    try{
      if (getImagesFn){
        const imgs = getImagesFn() || [];
        const oneIdx = idx+1;
        for (const it of imgs){
          if (Array.isArray(it) && it.length===2){
            if (oneIdx>=it[0] && oneIdx<=it[1]) return true;
          } else if (typeof it === 'number'){
            if (it===oneIdx) return true;
          } else if (it && typeof it==='object' && it.from!=null && it.to!=null){
            if (oneIdx>=it.from && oneIdx<=it.to) return true;
          }
        }
      }
    }catch(_){}
    const slot = $all('.para-slot', $('#timeline'))[idx];
    if (!slot) return false;
    const c = slot.classList;
    if (c.contains('has-image') || c.contains('image') || c.contains('bilde')) return true;
    const ds = slot.dataset || {};
    if (ds.image==='1' || ds.bilde==='1') return true;
    if (slot.querySelector('[data-icon="image"], .icon-image, .image-icon, [role="img"], img[data-role="para-image"], [aria-label*="bilde"], [title*="bilde"]')) return true;
    return false;
  }

  function groupForIndex(idx){
    try{
      if (getGroupsFn){
        const g = getGroupsFn() || [];
        const norm = g.map(item => {
          if (Array.isArray(item)) return {from:item[0], to:item[1]};
          if (typeof item==='object' && item) return {from:item.from, to:item.to};
          if (typeof item==='number') return {from:item, to:item};
          return null;
        }).filter(Boolean);
        const one = idx+1;
        for (const r of norm){
          if (one>=r.from && one<=r.to) return r;
        }
      }
    }catch(_){}

    const tl = $('#timeline'); if (!tl) return null;
    const x = getCursorX(); if (x==null) return null;

    const candidates = $all('[class*="group"]', tl).filter(el => !el.classList.contains('para-slot'));
    const slots = $all('.para-slot', tl);
    if (!slots.length) return null;

    for (const el of candidates){
      const rr = el.getBoundingClientRect();
      if (!rr.width || !rr.height) continue;
      if (!containsX(rr, x)) continue;
      let first = -1, last = -1;
      for (let i=0;i<slots.length;i++){
        const sr = slots[i].getBoundingClientRect();
        const overlap = Math.max(0, Math.min(rr.right, sr.right) - Math.max(rr.left, sr.left));
        if (overlap > 0){
          if (first===-1) first = i;
          last = i;
        }
      }
      if (first !== -1 && last !== -1 && last >= first){
        return { from:first+1, to:last+1 };
      }
    }
    return null;
  }

  // ---------- message formatting ----------
  function joinModifiers(mods){
    if (mods.length===0) return '';
    if (mods.length===1) return ' + ' + mods[0];
    if (mods.length===2) return ' + ' + mods[0] + ' og ' + mods[1];
    const last = mods.pop();
    return ' + ' + mods.join(', ') + ' og ' + last;
  }

  function currentMessage(){
    const frameKey = atWhichFrame();
    if (frameKey){
      if (frameKey==='intro')  return 'Introduksjon (maks 1,5 min)';
      if (frameKey==='review') return 'Repetisjonsspørsmål';
      if (frameKey==='outro')  return 'Avslutning (maks 1,5 min)';
    }

    const i = getActiveParaIndex();
    if (i<0) return '';

    let label = '';
    const grp = groupForIndex(i);
    if (grp){
      const len = grp.to - grp.from + 1;
      if (len===1){
        label = `Avsnitt ${grp.from}`;
      } else if (len===2){
        label = `Avsnitt ${grp.from} og ${grp.to}`;
      } else {
        label = `Avsnitt ${grp.from}-${grp.to}`;
      }
    } else {
      label = `Avsnitt ${i+1}`;
    }

    const mods = [];
    if (isReadPara(i))  mods.push('Les-skriftsted');
    if (hasFrameFlag(i)) mods.push('Ramme');
    if (hasImageFlag(i)) mods.push('Bilde');

    return label + joinModifiers(mods);
  }

  function findMessageHost(){
    const sel = [
      '#message', '#messageBox', '#message-field', '#msg', '#status',
      '[data-role="message"]', '.message', '.status-line', '.msg', '.hud-message'
    ].join(', ');
    return $(sel);
  }

  function updateMessage(){
    const host = findMessageHost();
    if (!host) { log('No message host found'); return; }
    let span = host.querySelector('.msg-meta-addon');
    if (!span){
      span = document.createElement('span');
      span.className = 'msg-meta-addon';
      host.appendChild(document.createTextNode(' '));
      host.appendChild(span);
      span.style.opacity = '0.95';
      span.style.fontWeight = '800';
      span.style.whiteSpace = 'nowrap';
    }
    span.textContent = currentMessage();
  }

  // ---------- vertical stacking of pins (slot-local) ----------
  function stackPinsVertically(){
    const tl = $('#timeline'); if (!tl) return;
    const slots = $all('.para-slot', tl); if (!slots.length) return;
    const GAP = 18;  // px between pins
    const BASE = 20; // px below slot (positive number; converted to negative bottom)

    for (const slot of slots){
      const pins = $all('i.read-pin, i.frame-pin, i.image-pin', slot);
      if (!pins.length) continue;
      // keep deterministic order: use DOM order as created by main app
      pins.forEach((pin, i) => {
        pin.style.left = '50%';
        pin.style.transform = 'translateX(-50%)';
        // Stack downward: bottom: -20px, -38px, -56px ...
        const b = -(BASE + i * GAP);
        pin.style.bottom = b + 'px';
      });
    }
  }

  // ---------- structure signature to avoid heavy work ----------
  let __lastSig = { count: -1, groupsKey: '' };
  function computeSignature(){
    const tl = $('#timeline');
    if (!tl) return { count:-1, groupsKey:'' };
    const slots = $all('.para-slot', tl);
    let groupsKey='';
    try{ if (getGroupsFn) groupsKey = JSON.stringify(getGroupsFn()); }catch(_){}
    return { count: slots.length, groupsKey };
  }

  function safeApply(){
    const sig = computeSignature();
    const same = (sig.count===__lastSig.count) && (sig.groupsKey===__lastSig.groupsKey);
    if (!same){
      __lastSig = sig;
      if (applyTwoToneWithGroups || placeGroupOverlays || layoutPins){
        try{ applyTwoToneWithGroups && applyTwoToneWithGroups(); }catch(_){}
        try{ placeGroupOverlays && placeGroupOverlays(); }catch(_){}
        try{ layoutPins && layoutPins(); }catch(_){}
      } else if (originalApplyAll){
        try{ originalApplyAll(); }catch(_){}
      }
    }
    try{ keepMessageStable && keepMessageStable(); }catch(_){}
    try{ updateStats && updateStats(); }catch(_){}
    try{ updateMessage(); }catch(_){}
    try{ stackPinsVertically(); }catch(_){}
  }

  // ---------- observers ----------
  function startObservers(tl){
    const mo = new MutationObserver(muts => {
      for (const m of muts){
        if (m.type==='childList'){ coalescedApply(); break; }
      }
    });
    mo.observe(tl, { childList:true, subtree:true });
    if ('ResizeObserver' in window){
      const ro = new ResizeObserver(() => coalescedApply());
      ro.observe(tl);
    }
    coalescedApply();
  }

  // ---------- wire hooks ----------
  (function wireHooks(){
    const wrap = (name)=>{
      const orig = window[name];
      if (typeof orig!=='function') return;
      if (orig.__wrapped_by_addon_133) return;
      function wrapped(){
        const out = orig.apply(this, arguments);
        coalescedApply();
        return out;
      }
      wrapped.__wrapped_by_addon_133 = true;
      window[name] = wrapped;
    };
    // wrap commonly called layout/renderers in the main app
    ['drawTimeline','renderTimeline','rebuildTimeline','drawTimelineSP'].forEach(wrap);
  })();

  // ---------- init ----------
  whenTimelineReady(tl => {
    startObservers(tl);
    if (DEBUG){
      const slots = $all('.para-slot', tl);
      log('VT addon 1.33 init. slots=', slots.length, 'hooks:', {
        getGroups: !!getGroupsFn, getReads: !!getReadsFn, getFrames: !!getFramesFn, getImages: !!getImagesFn
      });
    }
  });

})();
