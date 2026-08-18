/* ==========================================================================
   발레75 — Application state
   프레임워크 없이 동작하는 단일 store. 상태 변경 → render 구독자 호출.
   ========================================================================== */

import {
  classes, classById, seed, user, NOW, ymd,
  ENROLLMENT_OPEN_DAY, ENROLLMENT_OPEN_HOUR, ALLOW_MID_MONTH_ENROLLMENT,
  REGULAR_PRICE, cancelLimitFor, STRETCHING_CLASS, SPECIAL_CLASS, COUPON_EXTEND, COUPON_PRICE,
  COUPON_VALID_DAYS, termOf,
  COUPON_SEATS, PASS_BADGE_DAYS,
  INSTRUCTORS, PRIVATE_HOURS, PRIVATE_DURATIONS, PRIVATE_PRICE, ROOMS,
} from './data.js';

/* --- store ---------------------------------------------------------------- */
const listeners = new Set();

export const state = {
  booting: true,          // 최초 로딩 (skeleton)
  loadError: false,       // 데이터 로딩 실패 (Error state)

  tab: 'home',            // home | my | enroll
  stack: [],              // 전체 화면 스택: { name, props }
  sheet: null,            // 바텀시트: { name, props }
  popup: null,            // 시트 위에 겹쳐 뜨는 작은 창: { name, props }

  my: {
    // 데스크톱은 캘린더가 왼쪽 단을 통째로 쓰므로 월간이 기본
    // (styles.css의 1024px 브레이크포인트와 같은 기준)
    view: window.innerWidth >= 1024 ? 'month' : 'week',   // week | month
    weekStart: startOfWeek(NOW),
    month: NOW.getMonth(),     // 월간 뷰에서 보고 있는 달
    day: ymd(NOW),             // 캘린더에서 고른 날짜
  },

  enroll: {
    month: NOW.getMonth() + 1,  // 기본은 신청 대상인 다음 달
    view: 'grid',         // grid(주간 시간표) | timetable(목록) | calendar
    mode: 'regular',      // regular | makeup

    // 정규 — 요일(반) 단위로 담는다. 회차는 선택한 반을 따라간다.
    perWeek: 2,           // 주 몇 회
    selectedSlots: [],    // slot key[]
    weekdays: [],         // 선택한 요일 (0=일 … 6=토) — 주 N회만큼 고를 수 있다

    // 단건 신청(보강·쿠폰) — 날짜 단위로 고르고, 신청할 때 수단을 정한다
    payWith: null,        // 진입 시 기본으로 잡아둘 수단 { kind, couponId }
    singleView: 'week',   // week | month — 단건 신청 캘린더 보기
    day: null,            // 캘린더에서 선택한 날짜

    filter: { weekday: [], level: [], instructor: [] },
    submitError: false,   // 신청 실패 상태
  },

  // 렌더 보조 — 이미 열려 있는 시트/페이지는 등장 애니메이션을 다시 재생하지 않는다
  ui: { animateSheet: true, animateStack: true },

  // 쿠폰 구매 시트 — 종류별 수량을 각각 담는다
  shop: { general: 0, stretching: 0 },

  // 개인레슨 예약 — 후보를 담아 요청으로 보낸다
  private: {
    tab: 'book',        // book | requests
    mode: 'once',       // once | series
    seriesMode: 'repeat', // repeat(반복 예약) | manual(직접 여러 개 선택)
    dur: 60,
    every: 1,           // 반복 주기 — 1(매주) | 2(격주)
    count: 4,           // 반복 회차
    month: NOW.getMonth(),   // 조건 시트 캘린더가 보고 있는 달
    date: null,         // 'YYYY-MM-DD'
    picks: [],          // [{ ymd, start, room }]
    teacher: null,      // 조건을 반영한 뒤 고른 선생님 (null = 학원 추천)
  },

  // 프로토타입 상태 데모 스위치
  demo: { failNextSubmit: false, memberType: 'auto', afterOpen: false, allowMidMonth: ALLOW_MID_MONTH_ENROLLMENT },

  data: {
    enrollments: seed.enrollments.map((e) => ({ ...e })),
    coupons: seed.coupons.map((c) => ({ ...c })),
    makeupHistory: seed.makeupHistory.map((c) => ({ ...c })),
    payments: seed.payments.map((c) => ({ ...c })),
    privateRequests: [],
  },
};

/**
 * 데모 회원 유형 전환.
 * 플래그만 바꾸면 신규 회원인데 보강·쿠폰·오늘 수업이 남아 화면이 모순된다.
 * 신규는 수강 이력이 없는 사람이므로 데이터까지 함께 비운다.
 */
export function setMemberType(kind) {
  state.demo.memberType = kind;
  state.data = kind === 'new'
    ? { enrollments: [], coupons: [], makeupHistory: [], payments: [], privateRequests: [] }
    : {
      enrollments: seed.enrollments.map((e) => ({ ...e })),
      coupons: seed.coupons.map((c) => ({ ...c })),
      makeupHistory: seed.makeupHistory.map((c) => ({ ...c })),
      payments: seed.payments.map((c) => ({ ...c })),
      privateRequests: [],
    };
  commit();
}

/** 프로토타입 상태를 시드로 되돌린다 — 취소·보강·쿠폰을 다 써도 다시 확인할 수 있게 */
export function resetData() {
  state.data = {
    enrollments: seed.enrollments.map((e) => ({ ...e })),
    coupons: seed.coupons.map((c) => ({ ...c })),
    makeupHistory: seed.makeupHistory.map((c) => ({ ...c })),
    payments: seed.payments.map((c) => ({ ...c })),
    privateRequests: [],
  };
  state.stack = [];
  state.sheet = null;
  commit();
}

export function subscribe(fn) { listeners.add(fn); }
export function commit() { listeners.forEach((fn) => fn()); }

/* --- 날짜 유틸 ------------------------------------------------------------ */
const WD = ['일', '월', '화', '수', '목', '금', '토'];

/** 주의 시작은 일요일 — 캘린더·시간표 전부 일~토로 읽는다 */
export function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
}
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const isSameDay = (a, b) => ymd(a) === ymd(b);
export const wd = (d) => WD[d.getDay()];
export const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
export const timeRange = (c) => `${hhmm(c.startAt)}~${hhmm(c.endAt)}`;
export const fmtFullDate = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일 ${wd(d)}요일`;
export const fmtDateShort = (d) => `${d.getMonth() + 1}/${d.getDate()} ${wd(d)}`;
export const fmtMD = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일`;
/** 이용 내역 날짜 — 8월 10일 (월) */
export const fmtMDDow = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일 (${wd(d)})`;
/** 수강권 기간 표기 — 2026. 8. 4 */
export const fmtYMD = (d) => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
export const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const won = (n) => n.toLocaleString('ko-KR') + '원';

/**
 * 필터 기본값 — 항목마다 여러 개를 고를 수 있다 (빈 배열 = 전체).
 * 같은 항목 안에서는 OR, 항목끼리는 AND로 걸린다.
 * 시간대는 두지 않는다 — 목록에 시간이 그대로 보인다.
 */
export const EMPTY_FILTER = { weekday: [], level: [], instructor: [] };
export const filterChipCount = () =>
  Object.values(state.enroll.filter).reduce((n, arr) => n + arr.length, 0);

/* --- selectors ------------------------------------------------------------ */
export const getClass = (id) => classById.get(id);

export function enrollmentOf(classId) {
  return state.data.enrollments.find((e) => e.classId === classId && e.status !== 'cancelled');
}

export const myEnrolledClasses = () =>
  state.data.enrollments
    .filter((e) => e.status === 'confirmed' || e.status === 'pending')
    .map((e) => ({ ...classById.get(e.classId), enrollment: e }))
    .filter((c) => c.id)
    .sort((a, b) => a.startAt - b.startAt);

/* --- 취소와 보강 -------------------------------------------------------------
   주 N회 수강권은 한 달에 N번까지 취소할 수 있고,
   취소한 횟수만큼 기간 안에 다른 수업을 보강으로 신청할 수 있다.
   신청·취소 모두 수업 하루 전날 자정까지 — 당일은 불가하다.
   -------------------------------------------------------------------------- */

const monthOf = (e) => classById.get(e.classId)?.startAt.getMonth();

/** 그 달에 등록한 정규 반 수 = 주 N회 */
export function myPerWeek(month = NOW.getMonth()) {
  const keys = new Set();
  for (const e of state.data.enrollments) {
    if (e.type !== 'regular' || monthOf(e) !== month) continue;
    if (e.status === 'rejected') continue;
    keys.add(slotKeyOf(classById.get(e.classId)));
  }
  return keys.size;
}

/** 그 달 취소 한도 = 주 N회 */
export const cancelLimit = (month = NOW.getMonth()) => cancelLimitFor(myPerWeek(month));

/** 취소한 만큼 보강으로 신청할 수 있다 — 보강 한도는 취소 한도와 같다 */
export const makeupQuota = (month = NOW.getMonth()) => cancelLimit(month);

export const makeupUsed = (month = NOW.getMonth()) =>
  state.data.enrollments.filter((e) => e.type === 'makeup' && e.status !== 'cancelled' && monthOf(e) === month).length;

export const cancelledCount = (month = NOW.getMonth()) =>
  state.data.enrollments.filter((e) => e.type === 'regular' && e.status === 'cancelled' && monthOf(e) === month).length;

/** 남은 취소 횟수 */
export const cancelLeft = (month = NOW.getMonth()) =>
  Math.max(0, cancelLimit(month) - cancelledCount(month));

/** 지금 신청할 수 있는 보강 횟수 — 취소한 만큼에서 이미 쓴 보강을 뺀다 */
export function makeupAvailable(month = NOW.getMonth()) {
  return Math.max(0, Math.min(cancelledCount(month), makeupQuota(month)) - makeupUsed(month));
}

/**
 * 하루 전날 자정까지 — 보강 신청, 수업 취소, 쿠폰 취소에 공통으로 적용된다.
 * 당일은 신청도 취소도 불가하다.
 */
export function beforeDeadline(c) {
  const midnight = new Date(c.startAt.getFullYear(), c.startAt.getMonth(), c.startAt.getDate());
  return NOW < midnight;
}

/** 보강 신청 가능한 수업 — 마감되지 않은 반 + 하루 전날 자정까지 */
export const canBookMakeup = (c) => beforeDeadline(c) && c.seatsTaken < c.capacity;

/** 쿠폰으로 신청 가능한 수업 — 반마다 쿠폰 자리 2석 + 하루 전날 자정까지 */
export const couponSeatsLeft = (c) => Math.max(0, (c.couponCapacity ?? COUPON_SEATS) - (c.couponTaken ?? 0));
export const canBookCoupon = (c) => beforeDeadline(c) && couponSeatsLeft(c) > 0;

/** 수업 취소 가능 — 하루 전날 자정까지 + 그 달 취소 한도 안 */
export function canCancel(c) {
  const e = enrollmentOf(c.id);
  if (e?.type === 'private') return false;        // 개인레슨은 앱에서 취소하지 않는다
  if (!beforeDeadline(c)) return false;
  if (e?.type === 'coupon') return true;          // 쿠폰 수업은 취소 한도와 무관
  return cancelLeft(c.startAt.getMonth()) > 0;
}

/** 보강 사용 기한 — 그 달 종강일까지 (유효기간 정책은 확인 중) */
export const makeupDeadline = (month = NOW.getMonth()) => termOf(month).end;

/* --- 쿠폰 -------------------------------------------------------------------
   정규 등록과 별개로 구매하는 회차권. 스트레칭 쿠폰은 발레스트레칭 전용이다.
   -------------------------------------------------------------------------- */
export const couponRemaining = (c) => c.total - c.used;
export const couponExpired = (c) => parseYmd(c.expiresAt) < NOW;

export const activeCoupons = () =>
  state.data.coupons.filter((c) => couponRemaining(c) > 0 && !couponExpired(c));

/** 이 수업에 쓸 수 있는 쿠폰 종류 */
export const couponKindFor = (cls) => (cls.name === STRETCHING_CLASS ? 'stretching'
  : cls.name === SPECIAL_CLASS ? 'special' : 'general');

/** 작품반은 정규 주 N회로 담을 수 없다 — 쿠폰으로만 신청한다 */
export const isCouponOnly = (name) => name === SPECIAL_CLASS;

export const couponsFor = (cls) => activeCoupons().filter((c) => c.kind === couponKindFor(cls));

export const couponById = (id) => state.data.coupons.find((c) => c.id === id);

/**
 * 연장은 만료 '전'에만 한다 (POLICY: 7일 연장 1회, 30,000원).
 * 만료된 쿠폰은 되살릴 수 없다. 작품반 쿠폰은 수강신청에 묶여 발급되므로 제외한다.
 */
export const canExtendCoupon = (c) => c.kind !== 'special'
  && c.extended < COUPON_EXTEND.times
  && !couponExpired(c);

/** 이 쿠폰으로 아직 안 지난 수업이 잡혀 있는가 — 취소하면 그 회차가 돌아온다 */
const couponHasUpcoming = (c) => state.data.enrollments.some((e) => e.couponId === c.id
  && e.status !== 'cancelled'
  && classById.get(e.classId)?.startAt > NOW);

/**
 * 연장을 권할 때 — 만료가 코앞이고, 연장해서 살릴 회차가 있을 때만.
 * 기한 기준은 수강권 카드의 남은 일수 배지와 같다: 배지가 켜지면 연장할 수 있다.
 * 회차를 다 쓰고 예정 수업도 없으면 연장해도 쓸 게 없으므로 권하지 않는다.
 */
export const shouldOfferExtend = (c) => canExtendCoupon(c)
  && (couponRemaining(c) > 0 || couponHasUpcoming(c))
  && (parseYmd(c.expiresAt) - dayStart(NOW)) / 86400000 <= PASS_BADGE_DAYS;

/**
 * 마이 수강권 목록에 세울 쿠폰.
 * activeCoupons(= 지금 쓸 수 있는 쿠폰)보다 넓다 — 회차를 다 썼어도 예정 수업이 남아
 * 있으면 카드가 있어야 신청 내역을 열고 취소하거나 연장할 수 있다.
 */
export const myCoupons = () => state.data.coupons
  .filter((c) => !couponExpired(c) && (couponRemaining(c) > 0 || couponHasUpcoming(c)));

export const COUPON_EXTEND_INFO = COUPON_EXTEND;

/* --- 쿠폰 구매 --------------------------------------------------------------
   일반 쿠폰은 수량별 묶음가가 따로 있고, 스트레칭 쿠폰은 수량 × 단가다.
   -------------------------------------------------------------------------- */

/** 그 종류에서 고를 수 있는 수량 */
export function couponQuantities(kind) {
  const p = COUPON_PRICE[kind];
  if (!p) return [];
  return p.bundles ? Object.keys(p.bundles).map(Number).sort((a, b) => a - b) : [1, 2, 3, 4, 5, 8, 10];
}

/** 수량에 따른 총액 — 가격이 정해지지 않은 수량은 null */
export function couponPrice(kind, qty) {
  const p = COUPON_PRICE[kind];
  if (!p || qty <= 0) return null;
  if (!p.bundles) return p.unit * qty;
  return p.bundles[qty] ?? null;
}

/** 담은 수량 전체의 결제 금액 (가격 미정이 섞이면 null) */
export function shopTotal() {
  let sum = 0;
  for (const [kind, qty] of Object.entries(state.shop)) {
    if (qty <= 0) continue;
    const price = couponPrice(kind, qty);
    if (price === null) return null;
    sum += price;
  }
  return sum;
}

export const shopCount = () => Object.values(state.shop).reduce((n, q) => n + q, 0);

/** 수량 조절 — 0 아래로는 내려가지 않는다 */
export function setShopQty(kind, qty) {
  state.shop[kind] = Math.max(0, qty);
  commit();
}

/** 쿠폰 구매 — 유효기간은 등록일 기준 30일 */
export function buyCoupon(kind, qty) {
  const price = couponPrice(kind, qty);
  if (price === null) return null;
  const expires = new Date(NOW);
  expires.setDate(expires.getDate() + COUPON_VALID_DAYS);
  const coupon = {
    id: `cpn-${state.data.coupons.length + 1}-${qty}`,
    kind,
    name: `${COUPON_PRICE[kind].name} ${qty}회권`,
    total: qty,
    used: 0,
    issuedAt: ymd(NOW),
    expiresAt: ymd(expires),
    extended: 0,
  };
  state.data.coupons.push(coupon);
  state.data.payments.push({
    id: `pay-${state.data.payments.length + 1}`,
    at: ymd(NOW),
    kind: 'coupon',
    name: COUPON_PRICE[kind].name,
    qty: `${qty}회`,
    amount: price,
  });
  commit();
  return { coupon, price };
}

/**
 * 필터 조건을 적용했을 때의 결과 개수.
 * 필터 시트에서 "이 조건을 고르면 몇 개가 남는지" 미리 보여주는 데 쓴다.
 * 정규는 반(요일+시간) 개수, 보강·쿠폰은 신청 가능한 수업 회차 개수다.
 */
export function filterCount(overrides = {}) {
  const prev = state.enroll.filter;
  state.enroll.filter = { ...prev, ...overrides };
  const n = state.enroll.mode === 'regular'
    ? regularSlots().filter((s) => s.remaining.length).length
    : singleBookingList().length;
  state.enroll.filter = prev;
  return n;
}

export const filterUnit = () => (state.enroll.mode === 'regular' ? '반' : '수업');

/* --- 단건 신청 수단 (보강 / 쿠폰) -------------------------------------------
   같은 수업을 보강으로도, 쿠폰으로도 신청할 수 있다.
   대상 조건이 조금 다르므로(보강은 정규 정원, 쿠폰은 반마다 2석) 수업마다 따져본다.
   -------------------------------------------------------------------------- */
export function bookingMethods(c) {
  const month = c.startAt.getMonth();
  const inTime = beforeDeadline(c);
  const out = [];

  const makeupLeft = makeupAvailable(month);
  out.push({
    kind: 'makeup',
    label: '보강',
    detail: `${makeupLeft}회 남음`,
    enabled: inTime && makeupLeft > 0 && c.seatsTaken < c.capacity,
    reason: !inTime ? '당일 신청 불가'
      : makeupLeft <= 0 ? '남은 보강 없음'
        : c.seatsTaken >= c.capacity ? '반 마감' : '',
  });

  // 이 수업에 쓸 수 있는 종류의 쿠폰만 후보로 둔다 (발레스트레칭은 스트레칭 쿠폰)
  const kind = couponKindFor(c);
  const seats = couponSeatsLeft(c);
  for (const coupon of state.data.coupons) {
    if (coupon.kind !== kind) continue;
    const left = couponRemaining(coupon);
    out.push({
      kind: 'coupon',
      couponId: coupon.id,
      label: coupon.name,
      detail: `${left}회 남음`,
      enabled: inTime && left > 0 && !couponExpired(coupon) && seats > 0,
      reason: !inTime ? '당일 신청 불가'
        : couponExpired(coupon) ? '기간 만료'
          : left <= 0 ? '남은 횟수 없음'
            : seats <= 0 ? '쿠폰 자리 마감' : '',
    });
  }
  return out;
}

/** 그 수업을 신청할 수 있는 수단 이름들 (목록 카드에 표시) */
export const bookingMethodNames = (c) => {
  const ms = bookingMethods(c).filter((m) => m.enabled);
  const names = [];
  if (ms.some((m) => m.kind === 'makeup')) names.push('보강');
  if (ms.some((m) => m.kind === 'coupon')) names.push('쿠폰');
  return names;
};

/** 수업 + 수단으로 신청 */
export function submitBooking(classId, method) {
  if (!method) return false;
  return method.kind === 'makeup'
    ? submitMakeup(classId)
    : submitCoupon(classId, method.couponId);
}

/* --- 수강료 ----------------------------------------------------------------- */
export const regularPrice = (perWeek) => REGULAR_PRICE[perWeek] || null;

export const todayClasses = () => myEnrolledClasses().filter((c) => isSameDay(c.startAt, NOW));

export const upcomingClasses = () => myEnrolledClasses().filter((c) => c.startAt > NOW);

/** 그 달 내 수업 전부 — 지난 수업도 포함한다 (비활성으로 보여준다) */
export const monthClasses = (month) =>
  myEnrolledClasses().filter((c) => c.startAt.getMonth() === month);

export const nextClass = () => upcomingClasses()[0] || null;

export function weekClasses(weekStart) {
  const end = addDays(weekStart, 7);
  return myEnrolledClasses().filter((c) => c.startAt >= weekStart && c.startAt < end);
}

function passesFilter(c) {
  const { weekday, level, instructor } = state.enroll.filter;
  if (weekday.length && !weekday.includes(wd(c.startAt))) return false;
  if (level.length && !level.includes(c.name)) return false;
  if (instructor.length && !instructor.includes(c.instructor)) return false;
  return true;
}

/**
 * 단건 신청(보강·쿠폰) 목록 — 그 달에서 신청할 수 있는 수업 전부.
 * 날짜 필터는 캘린더에서 따로 적용한다.
 */
export function singleBookingList() {
  const { month } = state.enroll;
  return classes.filter((c) => {
    if (c.type !== 'regular') return false;
    if (c.startAt.getMonth() !== month) return false;
    if (!passesFilter(c)) return false;
    if (enrollmentOf(c.id)) return false;                 // 이미 듣는 수업 제외
    return bookingMethods(c).some((m) => m.enabled);
  });
}

/** 캘린더에서 고른 날짜 — 없거나 수업이 없으면 신청 가능한 첫 날로 */
export function singleSelectedDay(list) {
  const days = [...new Set(list.map((c) => ymd(c.startAt)))].sort();
  if (state.enroll.day && days.includes(state.enroll.day)) return state.enroll.day;
  return days[0] || null;
}

/* --- 수강신청 오픈 (운영 정책) ---------------------------------------------
   다음달 정규반 신청은 현재달 20일(기존 회원) / 22일(신규 회원)에 열린다.
   기존 회원 = 지난달에 수업을 들었던 사람 (회원가입 여부와 무관).
   -------------------------------------------------------------------------- */

/** 지난달(현재달의 직전 달)에 수강 이력이 있으면 기존 회원 */
export function isReturningMember() {
  if (state.demo.memberType !== 'auto') return state.demo.memberType === 'returning';
  const prev = NOW.getMonth() - 1;
  return state.data.enrollments.some((e) => {
    if (e.status !== 'confirmed') return false;
    const c = classById.get(e.classId);
    return c && c.type !== 'private' && c.startAt.getMonth() === prev;
  });
}

/** 해당 월 신청이 열리는 시각 — 그 달의 전달 20일 / 22일 오전 9시 */
export function openDateFor(month) {
  const day = isReturningMember() ? ENROLLMENT_OPEN_DAY.returning : ENROLLMENT_OPEN_DAY.new;
  return new Date(2026, month - 1, day, ENROLLMENT_OPEN_HOUR, 0, 0);
}

/**
 * 월별 신청 창 상태
 *   다음달 신청 기간 = 이번 달 20일(기존) / 22일(신규) ~ 이번 달 말일
 *
 * past     — 지난 달
 * current  — 진행 중인 달. 신청 기간은 이미 끝났고, 중도 등록 허용 여부는 정책 대기
 * upcoming — 다음 달. 오픈일부터 말일까지 열린다
 */
export function enrollmentWindow(month = state.enroll.month) {
  const openAt = openDateFor(month);                       // 전달 20일 / 22일
  const closeAt = new Date(2026, month, 0, 23, 59, 59);    // 전달 말일

  if (month < NOW.getMonth()) return { kind: 'past', open: false, openAt, closeAt };

  if (month === NOW.getMonth()) {
    return { kind: 'current', open: state.demo.allowMidMonth, openAt, closeAt };
  }

  const open = state.demo.afterOpen || (NOW >= openAt && NOW <= closeAt);
  // 달력 기준으로 센다 — 시각 차로 계산하면 오픈 당일 아침(9시 전)에도 "1일 남음"이 된다
  const daysLeft = Math.max(0, Math.round((dayStart(openAt) - dayStart(NOW)) / 86400000));
  return {
    kind: 'upcoming', open, openAt, closeAt, daysLeft,
    returning: isReturningMember(),
    otherDay: isReturningMember() ? ENROLLMENT_OPEN_DAY.new : ENROLLMENT_OPEN_DAY.returning,
  };
}

/* --- 정규 슬롯(반) ---------------------------------------------------------
   정규 신청의 선택 단위는 개별 날짜가 아니라 "요일 + 시간의 반"이다.
   반을 담으면 그 달의 남은 회차가 함께 따라온다.
   -------------------------------------------------------------------------- */
export const slotKeyOf = (c) => `${c.startAt.getDay()}|${hhmm(c.startAt)}|${c.name}`;

const WEEK_ORDER = (day) => day;   // 0=일 … 6=토 — 일요일 시작

/** 해당 월에 열리는 정규 반 목록 (필터 반영) */
export function regularSlots(month = state.enroll.month, { filtered = true } = {}) {
  const map = new Map();
  for (const c of classes) {
    if (c.type !== 'regular' || c.startAt.getMonth() !== month) continue;
    if (filtered && !passesFilter(c)) continue;
    const key = slotKeyOf(c);
    if (!map.has(key)) {
      map.set(key, {
        key,
        day: c.startAt.getDay(),
        time: hhmm(c.startAt),
        timeRange: timeRange(c),
        name: c.name,
        level: c.level,
        instructor: c.instructor,
        room: c.room,
        capacity: c.capacity,
        seatsTaken: c.seatsTaken,
        sessions: [],
        remaining: [],
      });
    }
    const s = map.get(key);
    s.sessions.push(c);
    if (c.startAt > NOW) s.remaining.push(c);
  }
  return [...map.values()].sort(
    (a, b) => WEEK_ORDER(a.day) - WEEK_ORDER(b.day) || a.time.localeCompare(b.time),
  );
}

export const slotByKey = (key, month) => regularSlots(month, { filtered: false }).find((s) => s.key === key);

export function slotStatus(slot) {
  if (isCouponOnly(slot.name)) return 'couponOnly';         // 작품반 — 쿠폰으로만
  if (!slot.remaining.length) return 'unavailable';         // 남은 회차 없음
  if (slot.remaining.some((c) => enrollmentOf(c.id))) return 'enrolled';
  const w = enrollmentWindow();
  // 이번 달은 이미 마감, 다음 달은 아직 오픈 전 — 둘 다 열람만 가능
  if (!w.open) return w.kind === 'current' ? 'closed' : 'notopen';
  if (state.enroll.selectedSlots.includes(slot.key)) return 'selected';
  if (slot.seatsTaken >= slot.capacity) return 'full';
  return 'available';
}

export const SLOT_STATUS_LABEL = {
  available: '신청 가능',
  full: '마감',
  enrolled: '수강 중',
  selected: '선택함',
  unavailable: '남은 회차 없음',
  notopen: '오픈 예정',
  closed: '신청 마감',
  couponOnly: '쿠폰으로 신청',
};

/** 담은 반 + 회차 + 월 수강료 (수강료는 반 종류가 아니라 주 N회로 정해진다) */
export function selection() {
  const slots = state.enroll.selectedSlots
    .map((k) => slotByKey(k, state.enroll.month))
    .filter(Boolean);
  const sessions = slots.reduce((n, s) => n + s.remaining.length, 0);

  // 기준은 "고른 수강권(주 N회)"이지 "담은 개수"가 아니다.
  // 담은 개수로 값을 매기면, 하나 덜 담은 걸 모른 채 낮은 수강권으로 결제된다.
  const perWeek = state.enroll.perWeek;
  const plan = regularPrice(perWeek);
  return {
    slots,
    sessions,
    perWeek,
    picked: slots.length,
    left: Math.max(0, perWeek - slots.length),
    complete: slots.length === perWeek,
    total: plan?.month ?? 0,
    plan,
    makeup: cancelLimitFor(perWeek),
  };
}

/** Class.enrollmentStatus 계산 (날짜 단위 — 보강/수업 상세용) */
export function classStatus(c) {
  if (state.enroll.mode === 'regular' && state.enroll.selectedSlots.includes(slotKeyOf(c))) return 'selected';
  const e = enrollmentOf(c.id);
  if (e) return e.status === 'pending' ? 'pending' : 'enrolled';
  if (c.startAt <= NOW) return 'unavailable';
  if (c.seatsTaken >= c.capacity) return 'full';
  return 'available';
}

export const STATUS_LABEL = {
  available: '신청 가능',
  full: '마감',
  enrolled: '수강 중',
  selected: '선택함',
  pending: '승인 대기',
  unavailable: '지난 수업',
};

/* --- navigation ----------------------------------------------------------- */
export function go(tab) {
  state.tab = tab;
  state.stack = [];
  state.sheet = null;
  state.popup = null;
  // 단건 신청 풀모달은 탭을 덮으므로, 탭이 바뀌면 함께 닫는다
  state.enroll.mode = 'regular';
  state.enroll.payWith = null;
  commit();
}
export function push(name, props = {}) { state.stack.push({ name, props }); state.sheet = null; commit(); }
export function pop() { state.stack.pop(); commit(); }
export function resetStack() { state.stack = []; commit(); }
export function openSheet(name, props = {}) { state.sheet = { name, props }; commit(); }
export function closeSheet() { state.sheet = null; commit(); }

/** 팝업은 시트를 덮지 않고 그 위에 뜬다 — 닫으면 보던 화면으로 그대로 돌아온다 */
export function openPopup(name, props = {}) { state.popup = { name, props }; commit(); }
export function closePopup() { state.popup = null; commit(); }

/* --- actions -------------------------------------------------------------- */

/* 정규 선택 규칙
   · 선택 단위는 요일 — 주 N회면 요일도 N개까지 고를 수 있다
   · 한 요일에는 반 하나. 같은 요일의 다른 반을 누르면 교체된다
   · 요일을 끄면 그 요일에 담은 반도 함께 빠진다                              */

const slotsOf = (keys) => keys.map((k) => slotByKey(k, state.enroll.month)).filter(Boolean);

/** 담은 반이 있는 요일은 항상 선택된 요일로 유지한다 */
function ensureWeekday(day) {
  if (!state.enroll.weekdays.includes(day)) state.enroll.weekdays.push(day);
}

/** 요일 담기/빼기 (캘린더의 요일 헤더·날짜 셀 공용) */
export function toggleWeekday(day) {
  if (!enrollmentWindow().open) return 'closed';
  const { weekdays, perWeek } = state.enroll;
  const i = weekdays.indexOf(day);

  if (i >= 0) {
    weekdays.splice(i, 1);
    // 그 요일에 담은 반도 함께 뺀다
    state.enroll.selectedSlots = state.enroll.selectedSlots
      .filter((k) => slotByKey(k, state.enroll.month)?.day !== day);
    commit();
    return 'removed';
  }
  if (weekdays.length >= perWeek) return 'limit';
  weekdays.push(day);
  commit();
  return 'added';
}

/** 반 담기/빼기 */
export function toggleSlot(key) {
  if (!enrollmentWindow().open) return 'closed';
  const slot = slotByKey(key, state.enroll.month);
  if (!slot) return 'none';
  if (isCouponOnly(slot.name)) return 'couponOnly';

  const list = state.enroll.selectedSlots;
  const i = list.indexOf(key);
  if (i >= 0) { list.splice(i, 1); commit(); return 'removed'; }

  // 같은 요일에 이미 담은 반이 있으면 교체한다
  const sameDay = slotsOf(list).find((s) => s.day === slot.day);
  if (sameDay) {
    list.splice(list.indexOf(sameDay.key), 1, key);
    ensureWeekday(slot.day);
    commit();
    return 'replaced';
  }

  if (state.enroll.weekdays.filter((d) => d !== slot.day).length >= state.enroll.perWeek) return 'limit';
  if (list.length >= state.enroll.perWeek) return 'limit';
  list.push(key);
  ensureWeekday(slot.day);
  commit();
  return 'added';
}

export function setPerWeek(n) {
  state.enroll.perWeek = n;
  // 횟수를 줄이면 최근 선택부터 유지한다
  if (state.enroll.weekdays.length > n) {
    const keep = state.enroll.weekdays.slice(-n);
    state.enroll.weekdays = keep;
    state.enroll.selectedSlots = state.enroll.selectedSlots
      .filter((k) => keep.includes(slotByKey(k, state.enroll.month)?.day));
  }
  commit();
}

export function clearSelection() {
  state.enroll.selectedSlots = [];
  state.enroll.weekdays = [];
  commit();
}

/** 보강으로 신청 시작 — 목록은 쿠폰과 공유하고, 보강을 기본 수단으로 잡아둔다 */
export function startMakeup() {
  state.tab = 'enroll';
  state.stack = [];
  state.sheet = null;
  state.enroll.mode = 'single';
  state.enroll.payWith = { kind: 'makeup' };
  state.enroll.month = NOW.getMonth();
  state.enroll.day = null;
  state.enroll.selectedSlots = [];
  state.enroll.weekdays = [];
  state.enroll.filter = { ...EMPTY_FILTER };
  commit();
}

/** 쿠폰으로 신청 시작 — 목록은 보강과 공유하고, 그 쿠폰을 기본 수단으로 잡아둔다 */
export function startCoupon(couponId) {
  state.tab = 'enroll';
  state.stack = [];
  state.sheet = null;
  state.enroll.mode = 'single';
  state.enroll.payWith = { kind: 'coupon', couponId };
  state.enroll.month = NOW.getMonth();
  state.enroll.day = null;
  state.enroll.selectedSlots = [];
  state.enroll.weekdays = [];
  state.enroll.filter = { ...EMPTY_FILTER };
  commit();
}

export function exitSingleMode() {
  state.enroll.mode = 'regular';
  state.enroll.payWith = null;
  state.enroll.month = NOW.getMonth() + 1;
  state.enroll.selectedSlots = [];
  state.enroll.weekdays = [];
  commit();
}
export const exitMakeup = exitSingleMode;

/** 정규 수강 신청 — 담은 반의 남은 회차를 승인 대기(pending)로 만든다 */
export function submitRegular() {
  if (state.demo.failNextSubmit) {
    state.demo.failNextSubmit = false;
    state.enroll.submitError = true;
    commit();
    return false;
  }
  const { slots, sessions, total, perWeek, plan, makeup, complete } = selection();
  if (!complete) return false;   // 주 N회를 다 담기 전에는 신청되지 않는다
  for (const slot of slots) {
    for (const c of slot.remaining) {
      if (enrollmentOf(c.id)) continue;
      state.data.enrollments.push({
        id: `enr-${c.id}`, classId: c.id, userId: user.id, type: 'regular', status: 'pending',
      });
    }
  }
  const receipt = {
    month: state.enroll.month,
    perWeek,
    slots: slots.map((s) => ({
      key: s.key, name: s.name, day: s.day, timeRange: s.timeRange,
      instructor: s.instructor, room: s.room,
      dates: s.remaining.map((c) => c.startAt.getDate()),
      count: s.remaining.length,
    })),
    sessions,
    total,
    plan,
    makeup,
  };
  state.data.payments.push({
    id: `pay-${state.data.payments.length + 1}`,
    at: ymd(NOW),
    kind: 'regular',
    name: `${state.enroll.month + 1}월 정규반`,
    qty: `주${perWeek}회`,
    amount: total,
  });
  state.enroll.submitError = false;
  state.enroll.selectedSlots = [];
  state.enroll.weekdays = [];
  commit();
  return receipt;
}

/** 보강 신청 */
export function submitMakeup(classId) {
  const c = getClass(classId);
  if (!c || !canBookMakeup(c)) return false;
  if (makeupAvailable(c.startAt.getMonth()) <= 0) return false;
  state.data.enrollments.push({
    id: `enr-${classId}`, classId, userId: user.id, type: 'makeup', status: 'confirmed',
  });
  commit();
  return true;
}

/** 쿠폰으로 신청 — 쿠폰 1회 차감 */
export function submitCoupon(classId, couponId) {
  const c = getClass(classId);
  const coupon = couponById(couponId);
  if (!c || !coupon || !canBookCoupon(c)) return false;
  if (couponRemaining(coupon) <= 0) return false;
  coupon.used += 1;
  c.couponTaken = (c.couponTaken ?? 0) + 1;
  state.data.enrollments.push({
    id: `enr-${classId}`, classId, userId: user.id, type: 'coupon', couponId, status: 'confirmed',
  });
  commit();
  return true;
}

/** 쿠폰 기간 연장 — 7일, 1회, 3만원 */
export function extendCoupon(couponId) {
  const coupon = couponById(couponId);
  if (!coupon || !canExtendCoupon(coupon)) return false;
  const next = parseYmd(coupon.expiresAt);
  next.setDate(next.getDate() + COUPON_EXTEND.days);
  coupon.expiresAt = ymd(next);
  coupon.extended += 1;
  commit();
  return true;
}

/**
 * 수업 취소 — 하루 전날 자정까지. 당일 취소는 불가.
 * 정규 수업을 취소하면 월 보강 한도 안에서 다른 날로 대체할 수 있고,
 * 쿠폰 수업을 취소하면 쿠폰 1회가 복구된다. (결석 시에는 차감된 채로 둔다)
 */
export function cancelClass(classId) {
  const e = enrollmentOf(classId);
  const c = getClass(classId);
  if (!e || !c || !canCancel(c)) return null;

  e.status = 'cancelled';
  if (e.type === 'coupon' && e.couponId) {
    const coupon = couponById(e.couponId);
    if (coupon) coupon.used = Math.max(0, coupon.used - 1);
    c.couponTaken = Math.max(0, (c.couponTaken ?? 0) - 1);
  }
  commit();
  return { type: e.type, month: c.startAt.getMonth() };
}

/**
 * 그 달 정규 신청을 통째로 되돌린다 (Figma 59:13733).
 * 신청 기간 안에서만 — 기간이 닫히면 앱에서 손댈 수 없고 관리자 문의다.
 * 개별 수업 취소(cancelClass)와 달리 '없던 일'로 만드는 것이라
 * 등록을 cancelled로 남기지 않고 결제 기록까지 함께 지운다.
 */
export function cancelRegularEnrollment(month) {
  if (!enrollmentWindow(month).open) return false;
  const target = (e) => e.type === 'regular' && classById.get(e.classId)?.startAt.getMonth() === month;
  if (!state.data.enrollments.some(target)) return false;

  const name = `${month + 1}월 정규반`;
  const paid = state.data.payments.find((p) => p.kind === 'regular' && p.name === name);
  const perWeek = myPerWeek(month);            // 등록을 지우기 전에 읽는다

  state.data.enrollments = state.data.enrollments.filter((e) => !target(e));
  // 결제 기록은 지우지 않는다 — 결제도 환불도 있었던 일이므로 음수 한 줄로 남긴다
  state.data.payments.push({
    id: `pay-${state.data.payments.length + 1}`,
    at: ymd(NOW),
    kind: 'refund',
    name,
    qty: paid?.qty ?? `주${perWeek}회`,
    amount: -(paid?.amount ?? regularPrice(perWeek)?.month ?? 0),
  });
  commit();
  return true;
}

/* --- 개인레슨 예약 ---------------------------------------------------------
   개인레슨은 정규 수업 위에 얹지 않는다. 별도 가용 데이터를 두는 대신
   시간표에서 "강사가 비고 홀이 비는 시간"을 역산한다. (POLICY §개인레슨)
   -------------------------------------------------------------------------- */

const minutesOf = (d) => d.getHours() * 60 + d.getMinutes();
const overlaps = (aS, aE, bS, bE) => aS < bE && bS < aE;
const hhmmOf = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const privateTime = hhmmOf;

/**
 * 그 날 열려 있는 시작 시각(분) 목록.
 * teacher가 없으면 '학원 추천' — 아무 선생님이든 한 명만 비면 된다.
 */
export function privateSlots(date, { teacher = null, dur = 60 } = {}) {
  const sameDay = classes.filter((c) => isSameDay(c.startAt, date));
  const out = [];
  for (let s = PRIVATE_HOURS.open; s + dur <= PRIVATE_HOURS.close; s += PRIVATE_HOURS.step) {
    const busy = sameDay.filter((c) => overlaps(s, s + dur, minutesOf(c.startAt), minutesOf(c.endAt)));
    // 홀이 하나라도 비어야 한다 (홀 표기가 없는 수업은 홀을 잡지 않는다)
    const takenRooms = new Set(busy.map((c) => c.room).filter(Boolean));
    const room = ROOMS.find((r) => !takenRooms.has(r));
    if (!room) continue;
    const free = (t) => !busy.some((c) => c.instructor === t);
    if (teacher ? !free(teacher) : !INSTRUCTORS.some(free)) continue;
    out.push({ start: s, room });      // 비는 홀을 그대로 붙여 준다
  }
  return out;
}

/** 그 시간에 수업이 없는 선생님들 — 조건을 먼저 잡고 선생님을 고를 때 쓴다 */
export function privateTeachers(picks, dur = 60) {
  if (!picks.length) return INSTRUCTORS.slice();
  return INSTRUCTORS.filter((t) => picks.every((p) => {
    const d = parseYmd(p.ymd);
    return privateSlots(d, { teacher: t, dur }).some((s) => s.start === p.start);
  }));
}

/** 예약할 수 있는 날 — 내일부터 이번 텀 종강일까지, 슬롯이 하나라도 있는 날 */
export function privateDates(month = NOW.getMonth(), opts = {}) {
  if (!termOf(month)) return [];        // 시간표가 없는 달은 판단할 근거가 없다
  const out = [];
  const first = new Date(2026, month, 1);
  const last = new Date(2026, month + 1, 0);
  for (let d = new Date(first); d <= last; d = addDays(d, 1)) {
    if (d <= dayStart(NOW)) continue;                 // 당일·과거는 잡지 않는다
    if (privateSlots(d, opts).length) out.push(new Date(d));
  }
  return out;
}

/**
 * 반복 예약 — 첫 회차와 같은 요일·시각으로 every주 간격, count회를 훑는다.
 * 중간에 안 되는 주가 흔해서(격주 수업 등) 되는 주만 담는다.
 */
export function privateSeries({
  from, start, count, every = 1, teacher = null, dur = 60,
}) {
  const out = [];
  for (let i = 0, d = new Date(from); i < count; i += 1, d = addDays(d, 7 * every)) {
    const hit = termOf(d.getMonth()) && privateSlots(d, { teacher, dur }).find((s) => s.start === start);
    out.push({ date: new Date(d), ok: !!hit, room: hit?.room ?? null });
  }
  return out;
}

/** 요청 한 건의 금액 — 정기 할인은 없다. 회차 × 단가 */
export const privateAmount = (dur, count) => PRIVATE_PRICE[dur] * count;

/** 후보를 담는다 (1회는 대안 후보, 정기는 실제 회차) */
export function addPrivatePick(pick) {
  const p = state.private;
  const key = (x) => `${x.ymd}|${x.start}`;
  if (p.picks.some((x) => key(x) === key(pick))) return false;
  p.picks.push(pick);
  commit();
  return true;
}

export function removePrivatePick(i) {
  state.private.picks.splice(Number(i), 1);
  commit();
}

export function setPrivate(patch) {
  Object.assign(state.private, patch);
  // 수업 길이나 예약 방식이 바뀌면 담아둔 회차는 더 이상 유효하지 않다
  if ('dur' in patch || 'mode' in patch || 'seriesMode' in patch) {
    state.private.picks = [];
    state.private.date = null;
  }
  commit();
}

export function resetPrivate() {
  state.private = {
    tab: 'book', mode: 'once', seriesMode: 'repeat', dur: 60, every: 1, count: 4,
    month: NOW.getMonth(), date: null, picks: [], teacher: null,
  };
  commit();
}

/** 요청 제출 — 승인 후 결제라 이 시점에는 돈이 오가지 않는다 */
export function submitPrivateRequest() {
  const p = state.private;
  if (!p.picks.length) return null;
  const req = {
    id: `pr-${state.data.privateRequests.length + 1}`,
    at: ymd(NOW),
    teacher: p.teacher,            // null = 학원 추천
    mode: p.mode,
    dur: p.dur,
    picks: p.picks.map((x) => ({ ...x })),
    // 1회는 후보 중 하나만 잡히므로 1회분, 정기는 담은 회차 전부
    amount: privateAmount(p.dur, p.mode === 'series' ? p.picks.length : 1),
    status: 'pending',
  };
  state.data.privateRequests.push(req);
  resetPrivate();
  state.private.tab = 'requests';
  commit();
  return req;
}

export function pendingEnrollments() {
  return state.data.enrollments
    .filter((e) => e.status === 'pending')
    .map((e) => ({ ...classById.get(e.classId), enrollment: e }))
    .filter((c) => c.id);
}
