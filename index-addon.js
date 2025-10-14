// index-addon.js — v1.75.1 (images fix + robust timing)
// - Leser bilder fra __VT_IMAGE_SET/__VT_ORD om de finnes, ellers currentItem.images
// - Bruker data-p på .para-slot når vi plasserer pins (fallback idx+1)
// - Liten retry til timeline er klar
// - Holder deg på to grønntoner + gruppe-overlay + eksisterende infofelt

(function(){
  /* ========== CSS (inkl. image-pin) ========== */
  (function ensureCSS(){
    if (document.querySelector('style[data-index-addon]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-index-addon','');
    style.textContent = `
      #timeline .para-slot i.read-pin,
      #timeline .para-slot i.frame-pin,
      #timeline .para-slot i.image-pin{
        position:absolute; left:50%; transform:translateX(-50%);
        bottom:-20px !important; top:auto; pointer-events:none; opacity:.95;
      }
      #timeline .para-slot i.read-pin{
        width:16px;height:16px;background:url('./img/read-icon.png') center/contain no-repeat;
      }
      #timeline .para-slot i.frame-pin{
        width:12px;height:12px;background:url('./img/box-icon.png') center/contain no-repeat;
      }
      #timeline .para-slot i.image-pin{
        width:14px;height:14px;background:url('./img/image-icon.png') center/contain no-repeat;
      }

      #timeline .para-slot{ text-shadow:none !important; }
      :root{ --vt-tone-light:#EAF4EE; --vt-tone-dark:#CFE7D6; }
      #timeline .para-slot{
        background-color:var(--vt-tone-light) !important;
        background-image:none !important;
        font-size:12px; line-height:1.2; font-variant-numeric:tabular-nums;
      }
      #timeline .para-slot.alt{ background-color:var(--vt-tone-dark) !important; }
      #timeline .para-slot *{ font-size:inherit !important; line-height:inherit; }
      #timeline .para-slot::before,#timeline .para-slot::after{ background:none !important; }

      /* Gruppe-overlay */
      #timeline .vt-group-overlays{ position:absolute; inset:0; pointer-events:none; }
      #timeline .vt-group-overlay{
        position:absolute; top:0; height:100%;
        display:flex; align-items:center; justify-content:center;
        font-weight:900; font-size:12px; line-height:1.2; color:#2b3432; opacity:.96;
      }
      #timeline .para-slot.vt-in-group>div{ visibility:hidden; }

      /* Inline “Bilder: x” i eksisterende infofelt */
      .vt-inline-stat{ display:inline-flex; align-items:center; gap:.4em; margin-left:12px; white-space:nowrap; }
      .vt-inline-stat img.ic{ width:14px; height:14px; vertical-align:middle; }
    `;
    document.head.appendChild(style);
  })();

  /* ========== Utils ========== */
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

  function parseGroupsString(str){
    if (!str || typeof str !== 'string') return [];
    return str.split(',').map(s=>s.trim()).flatMap(tok=>{
      const m = tok.match(/^(\d+)(?:-(\d+))?$/); if(!m) return [];
      const a=+m[1], b=m[2]?+m[2]:a, arr=[]; for(let i=a;i<=b;i++) arr.push(i); return [arr];
    });
  }
  function getItemsArray(){
    if (window.DATA && Array.isArray(window.DATA.items)) return window.DATA.items;
    if (Array.isArray(window.items)) return window.items;
    if (Array.isArray(window.ARTICLES)) return window.ARTICLES;
    return [];
  }
  function getCurrentItemSafe(){
    if (window.currentItem && typeof window.currentItem==='object') return window.currentItem;
    if (window.ITEM && typeof window.ITEM==='object') return window.ITEM;
    const items = getItemsArray();
    const sel = $('#weekSel');
    if (sel && sel.selectedIndex>=0){
      const opt=sel.options[sel.selectedIndex];
      try{ const v=JSON.parse(opt.value); if (v?.week_start){ const f=items.find(it=>it.week_start===v.week_start); if (f) return f; } }catch{}
      if (opt.dataset?.week_start){ const f=items.find(it=>it.week_start===opt.dataset.week_start); if (f) return f; }
      const m=(opt.textContent||'').match(/\b\d{4}-\d{2}-\d{2}\b/); if (m){ const f=items.find(it=>it.week_start===m[0]); if (f) return f; }
    }
    return items.length===1 ? items[0] : null;
  }
  function getGroups(){
    const it=getCurrentItemSafe();
    if (it && typeof it.groups==='string') return parseGroupsString(it.groups);
    return window.__VT_GROUPS || [];
  }
  function rangeLabel(nums){
    const s=[...new Set(nums)].sort((a,b)=>a-b);
    if (s.length===1) return `Avsnitt ${s[0]}`;
    if (s.length===2 && s[1]===s[0]+1) return `Avsnittene ${s[0]} og ${s[1]}`;
    return `Avsnittene ${s[0]}–${s[s.length-1]}`;
  }

  // refs m/ a/b/c og intervaller "1-2"/"10–12"
  function expandRefsWithOrder(refs){
    const set=new Set(), ord=new Map();
    if (!Array.isArray(refs)) return {set,ord};
    const of = ch => ch ? ({a:1,b:2,c:3}[ch.toLowerCase()]||undefined) : undefined;
    const apply=(a,b,o)=>{ const lo=Math.min(a,b), hi=Math.max(a,b); for(let i=lo;i<=hi;i++){ set.add(i); if(o) ord.set(i,o);} };
    refs.forEach(v=>{
      if (typeof v==='number' && Number.isFinite(v)){ set.add(v); return; }
      if (typeof v!=='string') return;
      const s=v.trim();
      let m=s.match(/^(\d+)[\-–](\d+)([abc])?$/i); if (m){ apply(+m[1],+m[2],of(m[3])); return; }
      m=s.match(/^(\d+)&(\d+)([abc])?$/i);       if (m){ const o=of(m[3]); set.add(+m[1]); set.add(+m[2]); if(o){ord.set(+m[1],o); ord.set(+m[2],o);} return; }
      m=s.match(/^(\d+)([abc])?$/i);             if (m){ const p=+m[1], o=of(m[2]); set.add(p); if(o) ord.set(p,o); }
    });
    return {set,ord};
  }

  /* ========== Two-tone m/grupper ========== */
  function applyTwoToneWithGroups(){
    const tl=$('#timeline'); if(!tl) return;
    const slots=$$('.para-slot',tl); if(!slots.length) return;
    slots.forEach(el=>{ el.style.background=''; el.style.backgroundImage=''; el.style.backgroundColor=''; el.classList.remove('alt'); });
    const groups=getGroups(), starts=new Map(); groups.forEach(g=>{ if(g&&g.length) starts.set(g[0],g); });
    let dark=false, i=1;
    while(i<=slots.length){
      if (starts.has(i)){ const g=starts.get(i); g.forEach(p=>{ const el=slots[p-1]; if(el && dark) el.classList.add('alt'); }); dark=!dark; i=g[g.length-1]+1; }
      else { const el=slots[i-1]; if(el && dark) el.classList.add('alt'); dark=!dark; i++; }
    }
  }

  /* ========== Datasett til pins/meldinger ========== */
  const getReadSet  = ()=> window.__VT_READ_SET2 instanceof Set ? window.__VT_READ_SET2 : (window.readSet || new Set());
  const getFrameSet = ()=> window.__VT_FRAME_SET   instanceof Set ? window.__VT_FRAME_SET   : new Set();
  const getOrd      = ()=> window.__VT_ORD         instanceof Map ? window.__VT_ORD         : new Map();

  function getImageData(){
    // 1) primært fra globale sett (dersom siden din allerede produserer dem)
    if (window.__VT_IMAGE_SET instanceof Set){
      const set = window.__VT_IMAGE_SET;
      const ord = new Map();
      const O = getOrd();
      for (const p of set){ const o = O.get(p)||{}; if (o.image!=null) ord.set(p,o.image); }
      return {set, ord};
    }
    // 2) fallback: fra currentItem.images
    const it=getCurrentItemSafe();
    if (!it || !Array.isArray(it.images)) return {set:new Set(), ord:new Map()};
    return expandRefsWithOrder(it.images);
  }

  /* ========== Meldinger (A/B/C) ========== */
  function joinParts(arr){ if(arr.length===1) return arr[0]; if(arr.length===2) return `${arr[0]} og ${arr[1]}`; return `${arr.slice(0,-1).join(', ')} og ${arr[arr.length-1]}`; }
  function buildSingleMsg(p){
    const frames=getFrameSet(), reads=getReadSet(), imgData=getImageData();
    const hasF=frames.has(p), hasR=reads.has(p), hasI=imgData.set.has(p);
    if (!hasF && !hasR && !hasI) return rangeLabel([p]);
    const ord=getOrd(), o=ord.get(p)||{}, parts=[];
    if (hasF) parts.push({label:'Ramme',order:o.frame ?? 1});
    if (hasR) parts.push({label:'Les-skriftsted',order:o.read ?? 2});
    if (hasI) parts.push({label:'Bilde',order:imgData.ord.get(p) ?? 3});
    parts.sort((a,b)=>a.order-b.order);
    return `${rangeLabel([p])} + ${joinParts(parts.map(x=>x.label))}`;
  }
  function buildGroupMsg(g){
    const frames=getFrameSet(), reads=getReadSet(), imgData=getImageData(), ord=getOrd();
    let hasF=false,hasR=false,hasI=false,oF=Infinity,oR=Infinity,oI=Infinity;
    for (const p of g){
      if (frames.has(p)){ hasF=true; oF=Math.min(oF,(ord.get(p)||{}).frame ?? 1); }
      if (reads.has(p)){  hasR=true; oR=Math.min(oR,(ord.get(p)||{}).read  ?? 2); }
      if (imgData.set.has(p)){ hasI=true; oI=Math.min(oI,(imgData.ord.get(p) ?? 3)); }
    }
    if (!hasF && !hasR && !hasI) return rangeLabel(g);
    const parts=[]; if(hasF) parts.push({label:'Ramme',order:oF}); if(hasR) parts.push({label:'Les-skriftsted',order:oR}); if(hasI) parts.push({label:'Bilde',order:oI});
    parts.sort((a,b)=>a.order-b.order);
    return `${rangeLabel(g)} + ${joinParts(parts.map(x=>x.label))}`;
  }
  function buildMsgFor(p){ const groups=getGroups(); for(const g of groups){ if(g.includes(p)) return buildGroupMsg(g); } return buildSingleMsg(p); }

  function keepMessageStable(){
    const msg=$('#message'); if(!msg) return;
    const mo=new MutationObserver(()=>{
      const t=(msg.textContent||'').trim();
      const m=t.match(/^Avsnitt\s+(\d+)(?:\b|$)/); if(!m) return;
      const desired=buildMsgFor(+m[1]); if(desired && t!==desired) msg.textContent=desired;
    });
    mo.observe(msg,{childList:true,characterData:true,subtree:true});
  }

  /* ========== Gruppe-overlays ========== */
  function placeGroupOverlays(){
    const tl=$('#timeline'); if(!tl) return;
    const slots=$$('.para-slot',tl); if(!slots.length) return;
    const container=slots[0].parentElement||tl;
    const old=container.querySelector('.vt-group-overlays'); if(old) old.remove();
    slots.forEach(s=>s.classList.remove('vt-in-group'));
    const groups=getGroups(); if(!groups.length) return;
    if(getComputedStyle(container).position==='static') container.style.position='relative';
    const wrap=document.createElement('div'); wrap.className='vt-group-overlays'; container.appendChild(wrap);
    const cref=container.getBoundingClientRect();
    const labelText=g=>(g.length===2?`${g[0]}&${g[1]}`:`${g[0]}–${g[g.length-1]}`);
    groups.forEach(g=>{
      const first=slots[g[0]-1], last=slots[g[g.length-1]-1]; if(!first||!last) return;
      g.forEach(p=>{ const el=slots[p-1]; if(el) el.classList.add('vt-in-group'); });
      const r1=first.getBoundingClientRect(), r2=last.getBoundingClientRect();
      const ov=document.createElement('div'); ov.className='vt-group-overlay';
      ov.style.left=(r1.left - cref.left)+'px'; ov.style.width=(r2.right - r1.left)+'px';
      ov.textContent=labelText(g); wrap.appendChild(ov);
    });
  }

  /* ========== Pins (bruk data-p hvis finnes) ========== */
  function layoutPins(){
    const tl=$('#timeline'); if(!tl) return;
    const slots=$$('.para-slot',tl); if(!slots.length) return;
    const ord=getOrd(), frames=getFrameSet(), reads=getReadSet(), imgData=getImageData();

    slots.forEach((slot, idx)=>{
      const p = Number(slot.dataset.p || (idx+1));
      $$('.read-pin,.frame-pin,.image-pin',slot).forEach(n=>n.remove());

      const items=[];
      if (frames.has(p))       items.push({type:'frame', order:(ord.get(p)||{}).frame ?? 1});
      if (reads.has(p))        items.push({type:'read',  order:(ord.get(p)||{}).read  ?? 2});
      if (imgData.set.has(p))  items.push({type:'image', order:(imgData.ord.get(p) ?? 3)});
      if (!items.length) return;

      items.sort((a,b)=>(a.order??99)-(b.order??99));
      const gap=6, base=-((items.length-1)/2)*gap;
      items.forEach((it,i)=>{
        const el=document.createElement('i');
        el.className = it.type==='frame' ? 'frame-pin' : it.type==='read' ? 'read-pin' : 'image-pin';
        el.style.left=`calc(50% + ${base + i*gap}px)`;
        el.style.zIndex = String(100 - (it.order ?? 99));
        slot.appendChild(el);
      });
    });
  }

  /* ========== Infofelt (oppdater eksisterende) ========== */
  function findInfoPanel(){
    const candidates=['#article-info','#articleInfo','#article-panel','#articlePanel','.article-info','.article-meta','.article-details','#info'];
    for (const sel of candidates){ const el=$(sel); if (el) return el; }
    return null;
  }
  function updateStats(){
    const panel=findInfoPanel(); if(!panel) return;
    const it=getCurrentItemSafe();
    const paraCount= it?.words ? it.words.length : it?.para_lengths ? it.para_lengths.length : ($$('#timeline .para-slot').length||0);
    const readCount = (getReadSet().size||0);
    const frameCount= (getFrameSet().size||0);
    const imageCount= (getImageData().set.size||0);

    const setText=(sel,val)=>{ const el=$(sel,panel); if(el) el.textContent=val; return !!el; };
    setText('#paraCount', String(paraCount));
    setText('#readCount', String(readCount));
    setText('#frameCount', String(frameCount));

    let imgWrap = $('#vt-images-wrap', panel);
    if (!imgWrap){
      imgWrap = document.createElement('span');
      imgWrap.className='vt-inline-stat'; imgWrap.id='vt-images-wrap';
      imgWrap.innerHTML = `<img class="ic" src="./img/image-icon.png" alt=""><b>Bilder:</b> <span id="imageCount">0</span>`;
      panel.appendChild(imgWrap);
    }
    const ic = $('#imageCount', panel); if (ic) ic.textContent = String(imageCount);
  }

  /* ========== Apply & observe (med liten retry) ========== */
  function applyAll(){ applyTwoToneWithGroups(); placeGroupOverlays(); layoutPins(); keepMessageStable(); updateStats(); }

  function whenTimelineReady(run){
    let tries=0;
    (function tick(){
      const tl=$('#timeline'); const ready = tl && $$('.para-slot',tl).length;
      if (ready){ run(); return; }
      if (tries++<30) setTimeout(tick, 50); // opptil ca 1.5s
    })();
  }

  function startObservers(){
    const tl=$('#timeline'); if (!tl) return;
    const ignoreIds=new Set(['elapsed','cursor','elapsedSP','cursorSP']);
    const mo=new MutationObserver(records=>{
      const relevant=records.some(rec=>{
        if(rec.type!=='attributes') return true;
        const id=rec.target && rec.target.id;
        if(ignoreIds.has(id)) return false;
        return true;
      });
      if(relevant) requestAnimationFrame(applyAll);
    });
    mo.observe(tl,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
  }

  const orig1 = window.drawTimeline;
  const orig2 = window.renderTimeline;
  if (typeof orig1==='function'){
    window.drawTimeline=function(){ const r=orig1.apply(this,arguments); requestAnimationFrame(applyAll); requestAnimationFrame(startObservers); return r; };
  }
  if (typeof orig2==='function' && orig2!==orig1){
    window.renderTimeline=function(){ const r=orig2.apply(this,arguments); requestAnimationFrame(applyAll); requestAnimationFrame(startObservers); return r; };
  }

  if (document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', ()=> whenTimelineReady(()=>{ applyAll(); startObservers(); }));
  } else {
    whenTimelineReady(()=>{ applyAll(); startObservers(); });
  }
})();
