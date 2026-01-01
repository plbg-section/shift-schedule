const SHIFT_CYCLE = ['M', 'M', 'E', 'E', 'N', 'N', 'O', 'O'];
const TEAMS = [
    { id: 'A', name: 'กะ A', offset: 3 },
    { id: 'B', name: 'กะ B', offset: 5 },
    { id: 'C', name: 'กะ C', offset: 7 },
    { id: 'D', name: 'กะ D', offset: 1 }
];

const baseDate = new Date(2026, 0, 1); 
const now = new Date();
let viewYear = now.getFullYear();
let viewMonth = now.getMonth();
let isMobileView = window.innerWidth < 768;
// Ensure we only attach overlay listeners once
let _overlayListenersAttached = false;
let _overlayMutationObserver = null;
// Keep-alive handle for demo snake overlays (ensures persistent animation)
let _snakeKeepAliveId = null;
// Remember user's jumped-to day so highlight persists until next jump
let _jumpSelectedDay = null;
// Jump overlay handles & listeners
let _jumpOverlay = null;
let _jumpOverlayObserver = null;
let _jumpOverlayListenersAttached = false;
let _jumpOverlayRaf = null;
// Duration (ms) for jump arrow and nudge visibility
const JUMP_ARROW_DURATION = 5000; // increased so users can notice the arrow

const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", 
                   "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Set last updated time
    document.getElementById('updateTime').textContent = new Date().toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Initial render
    renderCalendar();
    
    // Event listeners
    setupEventListeners();
    
    // Hide mobile hint after 5 seconds
    setTimeout(() => {
        const hint = document.getElementById('scrollHint');
        if (hint) hint.style.opacity = '0.5';
    }, 5000);
    
    // Auto-adjust on resize
    window.addEventListener('resize', handleResize);
});

function getShift(teamOffset, targetDate) {
    const d1 = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    const d2 = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    let idx = (diffDays + teamOffset) % 8;
    return SHIFT_CYCLE[idx < 0 ? idx + 8 : idx];
}

function renderCalendar() {
    // Show loading
    const loadingEl = document.getElementById('loadingIndicator');
    if (loadingEl) loadingEl.classList.remove('hidden');
    
    // Simulate loading for better UX
    setTimeout(() => {
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        document.getElementById('monthDisplay').innerText = monthNames[viewMonth] + " " + (viewYear + 543);
        document.getElementById('yearDisplay').innerText = "ค.ศ. " + viewYear;

        const todayStr = new Date().setHours(0,0,0,0);

        // Dates Header
        let datesHtml = '';
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(viewYear, viewMonth, d);
            const isToday = dateObj.getTime() === todayStr;
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const dayName = dateObj.toLocaleDateString('th-TH', { weekday: 'short' });
            
                datesHtml += `
                        <div data-date="${d}" class="date-cell flex-1 border-r text-center min-w-[60px] md:min-w-[70px] py-3 ${isToday ? 'bg-blue-600 text-white' : isWeekend ? 'bg-slate-50' : ''} ${isToday ? 'today-highlight' : ''}">
                            <div class="text-xs uppercase ${isToday ? 'text-blue-100' : 'text-gray-500'} font-medium">${dayName}</div>
                            <div class="text-base md:text-lg font-bold mt-1">${d}</div>
                            ${isToday ? '<div class="text-[10px] mt-1 opacity-90">วันนี้</div>' : ''}
                        </div>`;
        }
        document.getElementById('datesContainer').innerHTML = datesHtml;

        // Team Rows
        let bodyHtml = '';
        TEAMS.forEach(team => {
            bodyHtml += `<tr class="border-b hover:bg-slate-50/50 transition-colors">`;
            bodyHtml += `<td class="p-4 border-r font-bold text-gray-800 sticky-col bg-white text-sm md:text-base">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm">${team.id}</div>
                                <div>
                                    <div>${team.name}</div>
                                    <div class="text-xs text-gray-500 font-normal">กะ ${team.id}</div>
                                </div>
                            </div>
                        </td>`;
            bodyHtml += `<td class="p-0"><div class="flex min-w-max">`;
            
            for (let d = 1; d <= daysInMonth; d++) {
                const targetDate = new Date(viewYear, viewMonth, d);
                const shift = getShift(team.offset, targetDate);
                const isToday = targetDate.getTime() === todayStr;
                const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;
                
                let colorClass = '';
                let shiftName = '';
                switch(shift) {
                    case 'M': 
                        colorClass = 'shift-m'; 
                        shiftName = 'เช้า';
                        break;
                    case 'E': 
                        colorClass = 'shift-e'; 
                        shiftName = 'บ่าย';
                        break;
                    case 'N': 
                        colorClass = 'shift-n'; 
                        shiftName = 'ดึก';
                        break;
                    case 'O': 
                        colorClass = 'shift-o'; 
                        shiftName = 'หยุด';
                        break;
                }

                // Determine human-readable shift time for tooltip/feedback
                let shiftTime = '';
                switch (shift) {
                    case 'M': shiftTime = '06:00-14:00 น.'; break;
                    case 'E': shiftTime = '14:00-22:00 น.'; break;
                    case 'N': shiftTime = '22:00-06:00 น.'; break;
                    case 'O': shiftTime = 'วันหยุด'; break;
                }

                const cellHtml = `
                    <div class="shift-cell date-cell flex-1 h-16 md:h-20 flex flex-col items-center justify-center border-r text-sm md:text-base font-bold ${colorClass} ${isToday ? 'today-highlight' : ''} ${isWeekend ? 'opacity-90' : ''}"
                         data-date="${d}"
                         data-team="${team.id}"
                         data-shift="${shift}"
                         data-shift-time="${shiftTime}"
                         title="${team.name} | วันที่ ${d} ${monthNames[viewMonth]} ${viewYear+543} | กะ${shiftName}">
                        <div class="font-bold text-lg">${shift}</div>
                        <div class="text-xs mt-1 opacity-80 hidden md:block">${shiftName}</div>
                    </div>`;
                bodyHtml += cellHtml;
            }
            bodyHtml += `</div></td></tr>`;
        });
        document.getElementById('calendarBody').innerHTML = bodyHtml;
        // update navigation badges (days in prev/next month)
        try { if (typeof updateNavBadges === 'function') updateNavBadges(); } catch(e) {}
        
        // Hide loading
        if (loadingEl) loadingEl.classList.add('hidden');
        
        // Add click handlers to cells
        document.querySelectorAll('.shift-cell').forEach(cell => {
            cell.addEventListener('click', function() {
                const team = this.dataset.team;
                const date = this.dataset.date;
                const shift = this.dataset.shift;
                const shiftTime = this.dataset.shiftTime || '';

                // simple press feedback
                this.style.transform = 'scale(0.95)';
                setTimeout(() => this.style.transform = '', 150);

                showToast(`${team} | วันที่ ${date} ${monthNames[viewMonth]} | กะ${shift} (${shiftTime})`);
            });
        });
        // Create/position the floating overlay for today's highlight (above the table)
        ensureTodayOverlay();
        // Reapply user's jumped highlight if it belongs to the currently rendered month/year
        try {
            if (_jumpSelectedDay && _jumpSelectedDay.month === viewMonth && _jumpSelectedDay.year === viewYear) {
                setTimeout(() => highlightJumpDate(_jumpSelectedDay.day), 80);
            }
        } catch (e) {
            // ignore
        }
    }, 300); // Simulated loading delay
}

// --- Overlay helpers to draw today's animated focus ring above all content ---
function ensureTodayOverlay() {
    // remove any existing overlays (ring or snake) and stop snake keep-alive
    document.querySelectorAll('.today-overlay, .snake-overlay').forEach(n => n.remove());
    stopSnakeKeepAlive();

    const elements = Array.from(document.querySelectorAll('.today-highlight'));
    if (elements.length === 0) return;
    // if demo requested snake style, create snake overlays; otherwise use ring overlays
    if (window.__demoSnake) {
        ensureTodaySnakeOverlay(elements);
        // ensure snake overlays are positioned and animated
        requestAnimationFrame(() => {
            positionTodaySnakeOverlays();
        });
        // Start a keep-alive to keep snake overlays visible and animated
        startSnakeKeepAlive();
    } else {
        // stop any demo keep-alive when not in demo snake mode
        stopSnakeKeepAlive();
        elements.forEach((el, idx) => {
            const ov = document.createElement('div');
            ov.className = 'today-overlay';
            ov.dataset.targetIndex = idx;
            // create a random violet->transparent conic gradient for this overlay
            const hue = Math.floor(220 + Math.random() * 120); // between 220 (blue) and 340 (magenta)
            const { r, g, b } = hslToRgb(hue / 360, 0.70, 0.50);
            const strong = `rgba(${r},${g},${b},0.95)`;
            const faint = `rgba(${r},${g},${b},0.14)`;
            const grad = `conic-gradient(from 0deg, ${strong} 0deg 24deg, ${faint} 24deg 40deg, transparent 40deg 360deg)`;
            ov.style.setProperty('--ring-grad', grad);
            document.body.appendChild(ov);
        });
    }

    // reposition on scroll/resize and on layout changes — attach listeners only once
    if (!_overlayListenersAttached) {
        window.addEventListener('resize', positionTodayOverlay);
        window.addEventListener('scroll', positionTodayOverlay, true);
        // also position snake overlays if demo flag is active
        window.addEventListener('resize', () => { if (window.__demoSnake) positionTodaySnakeOverlays(); });
        window.addEventListener('scroll', () => { if (window.__demoSnake) positionTodaySnakeOverlays(); }, true);
        _overlayListenersAttached = true;
    }

    // initial position and a few retries to handle late reflow (fonts/images)
    positionTodayOverlay();
    requestAnimationFrame(positionTodayOverlay);
    setTimeout(positionTodayOverlay, 60);
    setTimeout(positionTodayOverlay, 250);
    setTimeout(positionTodayOverlay, 800);

    // If fonts are loaded later, re-run positioning once fonts are ready
    try {
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => positionTodayOverlay());
        }
    } catch (e) {
        // ignore
    }

    // Observe DOM changes inside calendarBody to reposition overlays if layout shifts
    const bodyEl = document.getElementById('calendarBody');
    if (bodyEl) {
        if (_overlayMutationObserver) {
            _overlayMutationObserver.disconnect();
        }
        _overlayMutationObserver = new MutationObserver(() => {
            // small debounce
            requestAnimationFrame(positionTodayOverlay);
        });
        _overlayMutationObserver.observe(bodyEl, { childList: true, subtree: true, attributes: true });
    }
}

// Reposition the persistent jump overlay to follow the header+rows
function positionJumpOverlay() {
    if (_jumpOverlayRaf) return; // throttle via RAF
    _jumpOverlayRaf = requestAnimationFrame(() => {
        _jumpOverlayRaf = null;
        try {
            if (!_jumpOverlay || !_jumpOverlay.el) return;
            const day = _jumpOverlay.day;
            const headerEl = document.querySelector(`#datesContainer .date-cell[data-date="${day}"]`);
            const cells = Array.from(document.querySelectorAll(`.shift-cell[data-date="${day}"]`));
            if (!headerEl || cells.length === 0) return;

            const headerRect = headerEl.getBoundingClientRect();
            const firstCell = cells[0];
            const lastCell = cells[cells.length - 1] || firstCell;
            const lastRect = lastCell.getBoundingClientRect();
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;
            const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

            const left = Math.round(headerRect.left + scrollX);
            const top = Math.round(headerRect.top + scrollY);
            const width = Math.round(headerRect.width);
            const height = Math.round(lastRect.bottom - headerRect.top);

            const el = _jumpOverlay.el;
            // Set absolute coordinates for overlay to align with document layout
            el.style.width = width + 'px';
            el.style.height = height + 'px';
            el.style.transform = 'none';
            el.style.left = left + 'px';
            el.style.top = top + 'px';
            // Center arrow child precisely using pixel math to avoid subpixel rounding issues
            try {
                const arrow = el.querySelector('.jump-arrow-abs');
                if (arrow) {
                    // compute based on header rect to avoid offsets from borders/padding
                    const headerEl = document.querySelector(`#datesContainer .date-cell[data-date="${_jumpOverlay.day}"]`);
                    const headerRect = headerEl ? headerEl.getBoundingClientRect() : null;
                    const arrowLeft = headerRect ? Math.round(headerRect.width / 2) : Math.round((el.clientWidth || width) / 2);
                    arrow.style.left = arrowLeft + 'px';
                    arrow.style.transform = 'translateX(-50%)';
                }
            } catch (e) {
                // ignore
            }
        } catch (e) {
            console.error('positionJumpOverlay error', e);
        }
    });
}

// --- Snake overlay implementation (SVG rect + stroke-dash animation) ---
function ensureTodaySnakeOverlay(elements) {
    // create one overlay per element, with an SVG rect inside
    elements.forEach((el, idx) => {
        const ov = document.createElement('div');
        ov.className = 'snake-overlay';
        ov.dataset.targetIndex = idx;
        ov.style.willChange = 'left,top,width,height,transform';
        // create svg placeholder; actual sizing applied in position function
        ov.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"></svg>`;
        document.body.appendChild(ov);
    });
}

// Debug helper: log and visually outline snake overlays
window.debugSnakeState = function() {
    const today = Array.from(document.querySelectorAll('.today-highlight'));
    const overlays = Array.from(document.querySelectorAll('.snake-overlay'));
    console.log('debugSnakeState:', { todayCount: today.length, snakeOverlays: overlays.length });
    if (overlays.length === 0) {
        console.warn('No snake overlays found. Ensure `ensureTodayOverlay()` ran and `.today-highlight` exists.');
    }
    overlays.forEach(ov => {
        ov.style.outline = '3px solid rgba(220,38,38,0.95)';
        ov.style.background = 'rgba(220,38,38,0.03)';
    });
    return { today, overlays };
};

function positionTodayOverlay() {
    const elements = Array.from(document.querySelectorAll('.today-highlight'));
    const overlays = Array.from(document.querySelectorAll('.today-overlay'));
    if (elements.length === 0 || overlays.length === 0) return;

    overlays.forEach((ov, i) => {
        const el = elements[i] || elements[0];
        const rect = el.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const left = Math.round(rect.left + scrollX);
        const top = Math.round(rect.top + scrollY);
        ov.style.left = left + 'px';
        ov.style.top = top + 'px';
        ov.style.width = rect.width + 'px';
        ov.style.height = rect.height + 'px';
    });
}

// Update small badges on prev/next buttons to show days in prev/next month
function updateNavBadges() {
    try {
        const prevBadge = document.getElementById('prevBadge');
        const nextBadge = document.getElementById('nextBadge');
        if (!prevBadge && !nextBadge) return;
        // previous month
        const prevDays = new Date(viewYear, viewMonth, 0).getDate();
        // next month (month+2 because month is 0-indexed and we want the following month)
        const nextDays = new Date(viewYear, viewMonth + 2, 0).getDate();
        if (prevBadge) prevBadge.textContent = prevDays;
        if (nextBadge) nextBadge.textContent = nextDays;
    } catch (e) {
        // ignore errors silently
    }
}

// Position snake overlays (uses same elements order as .today-highlight)
function positionTodaySnakeOverlays() {
    const elements = Array.from(document.querySelectorAll('.today-highlight'));
    const overlays = Array.from(document.querySelectorAll('.snake-overlay'));
    if (elements.length === 0 || overlays.length === 0) return;

    overlays.forEach((ov, i) => {
        const el = elements[i] || elements[0];
        const rect = el.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const left = Math.round(rect.left + scrollX);
        const top = Math.round(rect.top + scrollY);
        ov.style.left = left + 'px';
        ov.style.top = top + 'px';
        ov.style.width = rect.width + 'px';
        ov.style.height = rect.height + 'px';

        // ensure svg matches dimensions and create/update rect path
        const svg = ov.querySelector('svg');
        if (!svg) return;
        svg.setAttribute('width', rect.width);
        svg.setAttribute('height', rect.height);
        svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

        // compute inset steps and create/update 2 outer rects (reuse elements to avoid rebuild jitter)
        const insetStep = Math.max(6, Math.min(rect.width, rect.height) * 0.06);
        const rings = 2;

        // Color palettes per shift/today: [outerRGB, innerRGB]
        const colorMap = {
            today: [[132,204,22],[217,119,6]],       // #84CC16, #D97706
            M:     [[6,95,70],[14,165,164]],          // teal dark / teal light
            E:     [[3,105,161],[96,165,250]],        // blue deep / blue light
            N:     [[230,255,143],[132,204,22]],      // pale-lime / lime
            O:     [[124,58,237],[192,132,252]]       // violet / lavender
        };

        // determine shift type for this element (header/date -> today)
        let shiftType = 'today';
        try {
            if (el && el.dataset && el.dataset.shift) shiftType = el.dataset.shift;
            else if (el && el.classList && el.classList.contains('shift-cell')) shiftType = el.dataset.shift || 'today';
        } catch (e) {
            shiftType = 'today';
        }

        const palette = colorMap[shiftType] || colorMap.today;

        // reuse existing rects when possible to keep animations smooth
        const existing = Array.from(svg.querySelectorAll('rect'));
        const baseDur = 2.6; // base duration (seconds) for outer ring — increased to slow animation
        for (let j = 0; j < rings; j++) {
            const inset = insetStep * (j + 1);
            const w = Math.max(4, rect.width - inset * 2);
            const h = Math.max(4, rect.height - inset * 2);
            const x = inset;
            const y = inset;
            const perim = 2 * (w + h);
            const visible = Math.round(perim * 0.18);
            const gap = perim;
            // slower durations for smoother, less frantic motion
            const dur = baseDur + j * 0.9; // outer slower, inner slightly faster
            const delay = j * 0.18;
            const alpha = Math.max(0.22, 0.95 - j * 0.22);

            const rgb = (j === 0) ? palette[0] : palette[1];
            const stroke = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;

            let rectEl = existing[j];
            if (!rectEl) {
                rectEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rectEl.setAttribute('class', 'snake-path');
                svg.appendChild(rectEl);
            }

            // update geometry & style without recreating element
            rectEl.setAttribute('x', x);
            rectEl.setAttribute('y', y);
            rectEl.setAttribute('width', w);
            rectEl.setAttribute('height', h);
            rectEl.setAttribute('rx', Math.min(8, inset));
            rectEl.setAttribute('ry', Math.min(8, inset));
            rectEl.setAttribute('stroke', stroke);
            rectEl.setAttribute('stroke-width', '3');
            rectEl.style.strokeDasharray = `${visible} ${gap}`;

            if (!rectEl._snakeAnim) {
                try {
                    const keyframes = [ { strokeDashoffset: 0 }, { strokeDashoffset: -perim } ];
                    rectEl._snakeAnim = rectEl.animate(keyframes, { duration: dur * 1000, iterations: Infinity, delay: delay * 1000, easing: 'linear' });
                } catch (e) {
                    rectEl.style.animation = `snake-move ${dur}s linear ${delay}s infinite`;
                }
            }
        }
    });
}

function removeTodayOverlay() {
    // remove ring overlays
    document.querySelectorAll('.today-overlay').forEach(n => n.remove());
    // remove snake overlays and stop keep-alive
    document.querySelectorAll('.snake-overlay').forEach(n => n.remove());
    stopSnakeKeepAlive();
}

// Start a periodic keep-alive that ensures snake overlays exist and are repositioned.
function startSnakeKeepAlive() {
    if (!window.__demoSnake) return;
    if (_snakeKeepAliveId) return;
    _snakeKeepAliveId = setInterval(() => {
        const overlays = document.querySelectorAll('.snake-overlay');
        if (overlays.length === 0) {
            // recreate overlays if they were removed for any reason
            ensureTodayOverlay();
        } else {
            // refresh layout/animations by re-positioning
            positionTodaySnakeOverlays();
        }
    }, 1800);
}

function stopSnakeKeepAlive() {
    if (_snakeKeepAliveId) {
        clearInterval(_snakeKeepAliveId);
        _snakeKeepAliveId = null;
    }
}

function setupEventListeners() {
    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) {
        prevBtn.onclick = () => { 
            viewMonth--; 
            if(viewMonth < 0){ viewMonth=11; viewYear--; } 
            renderCalendar(); 
        };
    }

    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.onclick = () => { 
            viewMonth++; 
            if(viewMonth > 11){ viewMonth=0; viewYear++; } 
            renderCalendar(); 
        };
    }

    // Date picker change: update view and formatted display (dd/MM/yyyy)
    const dateJumpEl = document.getElementById('dateJump');
    if (dateJumpEl) {
        dateJumpEl.onchange = (e) => { 
            const d = new Date(e.target.value); 
            if(d.getTime()){ 
                viewYear = d.getFullYear(); 
                viewMonth = d.getMonth(); 
                renderCalendar(); 
                const disp = document.getElementById('dateDisplay');
                if (disp) {
                    const label = disp.querySelector('.dateLabel');
                    if (label) label.textContent = formatDateDDMM(d);
                    else {
                        const span = document.createElement('span');
                        span.className = 'dateLabel';
                        span.textContent = formatDateDDMM(d);
                        const inp = disp.querySelector('#dateJump');
                        if (inp) disp.insertBefore(span, inp);
                        else disp.appendChild(span);
                    }
                }
                // highlight the jumped date (header + cells)
                setTimeout(() => highlightJumpDate(d.getDate()), 80);
            } 
        };
    }

    const todayJump = document.getElementById('todayJump');
    if (todayJump) {
        todayJump.onclick = () => {
            const today = new Date();
            viewYear = today.getFullYear();
            viewMonth = today.getMonth();
            if (dateJumpEl) dateJumpEl.valueAsDate = today;
            const disp = document.getElementById('dateDisplay');
            if (disp) {
                const label = disp.querySelector('.dateLabel');
                if (label) label.textContent = formatDateDDMM(today);
                else {
                    const span = document.createElement('span');
                    span.className = 'dateLabel';
                    span.textContent = formatDateDDMM(today);
                    const inp = disp.querySelector('#dateJump');
                    if (inp) disp.insertBefore(span, inp);
                    else disp.appendChild(span);
                }
            }
            renderCalendar();
            // Scroll to today
            setTimeout(() => {
                scrollToTodayAdaptive();
            }, 400);
            // visibly mark the jumped date for the user
            setTimeout(() => highlightJumpDate(today.getDate()), 120);
        };
    }

    const todayBtn = document.getElementById('todayBtn');
    if (todayBtn) {
        todayBtn.onclick = () => {
            const today = new Date();
            viewYear = today.getFullYear();
            viewMonth = today.getMonth();
            renderCalendar();
            // Scroll to today
            setTimeout(() => {
                scrollToTodayAdaptive();
            }, 400);
            // visibly mark the jumped date for the user
            setTimeout(() => highlightJumpDate(today.getDate()), 120);
        };
    }

    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) helpBtn.onclick = () => {
        const modal = document.getElementById('helpModal');
        if (modal) modal.classList.remove('hidden');
    };

    const closeHelp = document.getElementById('closeHelp');
    if (closeHelp) closeHelp.onclick = () => {
        const modal = document.getElementById('helpModal');
        if (modal) modal.classList.add('hidden');
    };

    const closeHelpBtn = document.getElementById('closeHelpBtn');
    if (closeHelpBtn) closeHelpBtn.onclick = () => {
        const modal = document.getElementById('helpModal');
        if (modal) modal.classList.add('hidden');
    };

    // Close modal on outside click
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
        helpModal.onclick = (e) => {
            if (e.target.id === 'helpModal') {
                helpModal.classList.add('hidden');
            }
        };
    }

    // Set initial date picker value and formatted display
    const dateInput = dateJumpEl;
    if (dateInput) dateInput.valueAsDate = now;
    // Debug helpers: log interactions with the date input in demo pages
    if (dateInput) {
        dateInput.addEventListener('pointerdown', (e) => console.log('dateJump: pointerdown', e.type, e));
        dateInput.addEventListener('click', (e) => console.log('dateJump: click', e.type, e));
        dateInput.addEventListener('focus', (e) => console.log('dateJump: focus', e.type));
    }
    const dateDisp = document.getElementById('dateDisplay');
    if (dateDisp) {
        const label = dateDisp.querySelector('.dateLabel');
        if (label) label.textContent = formatDateDDMM(now);
        else {
            const span = document.createElement('span');
            span.className = 'dateLabel';
            span.textContent = formatDateDDMM(now);
            const inp = dateDisp.querySelector('#dateJump');
            if (inp) dateDisp.insertBefore(span, inp);
            else dateDisp.appendChild(span);
        }
    }

    // If wrapper exists, allow click to open native picker (showPicker if supported)
    const wrap = document.getElementById('datePickerWrap');
    if (wrap) {
        wrap.addEventListener('click', (e) => {
            // avoid double-handling if native input already receives the click
            const inp = document.getElementById('dateJump');
            try {
                if (inp && typeof inp.showPicker === 'function') {
                    inp.showPicker();
                } else if (inp) {
                    inp.focus();
                    inp.click();
                }
            } catch (err) {
                // ignore
            }
        });
    }

    // Also allow clicking the formatted date display to open the picker (useful for demos)
    const dateDisplayEl = document.getElementById('dateDisplay');
    if (dateDisplayEl) {
        dateDisplayEl.style.cursor = 'pointer';
        dateDisplayEl.addEventListener('click', (e) => {
            const inp = document.getElementById('dateJump');
            console.log('dateDisplay clicked, hasInput:', !!inp, 'demoSnake:', !!window.__demoSnake);
            if (!inp) return;
            // Try modern API first, then fallbacks. Log errors so F12 reveals issues.
            try {
                if (typeof inp.showPicker === 'function') {
                    console.log('Using showPicker()');
                    inp.showPicker();
                    return;
                }

                // Some browsers won't open the picker on programmatic click.
                // Temporarily make the input visible and dispatch events as a user-driven fallback.
                const prevOpacity = inp.style.opacity;
                const prevPointer = inp.style.pointerEvents;
                const prevOutline = inp.style.outline;
                inp.style.pointerEvents = 'auto';
                inp.style.opacity = '1';
                inp.style.outline = '2px solid rgba(220,38,38,0.85)';
                inp.focus();

                // Dispatch lightweight mouse events to simulate a click gesture
                inp.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                inp.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                inp.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

                // restore tiny delay so UI can react to the simulated gesture
                setTimeout(() => {
                    inp.style.opacity = prevOpacity;
                    inp.style.pointerEvents = prevPointer;
                    inp.style.outline = prevOutline;
                }, 120);
            } catch (err) {
                console.error('Failed to open date picker programmatically:', err);
                // final fallback: prompt the user to type a date
                const s = prompt('Enter date (YYYY-MM-DD):', inp.value || '');
                if (s) {
                    try {
                        inp.value = s;
                        inp.dispatchEvent(new Event('change', { bubbles: true }));
                    } catch (e) {
                        console.error('Failed to set fallback date value:', e);
                    }
                }
            }
        });
    }
}

function handleResize() {
    const wasMobileView = isMobileView;
    isMobileView = window.innerWidth < 768;
    
    if (wasMobileView !== isMobileView) {
        const container = document.getElementById('tableContainer');
        if (isMobileView) {
            container.classList.add('mobile-compact');
        } else {
            container.classList.remove('mobile-compact');
        }
    }
}

function showToast(message) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) existingToast.remove();
    
    // Create new toast
    const toast = document.createElement('div');
    toast.className = 'toast-message fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-lg z-50 text-sm font-medium animate-fade-in';
    toast.textContent = message;
    
    // Add animation style
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translate(-50%, 20px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in {
            animation: fadeIn 0.3s ease forwards;
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, -20px)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 300);
    }, 3000);
}

// Helper: format Date -> dd/MM/yyyy
function formatDateDDMM(d) {
    if (!d || !(d instanceof Date)) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

// Convert HSL (h in [0..1], s in [0..1], l in [0..1]) to RGB {r,g,b}
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = Math.round(l * 255);
    } else {
        const hue2rgb = function(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
        g = Math.round(hue2rgb(p, q, h) * 255);
        b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
    }
    return { r, g, b };
}

// Enable iOS-style momentum scrolling
(function enableIOSMomentumScroll(){
    try {
        const isIOS = /iP(hone|od|ad)/.test(navigator.platform) || (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
        if (!isIOS) return;
        const el = document.querySelector('.overflow-x-auto');
        if (el) el.style.webkitOverflowScrolling = 'touch';
    } catch (e) {
        // no-op
    }
})();

/* Scroll helpers: place today's element within viewport at an adaptive fraction.
   Desired fraction is clamped between 0.25 (left-ish) and 0.75 (right-ish) so
   the user sees context for start/end of month without manual horizontal scroll. */
function scrollToTodayAdaptive() {
    const container = document.getElementById('tableContainer');
    if (!container) return;

    const today = new Date();
    const todayDay = today.getDate();
    const headerEl = document.querySelector(`#datesContainer .date-cell[data-date="${todayDay}"]`);
    const refEl = headerEl || document.querySelector('.today-highlight');
    if (!refEl) return;

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const dateAttr = refEl.getAttribute('data-date');
    const dayIndex = dateAttr ? parseInt(dateAttr, 10) : todayDay;

    // Calculate position ratio (0 to 1) based on day in month
    let pos = 0.5;
    if (dayIndex && daysInMonth > 1) {
        pos = (dayIndex - 1) / (daysInMonth - 1);
    }

    // Map position to viewport fraction: early month -> 0.25, late month -> 0.75
    const desiredFrac = 0.25 + pos * 0.5;

    // Get element position relative to container
    const elRect = refEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Calculate where the element currently is in absolute scroll coordinates
    const elLeft = elRect.left - containerRect.left + container.scrollLeft;
    
    // Calculate target scroll: position element at desiredFrac of viewport
    const targetScroll = elLeft - (container.clientWidth * desiredFrac);
    
    // Clamp to valid scroll range
    const maxScroll = container.scrollWidth - container.clientWidth;
    const finalScroll = Math.max(0, Math.min(maxScroll, targetScroll));

    container.scrollTo({ left: finalScroll, behavior: 'smooth' });
}

// Highlight a jumped-to date with a dashed border on the header cell and all row cells.
function clearJumpHighlight() {
    // remove dashed highlights
    document.querySelectorAll('.jump-highlight').forEach(n => n.classList.remove('jump-highlight'));
    // remove nudge animation classes
    document.querySelectorAll('.jump-nudge').forEach(n => n.classList.remove('jump-nudge'));
    // remove any absolute arrows appended to body
    document.querySelectorAll('.jump-arrow-abs').forEach(n => n.remove());
    // remove column overlay if present
    document.querySelectorAll('.jump-column-overlay').forEach(n => n.remove());
    // cleanup overlay refs and listeners
    if (_jumpOverlayObserver) {
        try { _jumpOverlayObserver.disconnect(); } catch (e) {}
        _jumpOverlayObserver = null;
    }
    if (_jumpOverlayRaf) {
        cancelAnimationFrame(_jumpOverlayRaf);
        _jumpOverlayRaf = null;
    }
    if (_jumpOverlay) {
        _jumpOverlay = null;
    }
    if (_jumpOverlayListenersAttached) {
        window.removeEventListener('resize', positionJumpOverlay);
        window.removeEventListener('scroll', positionJumpOverlay, true);
        const container = document.getElementById('tableContainer');
        if (container) container.removeEventListener('scroll', positionJumpOverlay);
        _jumpOverlayListenersAttached = false;
    }
}

function highlightJumpDate(day) {
    try {
        clearJumpHighlight();
        // remember selection (day + current view) so we can reapply after rerenders
        _jumpSelectedDay = { day: day, month: viewMonth, year: viewYear };
        if (!day) return;
        const headerEl = document.querySelector(`#datesContainer .date-cell[data-date="${day}"]`);
        const cells = Array.from(document.querySelectorAll(`.shift-cell[data-date="${day}"]`));

        // ensure visible: scroll the table container to show the header cell
        const container = document.getElementById('tableContainer');
        if (container && headerEl) {
            const elRect = headerEl.getBoundingClientRect();
            const contRect = container.getBoundingClientRect();
            const elLeft = elRect.left - contRect.left + container.scrollLeft;
            const target = Math.max(0, Math.min(container.scrollWidth - container.clientWidth, elLeft - container.clientWidth * 0.25));
            container.scrollTo({ left: target, behavior: 'smooth' });
        }
        // Add a single dashed overlay around the full column (header + rows) and an arrow
        if (headerEl) {
            try {
                // add nudge class to header and cells (animation)
                headerEl.classList.add('jump-nudge');
                cells.forEach(c => c.classList.add('jump-nudge'));

                // If this jump points to today's actual date, do not show dashed overlay or arrow;
                // only keep the nudge animation on today's column.
                const today = new Date();
                const isToday = (day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear());

                if (!isToday) {
                    // create single column overlay to enclose header + all cells
                    try {
                        // remove any previous overlay
                        document.querySelectorAll('.jump-column-overlay').forEach(n => n.remove());

                        const headerRect = headerEl.getBoundingClientRect();
                        const firstCell = cells[0];
                        const lastCell = cells[cells.length - 1] || firstCell;
                        const lastRect = lastCell ? lastCell.getBoundingClientRect() : headerRect;
                        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
                        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

                        const overlay = document.createElement('div');
                        overlay.className = 'jump-column-overlay';
                        overlay.style.position = 'absolute';
                        overlay.style.pointerEvents = 'none';
                        overlay.style.zIndex = 10005;
                        overlay.style.willChange = 'left,top,width,height,transform';
                        // create arrow as child so it moves exactly with overlay (prevents jitter on horizontal scroll)
                        const arrow = document.createElement('div');
                        arrow.className = 'jump-arrow-abs';
                        arrow.style.position = 'absolute';
                        arrow.style.top = '-18px';
                        arrow.style.left = '50%';
                        arrow.style.transform = 'translateX(-50%)';
                        overlay.appendChild(arrow);
                        document.body.appendChild(overlay);
                        // store ref for repositioning
                        _jumpOverlay = { el: overlay, day: day };

                        // attach listeners once to keep overlay in place during scroll/resize/layout
                        if (!_jumpOverlayListenersAttached) {
                            window.addEventListener('resize', positionJumpOverlay);
                            window.addEventListener('scroll', positionJumpOverlay, true);
                            const containerEl = document.getElementById('tableContainer');
                            if (containerEl) containerEl.addEventListener('scroll', positionJumpOverlay);
                            _jumpOverlayListenersAttached = true;
                        }

                        // observe mutations in calendarBody to re-position when DOM changes layout
                        try {
                            const bodyEl = document.getElementById('calendarBody');
                            if (bodyEl) {
                                if (_jumpOverlayObserver) _jumpOverlayObserver.disconnect();
                                _jumpOverlayObserver = new MutationObserver(() => requestAnimationFrame(positionJumpOverlay));
                                _jumpOverlayObserver.observe(bodyEl, { childList: true, subtree: true, attributes: true });
                            }
                        } catch (er) { /* ignore */ }

                        // Ensure overlay is positioned immediately after layout (avoid initial misplacement)
                        requestAnimationFrame(() => {
                            try { positionJumpOverlay(); } catch (e) {}
                        });
                    } catch (er) {
                        console.error('failed creating column overlay', er);
                    }

                    // Create a body-level red arrow (avoids clipping)
                    // arrow is a child of overlay and will be positioned by positionJumpOverlay()
                }
            } catch (err) {
                console.error('failed to add jump arrow/nudge', err);
            }
        }
    } catch (e) {
        console.error('highlightJumpDate error', e);
    }
}


// ===== Debug helpers: generate and display shift matrix (console + DOM) =====
// Usage: call `printShiftMatrix(year, month)` from DevTools console.
function generateShiftMatrix(year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const matrix = TEAMS.map(team => {
        const shifts = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            shifts.push(getShift(team.offset, date));
        }
        return { team: team.id, name: team.name, offset: team.offset, shifts };
    });
    return { year, month, daysInMonth, matrix };
}

function printShiftMatrixToConsole(year, month) {
    const result = generateShiftMatrix(year, month);
    const hdr = ['Team'].concat(Array.from({ length: result.daysInMonth }, (_, i) => String(i + 1)));
    console.log(`Shift Matrix — ${monthNames[result.month]} ${result.year}`);
    console.log(hdr.join(' | '));
    result.matrix.forEach(row => {
        console.log([row.team].concat(row.shifts).join(' | '));
    });
    return result;
}

function renderShiftMatrixToDOM(result) {
    let container = document.getElementById('matrixDebug');
    if (!container) {
        container = document.createElement('div');
        container.id = 'matrixDebug';
        container.style.cssText = 'white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Helvetica Neue", monospace;padding:12px;background:#f8fafc;border-top:1px solid #e2e8f0;max-height:360px;overflow:auto;';
        document.body.appendChild(container);
    }

    const title = `Shift Matrix for ${monthNames[result.month]} ${result.year}`;
    const header = ['Team'].concat(Array.from({ length: result.daysInMonth }, (_, i) => String(i + 1))).join(' | ');
    const rows = result.matrix.map(r => [r.team].concat(r.shifts).join(' | ')).join('\n');
    container.textContent = title + '\n' + header + '\n' + rows;
    return container;
}

// Expose to window for easy use from DevTools: `printShiftMatrix()` defaults to current view month/year
window.printShiftMatrix = function(year, month) {
    const y = (typeof year === 'number') ? year : viewYear;
    const m = (typeof month === 'number') ? month : viewMonth;
    const result = printShiftMatrixToConsole(y, m);
    renderShiftMatrixToDOM(result);
    return result;
};
