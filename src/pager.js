/* ══════════ THE PAGER: the scroll site becomes a book ══════════
   Adapted from the Working Smarter course. One section = one page here, so
   every PLAN entry is whole-mode. If anything fails, the paged class is
   removed and the original scroll layout stands. Storage: leading-page. */
(function(){
'use strict';
try{
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var main = document.getElementById('main');
  if(!main) throw new Error('no main');
  /* section plan: key = hash segment, label = bottom-bar name */
  var PLAN = [
    { sel:'section.hero',  key:'home',       label:'Welcome' },
    { sel:'#mission',      key:'mission',    label:'The Chancellor\u2019s charge' },
    { sel:'#tools',        key:'tools',      label:'Which tool, which moment' },
    { sel:'#anchors',      key:'anchors',    label:'Module 01: the four anchors' },
    { sel:'#clarity',      key:'clarity',    label:'Module 02: clear communication' },
    { sel:'#coach',        key:'coach',      label:'Module 03: coaching prep' },
    { sel:'#decide',       key:'decide',     label:'Module 04: sharper decisions' },
    { sel:'#hours',        key:'hours',      label:'Module 05: three habits' },
    { sel:'#guardrails',   key:'guardrails', label:'Guardrails' },
    { sel:'#practice',     key:'practice',   label:'Practice now' },
    { sel:'#check',        key:'check',      label:'Knowledge check' },
    { sel:'#recap',        key:'recap',      label:'Recap' },
    { sel:'#sources',      key:'sources',    label:'Appendix', extras:['footer'] }
  ];
  /* dots: the nine pages, in course order (mirrors PROG_SECTIONS below) */
  var TRACKED = [
    ['home','01','Welcome'], ['mission','02','The Chancellor\u2019s charge'],
    ['tools','03','Which tool, which moment'], ['anchors','04','Module 01: the four anchors'],
    ['clarity','05','Module 02: clear communication'], ['coach','06','Module 03: coaching prep'],
    ['decide','07','Module 04: sharper decisions'], ['hours','08','Module 05: three habits'],
    ['guardrails','09','Guardrails'], ['practice','10','Practice now'],
    ['check','11','Knowledge check'], ['recap','12','Recap'], ['sources','13','Appendix']
  ];
  var pages = [];       /* { el, key, secLabel, pgLabel, n } */
  var secFirst = {};    /* key -> first page index */
  var topSpan = document.getElementById('top');
  var frag = document.createDocumentFragment();

  function mkPage(key, secLabel, pgLabel){
    var art = document.createElement('article');
    art.className = 'page';
    art.setAttribute('data-sec', key);
    art.setAttribute('data-label', pgLabel);
    art.setAttribute('aria-hidden', 'true');
    art.tabIndex = -1;
    if('inert' in art) art.inert = true;
    if(!(key in secFirst)) secFirst[key] = pages.length;
    var meta = { el:art, key:key, secLabel:secLabel, pgLabel:pgLabel, n:1 };
    pages.push(meta);
    frag.appendChild(art);
    return meta;
  }
  PLAN.forEach(function(cfg){
    var S = main.querySelector(cfg.sel) || document.querySelector(cfg.sel);
    if(!S) return;
    var pg = mkPage(cfg.key, cfg.label, cfg.label);
    pg.el.appendChild(S);
    (cfg.extras || []).forEach(function(x){
      var ex = (x === 'footer') ? document.querySelector('body > footer') : main.querySelector(x);
      if(ex) pg.el.appendChild(ex);
    });
  });
  if(!pages.length) throw new Error('no pages');
  pages.forEach(function(p){ p.el.setAttribute('aria-label', p.secLabel); });
  /* rebuild the stage */
  while(main.firstChild) main.removeChild(main.firstChild);
  main.appendChild(frag);
  if(topSpan && pages[0]) pages[0].el.insertBefore(topSpan, pages[0].el.firstChild);
  var more = document.createElement('span');
  more.id = 'pgMore';
  more.setAttribute('aria-hidden', 'true');
  more.innerHTML = 'Scroll for more <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  main.appendChild(more);

  /* bottom bar */
  var bbSec = document.getElementById('bbSec'), bbDots = document.getElementById('bbDots'),
      bbCount = document.getElementById('bbCount'),
      prevBtn = document.getElementById('pgPrev'), nextBtn = document.getElementById('pgNext');
  if(bbDots){
    bbDots.innerHTML = TRACKED.map(function(s){
      return '<a class="bb-dot" href="#p/' + s[0] + '/1" data-rail="' + s[0] + '"' +
        ' title="' + s[1] + ' · ' + s[2] + ' · not yet" aria-label="' + s[2] + ', not done">' +
        '<span class="dot" aria-hidden="true"></span></a>';
    }).join('');
  }

  var cur = -1, animT = null;
  var store = (function(){
    try{ var t = 'leading-page-test'; window.localStorage.setItem(t,'1'); window.localStorage.removeItem(t); return window.localStorage; }
    catch(e){ return null; }
  })();
  function writeHash(p){
    try{ window.history.replaceState(null, '', '#p/' + p.key + '/' + p.n); }catch(e){}
    if(store){ try{ store.setItem('leading-page', p.key + '/' + p.n); }catch(e){} }
  }
  function hashIndex(h){
    if(!h) return null;
    h = String(h).replace(/^#/, '');
    if(!h) return null;
    if(h.indexOf('p/') === 0){
      var bits = h.split('/');
      var k = bits[1];
      return (k in secFirst) ? secFirst[k] : null;
    }
    if(h === 'top' || h === 'main') return 0;
    var el = document.getElementById(h);
    if(!el) return null;
    var pg = el.closest ? el.closest('.page') : null;
    if(!pg) return null;
    for(var j = 0; j < pages.length; j++){ if(pages[j].el === pg) return j; }
    return null;
  }
  function checkMore(){
    if(cur < 0) return;
    var el = pages[cur].el;
    var scrollable = el.scrollHeight - el.clientHeight > 24;
    var nearEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 32;
    main.classList.toggle('more', scrollable && !nearEnd);
    /* A page that scrolls is a scrollable region, and WCAG asks that one be
       reachable from the keyboard so it can be scrolled without a mouse. Some
       pages (the welcome, the appendix) hold no control at all, so the article
       itself joins the tab order while it overflows and leaves again when it
       does not. Pages that do not scroll stay at -1, which is all the pager
       needs to move focus on a page turn. */
    el.tabIndex = scrollable ? 0 : -1;
  }
  var announce = document.getElementById('pgAnnounce');
  function updateBar(){
    var p = pages[cur];
    if(bbSec) bbSec.textContent = p.secLabel;
    if(bbCount) bbCount.textContent = (cur + 1) + ' / ' + pages.length;
    /* Turning the page from the bottom bar leaves focus on the Next button,
       which is where a keyboard user wants it. Nothing would otherwise tell a
       screen reader that the content behind it changed, so the new page names
       itself here. */
    if(announce) announce.textContent = p.secLabel + ', page ' + (cur + 1) + ' of ' + pages.length;
    if(prevBtn) prevBtn.disabled = cur === 0;
    if(nextBtn) nextBtn.disabled = cur === pages.length - 1;
    document.querySelectorAll('.bb-dot').forEach(function(a){
      var on = a.getAttribute('data-rail') === p.key;
      a.classList.toggle('cur', on);
      if(on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }
  function clearAnim(){
    pages.forEach(function(p){ p.el.classList.remove('pg-in-r','pg-in-l','pg-out','pg-out-l','pg-out-r'); });
  }
  function go(i, opts){
    opts = opts || {};
    if(typeof i !== 'number' || i < 0 || i >= pages.length) return;
    if(i === cur){ if(opts.focus) pages[i].el.focus({ preventScroll:true }); return; }
    var from = cur >= 0 ? pages[cur] : null;
    var to = pages[i];
    var dir = from && i < cur ? -1 : 1;
    cur = i;
    if(animT){ window.clearTimeout(animT); animT = null; clearAnim(); }
    to.el.scrollTop = 0;
    to.el.classList.add('cur');
    to.el.removeAttribute('aria-hidden');
    if('inert' in to.el) to.el.inert = false;
    if(from){
      from.el.classList.remove('cur');
      from.el.setAttribute('aria-hidden', 'true');
      /* the outgoing page stays in the DOM through the turn animation, so it
         leaves the tab order at the same moment it becomes aria-hidden.
         checkMore() puts the incoming page back in if it scrolls. */
      from.el.tabIndex = -1;
      /* The outgoing page is still painted for the length of the turn, and it
         holds real links and buttons. aria-hidden alone would leave them
         reachable by Tab during that window, so the page is made inert for as
         long as it is not the current one. */
      if('inert' in from.el) from.el.inert = true;
      if(!reduce){
        to.el.classList.add(dir > 0 ? 'pg-in-r' : 'pg-in-l');
        from.el.classList.add('pg-out', dir > 0 ? 'pg-out-l' : 'pg-out-r');
        animT = window.setTimeout(function(){ animT = null; clearAnim(); }, 420);
      }
      /* focus must never be stranded in a hidden page */
      var ae = document.activeElement;
      if(opts.focus || (ae && from.el.contains(ae))) to.el.focus({ preventScroll:true });
    } else if(opts.focus){
      to.el.focus({ preventScroll:true });
    }
    updateBar();
    writeHash(to);
    checkMore();
    try{
      document.dispatchEvent(new CustomEvent('lead:page', { detail:{ key:to.key, index:cur, label:to.pgLabel } }));
    }catch(e){}
  }
  window.leadPager = {
    go: go,
    goToKey: function(k){ if(k in secFirst) go(secFirst[k]); },
    current: function(){ return cur >= 0 ? { key: pages[cur].key, index: cur } : { key:'', index:0 }; },
    count: pages.length
  };

  /* in-page anchors turn pages instead of scrolling */
  document.addEventListener('click', function(e){
    if(e.defaultPrevented) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if(!a) return;
    var href = a.getAttribute('href');
    if(!href || href === '#') return;
    var id = href.slice(1);
    if(id === 'main'){ e.preventDefault(); if(cur >= 0) pages[cur].el.focus({ preventScroll:true }); return; }
    var idx = hashIndex(href);
    if(idx === null) return;
    e.preventDefault();
    go(idx, { focus:true });
    var el = document.getElementById(id);
    if(el && pages[idx].el.contains(el) && el !== pages[idx].el){
      try{ el.scrollIntoView({ block:'start' }); }catch(err){}
    }
  });
  window.addEventListener('hashchange', function(){
    var idx = hashIndex(window.location.hash);
    if(idx !== null && idx !== cur) go(idx);
  });
  /* book controls */
  if(prevBtn) prevBtn.addEventListener('click', function(){ go(cur - 1); });
  if(nextBtn) nextBtn.addEventListener('click', function(){ go(cur + 1); });
  document.addEventListener('keydown', function(e){
    if(e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if(e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var t = e.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if(document.body.classList.contains('menu-open')) return;
    e.preventDefault();
    go(cur + (e.key === 'ArrowRight' ? 1 : -1));
  });
  /* touch swipe: horizontal, ~50px threshold, ignores mostly-vertical drags */
  var sx = 0, sy = 0, swiping = false;
  main.addEventListener('touchstart', function(e){
    if(e.touches.length === 1){ sx = e.touches[0].clientX; sy = e.touches[0].clientY; swiping = true; }
    else swiping = false;
  }, { passive:true });
  main.addEventListener('touchend', function(e){
    if(!swiping) return;
    swiping = false;
    var t = e.changedTouches && e.changedTouches[0];
    if(!t) return;
    var dx = t.clientX - sx, dy = t.clientY - sy;
    if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur + (dx < 0 ? 1 : -1));
  }, { passive:true });
  /* internal-scroll affordance */
  window.addEventListener('resize', checkMore, { passive:true });
  document.addEventListener('scroll', function(e){
    if(cur >= 0 && e.target === pages[cur].el) checkMore();
  }, true);
  window.addEventListener('load', checkMore);
  if(window.ResizeObserver){
    try{
      var ro = new ResizeObserver(function(){ checkMore(); });
      pages.forEach(function(p){
        Array.prototype.slice.call(p.el.children).forEach(function(ch){ ro.observe(ch); });
      });
    }catch(e){}
  }

  /* open at: deep link > page one. The course always starts on the
     mode question; only an explicit #p/... hash overrides that. */
  var startIdx = hashIndex(window.location.hash);
  go(startIdx === null ? 0 : startIdx);
}catch(err){
  /* build failed: fall back to the original scroll layout */
  document.documentElement.classList.remove('paged');
  var bar = document.getElementById('bookBar');
  if(bar) bar.hidden = true;
}
})();
