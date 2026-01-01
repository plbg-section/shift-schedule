// Main demo script extracted from demo3.html
// Sets demo flags, attaches UI test controls, sticky-first-column helpers,
// and platform detection for iOS/Android.

// preserve demo flag
window.__demoSnake = true;

(function(){
  // DOM-ready UI wiring and helpers
  document.addEventListener('DOMContentLoaded', ()=>{
    const toggle = document.getElementById('toggleSnake');
    const todayBtn = document.getElementById('todayJump');

    function setToggleState(on) {
      if (!toggle) return;
      toggle.textContent = on ? 'Snake: ON' : 'Snake: OFF';
      if (on) {
        toggle.classList.remove('bg-gray-300','text-gray-800');
        toggle.classList.add('bg-green-600','text-white');
      } else {
        toggle.classList.remove('bg-green-600','text-white');
        toggle.classList.add('bg-gray-300','text-gray-800');
      }
    }

    if (toggle) {
      // init styling
      setToggleState(!!window.__demoSnake);
      toggle.addEventListener('click', ()=>{
        window.__demoSnake = !window.__demoSnake;
        setToggleState(window.__demoSnake);
        // recreate overlays according to new mode
        if (typeof ensureTodayOverlay === 'function') ensureTodayOverlay();
        setTimeout(()=>{
          if (window.__demoSnake && typeof positionTodaySnakeOverlays === 'function') positionTodaySnakeOverlays();
          else if (typeof positionTodayOverlay === 'function') positionTodayOverlay();
        }, 80);
      });
    }

    // Auto-run Today on first load and initialize overlays according to snake flag
    setTimeout(()=>{
      if (todayBtn) todayBtn.click();
      // ensure overlays are created after calendar renders
      setTimeout(()=>{
        if (typeof ensureTodayOverlay === 'function') ensureTodayOverlay();
        if (window.__demoSnake && typeof positionTodaySnakeOverlays === 'function') positionTodaySnakeOverlays();
        else if (typeof positionTodayOverlay === 'function') positionTodayOverlay();
        // apply sticky class to first column cells after calendar renders
        applyStickyFirstColumn();
      }, 140);
    }, 520);

    // Toggle "lift" while horizontally scrolling the table container
    const tableWrap = document.getElementById('tableContainer');
    if (tableWrap){
      let ticking = false;
      tableWrap.addEventListener('scroll', ()=>{
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(()=>{
          const scrolled = tableWrap.scrollLeft > 0;
          const headerCell = tableWrap.querySelector('th:first-child');
          if (headerCell) headerCell.classList.toggle('sticky-lift', scrolled);
          // apply lift to all first-column tds
          Array.from(tableWrap.querySelectorAll('td:first-child')).forEach(td=> td.classList.toggle('sticky-lift', scrolled));
          ticking = false;
        });
      });
    }

    // Apply sticky class to first TD of each row and observe future changes
    function applyStickyFirstColumn(){
      const tbody = document.getElementById('calendarBody');
      if (!tbody) return;
      Array.from(tbody.querySelectorAll('tr')).forEach(tr=>{
        const td = tr.querySelector('td');
        if (td) {
          td.classList.add('sticky','left-0','sticky-panel');
          // ensure the frozen cell is on top of any overlays
          td.style.zIndex = '99999';
        }
      });
    }

    const calendarBody = document.getElementById('calendarBody');
    if (calendarBody && window.MutationObserver){
      const mo = new MutationObserver(()=> applyStickyFirstColumn());
      mo.observe(calendarBody, { childList: true, subtree: true });
    }
  });

  // Platform detection and device logging
  try{
    var ua = navigator.userAgent || navigator.vendor || '';
    var html = document.documentElement;
    // Prefer userAgentData.platform when available; fall back safely to navigator.platform
    var platformHint = (navigator.userAgentData && navigator.userAgentData.platform) ? navigator.userAgentData.platform : (navigator.platform || navigator['platform'] || '');
    var isIOS = /iP(hone|od|ad)/.test(ua) || (/MacIntel/.test(platformHint) && navigator.maxTouchPoints>1);
    var isAndroid = /Android/.test(ua) || /Android/.test(platformHint);
    if (isIOS) html.classList.add('is-ios');
    if (isAndroid) html.classList.add('is-android');

    // Derive a simple friendly device string
    var deviceType = isIOS ? 'iOS (iPhone/iPad)' : (isAndroid ? 'Android' : (/Mobile/.test(ua) ? 'Mobile (unknown)' : 'Desktop'));

    var browser = (function(){
      if (/CriOS|Chrome/.test(ua)) return 'Chrome';
      if (/Firefox/.test(ua)) return 'Firefox';
      if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'Safari';
      if (/Edg\//.test(ua)) return 'Edge';
      return 'Browser';
    })();

    var deviceLog = deviceType + ' — ' + browser + ' — ' + (platformHint || 'platform unknown');
    console.log('Device opened on:', deviceLog, 'ua=', ua);

    // If UI badge exists, show short info (guard DOM timing)
    try{
      var badge = document.getElementById('deviceInfo');
      if (badge){
        badge.textContent = deviceType.replace(/\s.*$/,'');
        badge.title = deviceLog;
        badge.classList.remove('hidden');
      }
    }catch(e){/* ignore DOM timing issues */}

  }catch(e){ console.warn('Device detection failed', e); }

})();
