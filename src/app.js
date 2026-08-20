/* ==========================================================================
   발레75 — App shell / router / action dispatcher
   ========================================================================== */

import {
  state, subscribe, commit, go, push, pop, resetStack, openSheet, closeSheet, openPopup, closePopup,
  toggleSlot, toggleWeekday, setPerWeek, clearSelection, selection, resetData, setMemberType,
  startMakeup, startCoupon, exitSingleMode, extendCoupon, buyCoupon, setShopQty,
  submitRegular, submitBooking, bookingMethods, getClass, cancelClass, cancelRegularEnrollment,
  setPrivate, resetPrivate, addPrivatePick, removePrivatePick, submitPrivateRequest,
  privateSeries, privateSlots, parseYmd as parseYmdStr,
  makeupAvailable, activeCoupons, startOfWeek, addDays, parseYmd, weekDefaultDay, EMPTY_FILTER,
} from './state.js';
import { NOW, brand, ymd, termOf, ENROLL_READY } from './data.js';
import { icons } from './ui.js';
import { homeView } from './views/home.js';
import { myClassesView } from './views/myClasses.js';
import { enrollView, singleBookingView, selectionBar } from './views/enroll.js';
import { accountView } from './views/account.js';
import { stackPage } from './views/flows.js';
import { sheetView, levelGuidePopup, makeupGuidePopup } from './views/sheets.js';

/** 가운데 확인 창 — 시트가 아니라 팝업 층에 올린다 (아래 시트가 닫히지 않게) */
const CONFIRM_POPUPS = new Set(['cancel-confirm', 'cancel-enroll']);

const root = document.getElementById('app');
const toastEl = document.getElementById('toast');

/* --- Bottom navigation (홈 / 내 수업 / 수강신청 / 마이) -------------------- */
const NAV = [
  { id: 'home', label: '홈', icon: 'home' },
  { id: 'my', label: '내 수업', icon: 'calendar' },
  { id: 'enroll', label: '수강신청', icon: 'ticket' },
  { id: 'account', label: '마이', icon: 'account' },
];

const navBar = () => `
  <nav class="nav" aria-label="주요 메뉴">
    <span class="nav__brand" aria-label="${brand.name}">
      <span class="hdr__mark-img"><img src="assets/logo-ballet75.png" alt=""></span>
    </span>
    ${NAV.map((n) => {
    const on = state.tab === n.id;
    // 탭이 실제로 바뀐 렌더에서만 팝 — 매 리렌더마다 다시 튀면 산만하다
    const pop = on && state.ui.animateNav ? ' is-pop' : '';
    return `
      <button class="nav__item${pop}" data-action="nav" data-value="${n.id}" ${on ? 'aria-current="page"' : ''}>
        ${icons[n.icon](on)}
        <span class="nav__label">${n.label}</span>
      </button>`;
  }).join('')}
  </nav>`;

/* --- Render --------------------------------------------------------------- */
let lastKey = '';

let lastSheet = null;
let lastStack = null;
let lastTab = state.tab;   // 첫 페인트에서는 팝을 재생하지 않는다

// 세그먼트 컨트롤의 직전 값 — 알약이 어디서 미끄러져 올지 알려준다
const segNow = () => ({
  my: state.my.view,
  enroll: state.enroll.view,
  single: state.enroll.singleView,
});
let lastSeg = segNow();

function render() {
  const key = [state.tab, state.my.view, state.enroll.view, state.stack.length, state.sheet?.name].join('|');
  const keepScroll = key === lastKey;
  const y = window.scrollY;

  // 같은 시트/페이지가 계속 열려 있는 동안에는 등장 애니메이션을 다시 재생하지 않는다
  const stackName = state.stack.length ? state.stack[state.stack.length - 1].name : null;
  state.ui.animateSheet = state.sheet?.name !== lastSheet;
  state.ui.animateStack = stackName !== lastStack;
  state.ui.animateNav = state.tab !== lastTab;

  const seg = segNow();
  state.ui.segFrom = {};
  for (const k of Object.keys(seg)) {
    if (seg[k] !== lastSeg[k]) state.ui.segFrom[k] = lastSeg[k];
  }

  // 열려 있는 시트의 내부 스크롤 위치를 유지한다
  const sheetTop = document.querySelector('.sheet')?.scrollTop ?? 0;
  const stackTop = document.querySelector('.stack-page')?.scrollTop ?? 0;

  const screen =
    state.tab === 'home' ? homeView() :
    state.tab === 'my' ? myClassesView() :
    state.tab === 'account' ? accountView() :
    enrollView();

  // 보강·쿠폰 단건 신청은 바텀 네비까지 덮는 풀모달로 띄운다 — X로만 나간다
  // 준비중이면 단건 신청(보강·쿠폰) 풀모달도 띄우지 않는다 — 탭이 안내로 대체된다
  const single = ENROLL_READY && state.enroll.mode === 'single'
    ? `<div class="fullmodal fullmodal--under">${singleBookingView()}</div>`
    : '';
  const stack = state.stack.length ? stackPage(state.stack[state.stack.length - 1]) : '';
  const sheet = state.sheet ? sheetView(state.sheet) : '';
  const popup = state.popup?.name === 'level-guide' ? levelGuidePopup(state.popup.props)
    : CONFIRM_POPUPS.has(state.popup?.name) ? sheetView(state.popup)
    : state.popup?.name === 'makeup-guide' ? makeupGuidePopup()
      : '';

  root.innerHTML = `<div class="screen">${screen}</div>${selectionBar()}${navBar()}${single}${stack}${sheet}${popup}`;
  lastKey = key;

  if (!state.ui.animateSheet) {
    const el = document.querySelector('.sheet');
    if (el) el.scrollTop = sheetTop;
  }
  if (!state.ui.animateStack) {
    const el = document.querySelector('.stack-page');
    if (el) el.scrollTop = stackTop;
  }
  // 수업 상세에서 특정 레벨을 보고 들어왔으면 그 레벨이 보이게 맞춘다
  if (state.ui.animatePopup !== false) {
    const focused = document.querySelector('.popup .guide.is-focus');
    if (focused) focused.scrollIntoView({ block: 'center' });
  }

  // 팝업 헤더 — 내용이 밑으로 들어갔을 때만 구분선을 켠다
  const popBody = document.querySelector('.popup__body');
  if (popBody) {
    const head = document.querySelector('.popup__header');
    const sync = () => head?.classList.toggle('is-stuck', popBody.scrollTop > 0);
    popBody.addEventListener('scroll', sync, { passive: true });
    sync();
  }

  // 캐러셀 — 스크롤에 맞춰 점 표시를 옮긴다 (수강권 카드 · 홈 알림)
  // 한 화면에 캐러셀이 둘 이상일 수 있으므로 묶음 안에서만 짝을 찾는다
  for (const wrap of document.querySelectorAll('.passwrap')) {
    const track = wrap.querySelector('.passlist');
    const dots = [...wrap.querySelectorAll('.passdot')];
    if (!track || !dots.length) continue;
    // 점은 페이지 단위 — 보이는 폭만큼 넘어갈 때마다 하나씩 옮긴다
    track.addEventListener('scroll', () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach((d, n) => d.classList.toggle('is-on', n === Math.min(i, dots.length - 1)));
    }, { passive: true });
  }

  lastSheet = state.sheet?.name ?? null;
  lastStack = stackName;
  lastTab = state.tab;
  lastSeg = seg;

  if (keepScroll) window.scrollTo(0, y);
  else if (!state.sheet) window.scrollTo(0, 0);

  document.body.style.overflow = (state.sheet || state.stack.length || state.popup || single) ? 'hidden' : '';

  syncThemeColor();

  queueHistorySync();
}

/**
 * 브라우저 상단(주소창·상태 표시줄) 색을 화면과 맞춘다.
 * 스크림이 깔리면 본문은 어두워지는데 theme-color가 고정이면 경계가 드러난다.
 * 딤 색은 흰 배경(#FFF) 위에 rgba(0,0,0,.2)를 올린 결과다 → #CCCCCC
 */
const themeMeta = document.querySelector('meta[name="theme-color"]');
const THEME = { plain: '#FFFFFF', dim: '#CCCCCC' };

function syncThemeColor() {
  // 전체 화면을 덮는 흰 팝업(레벨 안내)만 딤이 아니다
  const dimmed = state.popup
    ? state.popup.name !== 'level-guide'
    : Boolean(state.sheet);
  const next = THEME[dimmed ? 'dim' : 'plain'];
  if (themeMeta && themeMeta.content !== next) themeMeta.content = next;
}

subscribe(render);

/* --- 바텀시트 닫기 --------------------------------------------------------
   grip은 탭하면 닫히고(위임된 close-sheet), 아래로 끌어내려도 닫힌다.
   화면이 통째로 다시 그려지므로 핸들러는 document에 한 번만 건다.        */
const CLOSE_RATIO = 0.28;   // 시트 높이의 28% 넘게 내려가면 닫는다
let drag = null;

document.addEventListener('pointerdown', (e) => {
  const grip = e.target.closest?.('.sheet__grip');
  if (!grip) return;
  drag = { sheet: grip.closest('.sheet'), y0: e.clientY, dy: 0, moved: false };
  drag.sheet.style.transition = 'none';
  grip.setPointerCapture?.(e.pointerId);
});

document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  drag.dy = Math.max(0, e.clientY - drag.y0);   // 위로는 끌리지 않는다
  if (drag.dy > 4) drag.moved = true;
  drag.sheet.style.transform = `translateY(${drag.dy}px)`;
});

function endDrag() {
  if (!drag) return;
  const { sheet, dy, moved } = drag;
  drag = null;
  // 탭(= 안 움직임)은 위임된 close-sheet가 처리한다. 여기서는 끌어낸 경우만 본다.
  if (moved && dy > sheet.getBoundingClientRect().height * CLOSE_RATIO) return closeSheet();
  sheet.style.transition = 'transform .22s cubic-bezier(.32,.72,0,1)';
  sheet.style.transform = '';
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

/* --- 레이어 스택과 뒤로가기 ------------------------------------------------
   화면 위에 겹치는 것들(단건 신청 · 스택 페이지 · 시트 · 팝업)을 하나의
   "깊이"로 보고, 그 깊이를 브라우저 history 길이와 맞춘다.
   그래야 안드로이드 뒤로가기가 앱을 벗어나지 않고 위에서부터 한 겹씩 닫는다. */

/** 위에 떠 있는 것부터 하나씩 — z-order와 같은 순서다 */
function closeTopLayer() {
  if (state.popup) return closePopup();
  if (state.sheet) return closeSheet();
  if (state.stack.length) return pop();
  if (state.enroll.mode === 'single') return exitSingleMode();
  return undefined;
}

const layerDepth = () =>
  (state.enroll.mode === 'single' ? 1 : 0)
  + state.stack.length
  + (state.sheet ? 1 : 0)
  + (state.popup ? 1 : 0);

let histDepth = 0;      // history에 쌓아둔 레이어 수
let rewinding = 0;      // 우리가 history.go로 되감는 중인 칸 수
let fromBack = false;   // 지금 닫는 주체가 뒤로가기다 — history를 건드리지 않는다

function syncHistory() {
  const d = layerDepth();
  if (fromBack) { histDepth = d; return; }
  try {
    if (d > histDepth) {
      for (let i = histDepth; i < d; i++) history.pushState({ b75: true }, '');
    } else if (d < histDepth) {
      const n = histDepth - d;
      rewinding += n;
      history.go(-n);
    }
  } catch { /* history를 못 쓰는 환경이면 그냥 넘어간다 */ }
  histDepth = d;
}

/* 한 액션 안에서 시트를 닫고 스택을 여는 경우가 있다(예: to-confirm).
   렌더마다 맞추면 그 중간 상태까지 history에 남으므로, 최종 깊이만 반영한다. */
let syncQueued = false;
function queueHistorySync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => { syncQueued = false; syncHistory(); });
}

window.addEventListener('popstate', () => {
  if (rewinding > 0) { rewinding -= 1; return; }   // 우리가 되감은 것
  // 사용자가 뒤로가기를 눌렀다 — 브라우저가 이미 한 칸 뺐다
  histDepth = Math.max(0, histDepth - 1);
  fromBack = true;
  closeTopLayer();
  fromBack = false;
});

/* Escape — 뒤로가기와 같은 순서로 닫는다 */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeTopLayer();
});

/* --- Toast ---------------------------------------------------------------- */
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
}

/* --- 데이터 로딩 시뮬레이션 (Skeleton → Content) --------------------------- */
function load(delay = 900) {
  state.booting = true;
  state.loadError = false;
  commit();
  setTimeout(() => { state.booting = false; commit(); }, delay);
}

/* --- Actions -------------------------------------------------------------- */
/** 단건 신청 캘린더에서 주 단위로 이동 */
function shiftDay(days) {
  const base = state.enroll.day ? parseYmd(state.enroll.day) : NOW;
  return ymd(addDays(base, days));
}

function resetPicks() {
  state.enroll.selectedSlots = [];
  state.enroll.weekdays = [];
  commit();
}

/**
 * 주를 넘길 때 선택일도 그 주로 옮긴다.
 * 안 옮기면 캘린더엔 아무 날도 안 눌린 채 목록만 떠서 기준점이 사라진다.
 * (월간의 selectedDay()와 같은 규칙)
 */
function shiftWeek(days) {
  const start = addDays(state.my.weekStart, days);
  state.my.weekStart = start;
  state.my.day = ymd(weekDefaultDay(start));
  commit();
}

function shiftPrivateMonth(step) {
  const next = state.private.month + step;
  if (!termOf(next)) return toast('그 달 시간표는 아직 나오지 않았어요.');
  return setPrivate({ month: next, date: null });
}

/**
 * 시각을 고르면 회차가 담긴다.
 *   1회 · 직접 선택 — 그 한 칸
 *   반복 예약       — 같은 요일·시각으로 count회. 안 되는 주는 빼고 담는다
 */
function addPrivateSlot(start) {
  const p = state.private;
  const d = parseYmdStr(p.date);
  const room = privateSlots(d, { dur: p.dur }).find((s) => s.start === start)?.room ?? null;

  if (p.mode === 'series' && p.seriesMode === 'repeat') {
    const weeks = privateSeries({
      from: d, start, count: p.count, every: p.every, dur: p.dur,
    });
    const ok = weeks.filter((w) => w.ok);
    setPrivate({ picks: ok.map((w) => ({ ymd: ymd(w.date), start, room: w.room })) });
    if (ok.length < weeks.length) toast(`${p.count}회 중 ${ok.length}회만 자리가 있어요.`);
    return;
  }
  if (p.mode === 'once') {
    setPrivate({ picks: [{ ymd: p.date, start, room }] });
    return;
  }
  if (!addPrivatePick({ ymd: p.date, start, room })) toast('이미 담은 시간이에요.');
}

const actions = {
  nav: (el) => go(el.dataset.value),
  back: () => pop(),
  'close-sheet': () => closeSheet(),
  retry: () => load(800),

  /* 홈 */
  'go-enroll': () => go('enroll'),
  'go-next-month': () => {
    state.enroll.month = NOW.getMonth() + 1;
    state.enroll.weekdays = [];
    state.enroll.selectedSlots = [];
    go('enroll');
  },
  'go-my': () => { exitSingleMode(); go('my'); },
  'go-my-status': () => { go('account'); openSheet('usage', { kind: 'regular' }); },
  'open-regular': (el) => openSheet('usage', { kind: 'regular', month: el.dataset.id || undefined }),
  'open-coupon': (el) => openSheet('usage', { kind: 'coupon', id: el.dataset.id }),
  'open-payments': () => openSheet('history', { kind: 'payments' }),
  noop: () => toast('프로토타입에서는 준비 중인 기능이에요.'),

  'find-makeup': () => {
    if (makeupAvailable() <= 0) return toast('신청할 수 있는 보강이 없어요.');
    startMakeup();
  },
  'use-coupon': (el) => {
    const id = el.dataset.id || activeCoupons()[0]?.id;
    if (!id) return toast('사용할 수 있는 쿠폰이 없어요.');
    startCoupon(id);
  },
  'extend-coupon': (el) => {
    if (!extendCoupon(el.dataset.id)) return toast('연장할 수 없는 쿠폰이에요.');
    toast('쿠폰 기간을 7일 연장했어요.');
  },
  'level-guide': (el) => openPopup('level-guide', { focus: el.dataset.name || null }),
  'makeup-guide': () => openPopup('makeup-guide'),
  'close-popup': () => closePopup(),
  'coupon-shop': () => openSheet('coupon-shop'),
  'shop-inc': (el) => setShopQty(el.dataset.kind, (state.shop[el.dataset.kind] ?? 0) + 1),
  'shop-dec': (el) => setShopQty(el.dataset.kind, (state.shop[el.dataset.kind] ?? 0) - 1),

  // 두 종류를 한 번에 담을 수 있으므로 담긴 것만 순서대로 발급한다
  'buy-coupon': () => {
    const bought = [];
    for (const [kind, qty] of Object.entries(state.shop)) {
      if (qty <= 0) continue;
      const result = buyCoupon(kind, qty);
      if (!result) return toast('이 수량은 구매할 수 없어요.');
      bought.push(result.coupon.name);
    }
    if (!bought.length) return toast('수량을 골라주세요.');
    state.shop = { general: 0, stretching: 0 };
    closeSheet();
    toast(`${bought.join(' · ')}을 구매했어요.`);
  },

  /* 내 수업 */
  'my-view': (el) => { state.my.view = el.dataset.value; commit(); },
  'week-prev': () => shiftWeek(-7),
  'week-next': () => shiftWeek(7),
  'month-prev': () => { state.my.month -= 1; commit(); },
  'month-next': () => { state.my.month += 1; commit(); },
  'my-today': () => {
    state.my.weekStart = startOfWeek(NOW);
    state.my.month = NOW.getMonth();
    state.my.day = ymd(NOW);
    commit();
  },
  'pick-my-day': (el) => { state.my.day = el.dataset.day; commit(); },
  // 주간 스트립 — 고른 날을 표시하고(핑크) 그 날 묶음으로 스크롤한다
  'scroll-day': (el) => {
    state.my.day = el.dataset.day;
    commit();
    const target = document.getElementById(`day-${el.dataset.day}`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  /* 개인레슨 예약 */
  'go-private': () => { resetPrivate(); push('private'); },
  // 홈 알림에서 들어오면 예약이 아니라 결과를 보러 온 것이다
  'go-private-requests': () => { resetPrivate(); setPrivate({ tab: 'requests' }); push('private'); },
  'private-tab': (el) => setPrivate({ tab: el.dataset.value }),
  'private-cond': () => openSheet('private-cond'),
  'private-mode': (el) => setPrivate({ mode: el.dataset.value }),
  'private-series-mode': (el) => setPrivate({ seriesMode: el.dataset.value }),
  'private-dur': (el) => setPrivate({ dur: Number(el.dataset.value) }),
  'private-every': (el) => setPrivate({ every: Number(el.dataset.value) }),
  'private-count': (el) => setPrivate({ count: Number(el.dataset.value) }),
  // 시간표가 있는 달 밖으로는 나가지 않는다 — 그 밖은 '비어 있는' 게 아니라 '모르는' 것이다
  'private-month-prev': () => shiftPrivateMonth(-1),
  'private-month-next': () => shiftPrivateMonth(1),
  'private-day': (el) => setPrivate({ date: el.dataset.day }),
  'private-time': (el) => addPrivateSlot(Number(el.dataset.value)),
  'private-remove-pick': (el) => removePrivatePick(el.dataset.value),
  'private-submit': (el) => {
    if (!state.private.picks.length) return openSheet('private-cond');
    setPrivate({ teacher: el.dataset.value || null });
    const r = submitPrivateRequest();
    return toast(r ? '개인레슨 요청을 보냈어요. 승인되면 결제 안내를 드려요.' : '시간을 먼저 골라 주세요.');
  },

  'ask-cancel-enroll': (el) => openPopup('cancel-enroll', { month: el.dataset.month }),
  'do-cancel-enroll': (el) => {
    const m = Number(el.dataset.month);
    if (!cancelRegularEnrollment(m)) return toast('신청 기간이 지나 앱에서는 취소할 수 없어요.');
    closePopup();
    closeSheet();
    toast(`${m + 1}월 수강신청을 취소했어요.`);
  },

  /* 수강신청 */
  'enroll-month': (el) => {
    // 월이 바뀌면 그 달의 회차가 달라지므로 담은 반을 비운다
    state.enroll.month = Number(el.dataset.value);
    state.enroll.day = null;
    state.enroll.weekdays = [];
    state.enroll.selectedSlots = [];
    commit();
  },
  'enroll-view': (el) => {
    state.enroll.view = el.dataset.value;
    // 시간표로 돌아올 때는 캘린더에서 고른 요일 포커스를 해제한다 (보이지 않는 필터 방지)
    if (state.enroll.view !== 'calendar') state.enroll.day = null;
    commit();
  },
  'cal-weekday': (el) => {
    const result = toggleWeekday(Number(el.dataset.value));
    if (result === 'closed') return toast('아직 신청이 열리지 않았어요.');
    if (result === 'limit') {
      toast(`주 ${state.enroll.perWeek}회로 설정되어 있어요. 요일을 해제하거나 횟수를 바꿔주세요.`);
    }
  },
  'per-week': (el) => setPerWeek(Number(el.dataset.value)),

  /* 단건 신청(보강·쿠폰) 캘린더 */
  'single-view': (el) => { state.enroll.singleView = el.dataset.value; commit(); },
  'single-day': (el) => { state.enroll.day = el.dataset.day; commit(); },
  'single-week-prev': () => { state.enroll.day = shiftDay(-7); commit(); },
  'single-week-next': () => { state.enroll.day = shiftDay(7); commit(); },
  'open-filter': () => openSheet('filter'),
  'set-filter': (el) => {
    const { key, value } = el.dataset;
    const arr = state.enroll.filter[key];
    const i = arr.indexOf(value);
    if (i >= 0) arr.splice(i, 1); else arr.push(value);
    commit();
  },
  'clear-filter': (el) => { state.enroll.filter[el.dataset.key] = []; commit(); },
  'reset-filter': () => { state.enroll.filter = { ...EMPTY_FILTER }; commit(); },
  'exit-makeup': () => { exitSingleMode(); go('enroll'); },

  'class-detail': (el) => openSheet('class-detail', { id: el.dataset.id }),

  /* 정규 — 반(요일) 단위로 담기 */
  'pick-slot': (el) => {
    const result = toggleSlot(el.dataset.key);
    if (result === 'closed') return toast('아직 신청이 열리지 않았어요.');
    if (result === 'limit') {
      toast(`주 ${state.enroll.perWeek}회로 설정되어 있어요. 횟수를 바꾸거나 담은 수업을 빼주세요.`);
    }
  },
  'unpick-slot': (el) => {
    toggleSlot(el.dataset.key);
    if (!state.enroll.selectedSlots.length) closeSheet();
  },

  /* 보강 · 쿠폰 — 날짜 단건 선택 */
  'pick-single': (el) => push('makeup-confirm', { classId: el.dataset.id }),
  'pick-makeup': (el) => { closeSheet(); push('makeup-confirm', { classId: el.dataset.id }); },
  'open-selected': () => openSheet('selected'),
  'clear-selection': () => { clearSelection(); closeSheet(); },
  'to-confirm': () => {
    const { left, perWeek } = selection();
    if (left) return toast(`주 ${perWeek}회 수강권이라 ${left}개 더 담아야 해요.`);
    closeSheet(); push('confirm');
  },

  'submit-regular': () => {
    const receipt = submitRegular();
    if (receipt === false) { state.stack = [{ name: 'submit-error', props: {} }]; return commit(); }
    state.stack = [{ name: 'complete', props: { receipt } }];
    commit();
  },
  'back-to-enroll': () => { resetStack(); openSheet('selected'); },
  'continue-enroll': () => { resetStack(); go('enroll'); },

  /* 취소 → 보강 */
  'ask-cancel': (el) => openPopup('cancel-confirm', { id: el.dataset.id }),
  'do-cancel': (el) => {
    const result = cancelClass(el.dataset.id);
    closePopup();
    closeSheet();
    if (!result) return toast('당일 수업은 취소할 수 없어요.');
    state.stack = [{ name: 'cancel-complete', props: { type: result.type } }];
    commit();
  },
  // 신청 수단(보강/쿠폰)을 고른다
  'pick-method': (el) => {
    state.enroll.payWith = el.dataset.kind === 'coupon'
      ? { kind: 'coupon', couponId: el.dataset.coupon }
      : { kind: 'makeup' };
    commit();
  },
  'submit-booking': (el) => {
    const id = el.dataset.id;
    const c = getClass(id);
    const picked = state.enroll.payWith;
    const methods = bookingMethods(c);
    const method = methods.find((m) => m.enabled && (picked?.kind === 'coupon'
      ? m.kind === 'coupon' && m.couponId === picked.couponId
      : m.kind === picked?.kind)) || methods.find((m) => m.enabled);
    if (!method || !submitBooking(id, method)) return toast('신청하지 못했어요.');
    state.enroll.mode = 'regular';
    state.enroll.payWith = null;
    state.stack = [{ name: 'makeup-complete', props: { classId: id, method: method.label } }];
    commit();
  },

  /* 프로토타입 상태 데모 */
  'demo-reset': () => { resetData(); toast('취소·보강·쿠폰을 처음 상태로 되돌렸어요.'); },
  'demo-loading': () => { go('home'); load(1400); },
  'demo-error': () => { go('home'); state.loadError = true; state.booting = false; commit(); },
  'demo-submit-fail': () => { state.demo.failNextSubmit = !state.demo.failNextSubmit; commit(); },
  'demo-member': (el) => { setMemberType(el.dataset.value); resetPicks(); },
  'demo-after-open': () => { state.demo.afterOpen = !state.demo.afterOpen; resetPicks(); },
  'demo-mid-month': () => { state.demo.allowMidMonth = !state.demo.allowMidMonth; resetPicks(); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  e.preventDefault();
  fn(el);
});

/* --- Boot ----------------------------------------------------------------- */
render();
load(900);
