// index-addon.js — v1.75 + group labels + pin stacking + dropdown limit
// - Two green tones; groups share first tone; flip after whole group
// - One overlay label per group ("4&5" / "10–12"), centrally across the group's width
// - Read & frame icons on the same line under the timeline; A-order sits above B if needed
// - Clean slot number rendering; hide numbers inside grouped slots
// - Limit dropdown to prev week + current + next 3

(function(){
  /* ================= CSS ================= */
  (function ensureCSS(){
    if (document.querySelector('style[data-index-addon]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-index-addon','');
    style.textContent = `
      /* Icons: both types in the same line under the timeline */
      #timeline .para-slot i.read-pin,
      #timeline .para-slot i.frame-pin{
        position:absolute; left:50%; transform:translateX(-50%);
        bottom:-20px !important; top:auto; pointer-events:none; opacity:.95;
      }
      #timeline .para-slot i.read-pin{
        width:16px; height:16px;
        background:url('./img/read-icon.png') center/contain no-repeat;
      }
      #timeline .para-slot i.frame-pin{
        width:12px; height:12px;
        background:url('./img/box-icon.png')  center/contain no-repeat;
      }

      /* Remove any white text-shadow on slot numbers */
      #timeline .para-slot{ text-shadow:none !important; }

      :root{
        --vt-tone-light:#EAF4EE;
        --vt-tone-dark:#DEEFE4;
      }
      #timeline{ position:relative; } /* for overlays */
      #timeline .para-slot{
        background-color:var(--vt-tone-light) !important;
        background-image:none !important;
        font-size:12px; line-height:1.2; font-variant-numeric:tabular-nums;
      }
      #timeline .para-slot.alt{
        background-color:var(--vt-tone-dark) !important;
        background-image:none !important;
      }
      #timeline .para-slot *{ font-size:inherit !important; line-height:inherit; }
      #timeline .para-slot.active,
      #timeline .para-slot.current,
      #timeline .para-slot.selected,
      #timeline .para-slot.is-active{
        background-color:inherit !important; background-image:none !important;
      }
      #timeline .para-slot::before,
      #timeline .para-slot::after{ background:none !important; }

      /* Group overlay labels (bold, same size as slot numbers) */
      #timeline .vt-group-overlays{
        position:absolute; left:0; top:0; right:0; bottom:0; pointer-events:none;
      }
      #timeline .vt-group-overlay{
        position:absolute; top:0; height:100%;
        display:flex; align-items:center; justify-content:center;
        font-weight:900; font-size:12px; line-height:1.2;
        color:#2b3432; opacity:.96;
      }

      /* Hide only the number content inside grouped slots (not the background/pins) */
      #timeline .para-slot.vt-in-group > div{ visibility:hidden; }
    `;
    document.head.appendChild(style);
  })();

  /* ================= Utils ================= */
  const $  = (sel, root=document)=> root.querySelector(sel);
  const $$ = (sel, root=document)=> Array.from(root.querySelectorAll(sel));

  function parseGroupsString(str){
    if (!str || typeof str !== 'string') return [];
    return str.split(',').map(s=>s.trim()).flatMap(tok=>{
      const m = tok.match(/^(\d+)(?:-(\d+))?$/); if(!m) return [];
      const a=+m[1], b=m[2]?+m[2]:a, arr=[]; for(let i=a;i<=b;i++) arr.push(i); return [arr];
    });
  }
  function getGroups(){
    if (Array.isArray(window.__VT_GROUPS)) return window.__VT_GROUPS;
    const it = window.currentItem || window.ITEM || null;
    if (it && typeof it.groups === 'string') return parseGroupsString(it.groups);
    return window.__VT_GROUPS || [];
  }
  function rangeLabel(nums){
    const s=[...new Set(nums)].sort((a,b)=>a-b);
    if (s.length===1) return `Avsnitt ${s[0]}`;
    if (s.length===2 && s[1]===s[0]+1) return `Avsnittene ${s[0]} og ${s[1]}`;
    return `Avsnittene ${s[0]}–${s[s.length-1]}`;
  }

  /* ================= Two tones with group blocks ================= */
  function applyTwoToneWithGroups(){
    const tl = $('#timeline'); if(!tl) return;
    const slots = $$('.para-slot', tl); if(!slots.length) return;

    slots.forEach(el=>{
      el.style.background=''; el.style.backgroundImage=''; el.style.backgroundColor='';
      el.classList.remove('alt');
    });

    const groups = getGroups();
    const starts = new Map(); groups.forEach(g=>{ if (g && g.length) starts.set(g[0], g); });

    let dark=false, i=1;
    while(i<=slots.length){
      if (starts.has(i)){
        const g = starts.get(i);
        g.forEach(p=>{ const el=slots[p-1]; if (el && dark) el.classList.add('alt'); });
        dark=!dark; i=g[g.length-1]+1;
      } else {
        const el=slots[i-1]; if (el && dark) el.classList.add('alt');
        dark=!dark; i++;
      }
    }
  }

  /* ================= Message helpers ================= */
  const getReadSet  = ()=> window.__VT_READ_SET2 instanceof Set ? window.__VT_READ_SET2 : (window.readSet || new Set());
  const getFrameSet = ()=> window.__VT_FRAME_SET   instanceof Set ? window.__VT_FRAME_SET   : new Set();
  const getOrd      = ()=> window.__VT_ORD         instanceof Map ? window.__VT_ORD         : new Map();

  function buildSingleMsg(p){
    const ord=getOrd(), frames=getFrameSet(), reads=getReadSet();
    const o=ord.get(p)||{}, hasF=frames.has(p), hasR=reads.has(p);
    if (!hasF && !hasR) return rangeLabel([p]);
    if (hasF && hasR){
      const f=o.frame ?? 1, r=o.read ?? 2;
      return ((f ?? 99) <= (r ?? 99))
        ? `${rangeLabel([p])} + Ramme og Les-skriftsted`
        : `${rangeLabel([p])} + Les-skriftsted og Ramme`;
    }
    return hasF ? `${rangeLabel([p])} + Ramme` : `${rangeLabel([p])} + Les-skriftsted`;
  }
  function buildGroupMsg(g){
    const frames=getFrameSet(), reads=getReadSet();
    const hasF = g.some(p=>frames.has(p)), hasR = g.some(p=>reads.has(p));
    let label = rangeLabel(g);
    if (hasF && hasR) label += ' + Ramme og Les-skriftsted';
    else if (hasF)    label += ' + Ramme';
    else if (hasR)    label += ' + Les-skriftsted';
    return label;
  }
  function buildMsgFor(p){
    const groups=getGroups();
    for (const g of groups) if (g.includes(p)) return buildGroupMsg(g);
    return buildSingleMsg(p);
  }
  function keepMessageStable(){
    const msg = $('#message'); if(!msg) return;
    const mo = new MutationObserver(()=>{
      const text=(msg.textContent||'').trim();
      const m = text.match(/^Avsnitt\s+(\d+)(?:\b|$)/); if(!m) return;
      const p = +m[1], desired=buildMsgFor(p);
      if (desired && text!==desired) msg.textContent=desired;
    });
    mo.observe(msg, {childList:true, characterData:true, subtree:true});
  }

  /* ================= Group overlays (precise centering) ================= */
  function placeGroupOverlays(){
    const tl = document.getElementById('timeline'); if (!tl) return;
    const slots = Array.from(tl.querySelectorAll('.para-slot')); if (!slots.length) return;
    const container = slots[0].parentElement || tl;

    const oldWrap = container.querySelector('.vt-group-overlays'); if (oldWrap) oldWrap.remove();
    slots.forEach(s=>s.classList.remove('vt-in-group'));

    const groups = getGroups(); if (!groups.length) return;

    const cs = getComputedStyle(container);
    if (cs.position === 'static') container.style.position='relative';

    const wrap = document.createElement('div'); wrap.className='vt-group-overlays'; container.appendChild(wrap);
    const cref = container.getBoundingClientRect();
    const labelText = g => (g.length===2 ? `${g[0]}&${g[1]}` : `${g[0]}–${g[g.length-1]}`);

    groups.forEach(g=>{
      const first=slots[g[0]-1], last=slots[g[g.length-1]-1]; if(!first||!last) return;
      g.forEach(p=>{ const el=slots[p-1]; if (el) el.classList.add('vt-in-group'); });

      const r1=first.getBoundingClientRect(), r2=last.getBoundingClientRect();
      const leftPx=r1.left - cref.left, widthPx=r2.right - r1.left;

      const ov=document.createElement('div');
      ov.className='vt-group-overlay';
      ov.style.left=leftPx+'px'; ov.style.width=widthPx+'px';
      ov.textContent=labelText(g);
      wrap.appendChild(ov);
    });
  }

  /* ================= Pins with A-over-B stacking ================= */
  function layoutPins(){
    const tl = document.getElementById('timeline'); if(!tl) return;
    const slots = Array.from(tl.querySelectorAll('.para-slot')); if(!slots.length) return;

    const ord=getOrd(), frames=getFrameSet(), reads=getReadSet();

    slots.forEach((slot, idx)=>{
      const p=idx+1;
      Array.from(slot.querySelectorAll('.read-pin,.frame-pin')).forEach(n=>n.remove());

      const items=[];
      if (frames.has(p)) items.push({type:'frame', order:(ord.get(p)||{}).frame ?? 1});
      if (reads.has(p))  items.push({type:'read',  order:(ord.get(p)||{}).read  ?? 2});
      if (!items.length) return;

      // Sort by A/B (lower order first). A should sit above B if overlapping.
      items.sort((a,b)=>(a.order??99)-(b.order??99));

      const gap=6; const base=-((items.length-1)/2)*gap;
      items.forEach((it,i)=>{
        const el=document.createElement('i');
        el.className = it.type==='frame' ? 'frame-pin' : 'read-pin';
        el.style.left = `calc(50% + ${base + i*gap}px)`;
        el.style.zIndex = String(100 - (it.order ?? 99)); // A above B
        slot.appendChild(el);
      });
    });
  }

  /* ================= Apply & observe ================= */
  function applyAll(){
    applyTwoToneWithGroups();
    placeGroupOverlays();
    layoutPins();
    keepMessageStable();
  }
  function startObservers(){
    const tl = $('#timeline'); if (!tl) return;
    const mo = new MutationObserver(()=> requestAnimationFrame(applyAll));
    mo.observe(tl, {childList:true, subtree:true, attributes:true, attributeFilter:['style','class']});
  }
  const orig = window.drawTimeline;
  if (typeof orig === 'function'){
    window.drawTimeline = function(){
      const r = orig.apply(this, arguments);
      requestAnimationFrame(applyAll);
      requestAnimationFrame(startObservers);
      return r;
    };
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>{ applyAll(); startObservers(); });
  } else {
    applyAll(); startObservers();
  }

  /* ================= Limit dropdown to prev + current + next 3 ================= */
  (function limitArticleDropdown(){
    function mondayLocal(d=new Date()){
      const day=d.getDay(); const diff=(day===0?-6:1-day);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()+diff);
    }
    function fmt(d){ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}` }
    function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }

    const allowSet = (()=>{
      const curr=mondayLocal(new Date());
      const prev=addDays(curr,-7), n1=addDays(curr,7), n2=addDays(curr,14), n3=addDays(curr,21);
      return new Set([fmt(prev), fmt(curr), fmt(n1), fmt(n2), fmt(n3)]);
    })();

    function filterWeekSel(){
      const sel=document.getElementById('weekSel'); if (!sel) return;
      const opts=Array.from(sel.options);
      opts.forEach(opt=>{
        try{
          const it=JSON.parse(opt.value);
          if (!it || !allowSet.has(it.week_start)) opt.remove();
        }catch{ opt.remove(); } // not our format → remove
      });
      if (!sel.options.length) return;
      // Prefer current week if present
      const arr=Array.from(allowSet); const current=arr[1];
      let idx = Array.from(sel.options).findIndex(o=>{ try{ return JSON.parse(o.value).week_start===current; }catch{return false;} });
      if (idx<0) idx=0; sel.selectedIndex=idx;
      sel.dispatchEvent(new Event('change', {bubbles:true}));
    }

    function run(){ filterWeekSel(); setTimeout(filterWeekSel,300); setTimeout(filterWeekSel,1200); }
    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', run); else run();

    const hook=()=>{ const sel=document.getElementById('weekSel'); if (sel) new MutationObserver(()=>filterWeekSel()).observe(sel,{childList:true}); };
    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', hook); else hook();
  })();

})();
