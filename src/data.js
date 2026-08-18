/* ==========================================================================
   발레75 — Mock data

   주간 시간표는 발레75 실제 시간표를 옮긴 것이다.
   회원/수강 이력/수강료 등 나머지 값은 프로토타입용 임시 데이터이며,
   운영 정책(취소 기한, 보강 발생 조건·유효기간, 정원/대기 처리, 결제 방식)은
   PRD §36 기준 TBD다.
   ========================================================================== */

export const brand = { id: 'ballet75', name: '발레75' };
export const user = { id: 'user-001', name: '이지향' };

/** 프로토타입 기준 시각 (고정) — 2026년 8월 15일 토요일 오전 9시 */
export const NOW = new Date(2026, 7, 15, 9, 0, 0);

/* --- 주간 시간표 -----------------------------------------------------------
   모든 수업은 80분. 별도 시간이 적힌 수업만 dur로 지정한다.
   weeks: 매주가 아니라 해당 요일의 n번째 주차에만 열리는 수업 (격주 등)
   -------------------------------------------------------------------------- */
const CLASS_MINUTES = 80;

const c = (t, name, instructor, room, opts = {}) => ({
  t, name, instructor, room, dur: CLASS_MINUTES, ...opts,
});

const WEEK_TEMPLATE = {
  1: [ // 월
    c('10:20', '레벨1', '경리T', 'A홀'),
    c('11:50', '베이직', '경리T', 'A홀'),
    c('18:40', '베이직', '서연T', 'A홀'),
    c('19:00', '레벨1 센터집중반', '현T', 'B홀'),
    c('20:20', '레벨2', '서연T', 'A홀'),
    c('20:40', '베이직', '현T', 'B홀'),
  ],
  2: [ // 화
    c('10:20', '레벨2', '소정T', 'A홀'),
    c('11:50', '레벨3', '소정T', 'A홀'),
    c('17:40', '발레스트레칭', '서연T', '', { dur: 60 }),
    c('18:40', '베이직', '경리T', 'B홀'),
    c('19:00', '레벨2 준비반', '서연T', 'A홀'),
    c('20:20', '레벨1 준비반', '경리T', 'B홀'),
    c('20:40', '작품반', '서연T', 'A홀'),
  ],
  3: [ // 수
    c('10:20', '레벨1 센터집중반', '경리T', 'A홀'),
    c('11:50', '베이직', '경리T', 'A홀'),
    c('18:40', '베이직', '서연T', 'A홀'),
    c('19:00', '레벨1 준비반', '혜란T', 'B홀'),
    c('20:20', '레벨2', '서연T', 'A홀'),
    c('20:40', '레벨1 준비반', '혜란T', 'B홀'),
  ],
  4: [ // 목
    c('10:20', '레벨2', '소정T', 'A홀'),
    c('11:50', '레벨3', '소정T', 'A홀'),
    c('18:40', '베이직', '경리T', 'B홀'),
    c('19:00', '레벨2 준비반', '서연T', 'A홀'),
    c('20:20', '레벨1 준비반', '경리T', 'B홀'),
    c('20:40', '베이직', '서연T', 'A홀'),
  ],
  5: [ // 금
    c('10:20', '레벨2', '소정T', 'A홀'),
    c('19:00', '레벨1', '지민T', 'B홀'),
    c('19:30', '레벨3준비반', '소정T', 'A홀'),
    c('20:30', '레벨1 준비반', '지민T', 'B홀'),
  ],
  6: [ // 토
    c('10:30', '베이직', '경리T', 'A홀'),
    c('12:00', '레벨1 준비반', '경리T', 'B홀'),
    c('12:00', '토슈즈1', '소정T', 'A홀'),
    // 시간표에 "14, 28일"로 적힌 격주 수업 — 해당 요일의 2·4번째 주차에만 열린다
    c('13:40', '레벨2', '소정T', 'A홀', { weeks: [2, 4] }),
  ],
  0: [ // 일
    c('10:30', '레벨1', '규리T', 'A홀'),
    c('12:00', '레벨3', '규리T', 'A홀'),
    c('13:20', '토슈즈1', '규리T', 'A홀', { dur: 30 }),
  ],
};

/* --- 수강료 (운영 정책) ----------------------------------------------------
   정규반은 반 종류가 아니라 **주 몇 회를 듣는지**로 월정액이 정해진다.
   4주(28일) 수업 기준이며, 5주가 있는 달의 처리 기준은 확인 중이다.
   -------------------------------------------------------------------------- */
export const REGULAR_PRICE = {
  1: { month: 132000, perSession: 33000, discount: 0 },
  2: { month: 211000, perSession: 26400, discount: 20 },
  3: { month: 277000, perSession: 23100, discount: 30 },
  4: { month: 316000, perSession: 19800, discount: 40 },
};

/**
 * 주 N회 수강권의 월 취소·보강 한도.
 * 한 달에 이 횟수만큼 취소할 수 있고, 취소한 횟수만큼 기간 안에
 * 다른 수업을 보강으로 신청할 수 있다. (취소 한도 = 보강 한도)
 *
 * 주 2회 값은 확정 전이다 — 가격표 이미지에는 1회, 이후 전달값은 2회.
 * 자세한 내용은 POLICY.md 2-3. 확정되면 아래 표만 고치면 된다.
 */
export const MAKEUP_QUOTA = { 1: 0, 2: 2, 3: 2, 4: 3 };
/** 확정 전인 주 N회 (화면에 각주로 표시한다) */
export const QUOTA_UNCONFIRMED = [2];
export const cancelLimitFor = (perWeek) => MAKEUP_QUOTA[perWeek] ?? 0;

/* --- 쿠폰 (회차권) ---------------------------------------------------------
   정규 등록과 별개로 구매해 회차를 차감하며 수업을 신청한다.
   스트레칭 쿠폰은 가격이 달라 종류를 나눠 두었고, 가격표는 확인 중이다.
   -------------------------------------------------------------------------- */
export const COUPON_PRICE = {
  general: {
    name: '일반 쿠폰',
    unit: 33000,
    // 수량별 총액 — 묶음 할인이 자동 적용된다.
    // 구조는 "수량 × 33,000원 − 구간별 정액 할인"이다.
    //   1개 0원 / 2~4개 15,000원 / 5~6개 32,000원 / 7~10개 50,000원
    bundles: {
      1: 33000,
      2: 51000,
      3: 84000,
      // ※ 4개는 아직 확답을 못 받아, 위 구조(수량×33,000 − 구간 할인 15,000)로 채운 값이다.
      4: 117000,
      5: 133000,
      6: 166000,
      7: 181000,
      8: 214000,
      9: 247000,
      10: 280000,
    },
    note: '수량에 따라 묶음 할인이 자동 적용돼요.',
  },
  stretching: {
    name: '발레스트레칭 쿠폰',
    unit: 25000,
    bundles: null,   // 묶음 할인 없이 수량 × 단가
    note: '필요한 수량만큼 바로 담을 수 있어요.',
  },
};

/** 구매할 수 있는 쿠폰 종류 (작품반 쿠폰은 수강신청 때 발급되므로 여기 없다) */
export const COUPON_KINDS = ['general', 'stretching'];
/** 수강권 카드·목록에 쓰는 짧은 이름 */
export const COUPON_KIND_LABEL = { general: '일반', special: '작품반', stretching: '발레스트레칭' };
/** 작품반 — 정규반 수강생만, 쿠폰으로만 신청한다 (주 N회에 들어가지 않는다) */
export const SPECIAL_CLASS = '작품반';
/** 작품반 쿠폰: 수강신청 시 2달치가 일괄 발급된다 */
export const SPECIAL_COUPON = { sessions: 8 };
export const COUPON_VALID_DAYS = 30;
/** 수강권 카드의 남은 일수 배지 — 이 날짜 안으로 들어와야 켜진다 (항상 켜두면 신호가 죽는다) */
export const PASS_BADGE_DAYS = 7;
/** 반마다 쿠폰으로 들어갈 수 있는 자리 수 */
export const COUPON_SEATS = 2;
export const COUPON_EXTEND = { days: 7, price: 30000, times: 1 };

/** 스트레칭 쿠폰이 사용되는 수업 */
export const STRETCHING_CLASS = '발레스트레칭';

/* --- 개강 · 종강 -----------------------------------------------------------
   수업은 4주(28일) 단위로 운영되고, 개강일은 달마다 조금씩 다르다.
   그래서 규칙이 아니라 월별 날짜 표로 관리한다. 개강~종강 밖에는 수업이 없다.
   -------------------------------------------------------------------------- */
export const TERMS = {
  6: { start: '2026-07-07', end: '2026-08-03' },  // 7월 — 임시값
  7: { start: '2026-08-04', end: '2026-08-31' },  // 8월 — 확정
  8: { start: '2026-09-01', end: '2026-09-28' },  // 9월 — 임시값
};
/** 실제 기간을 확인한 달 (나머지는 임시값) */
export const TERM_CONFIRMED = [7];

const toDate = (s, endOfDay = false) => {
  const [y, m, d] = s.split('-').map(Number);
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59) : new Date(y, m - 1, d);
};

export const termOf = (month) => {
  const t = TERMS[month];
  return t ? { start: toDate(t.start), end: toDate(t.end, true) } : null;
};

const inTerm = (d) => {
  const t = termOf(d.getMonth());
  return t ? d >= t.start && d <= t.end : false;
};

/** 개인레슨 — 시간별 1회 요금 */
export const PRIVATE_PRICE = { 60: 80000, 80: 100000 };

/* --- 레벨 안내 -------------------------------------------------------------
   준비반은 두 레벨 사이의 단계다. 아래에 없는 반(레벨1 센터집중반, 레벨3준비반,
   토슈즈1, 작품반, 발레스트레칭)은 설명이 정해지면 추가한다.
   -------------------------------------------------------------------------- */
export const LEVEL_GUIDE = [
  {
    name: '베이직',
    target: '발레를 처음 시작하는 분',
    structure: '매트 30분 · 바 40분 · 센터 10분',
    detail: '바른 자세와 발레의 기본 동작을 익힙니다.',
  },
  {
    name: '레벨1 준비반',
    target: '베이직과 레벨1 사이',
    detail: '수업 진행은 레벨1과 가깝습니다.',
  },
  {
    name: '레벨1',
    target: '발레를 시작한 지 최소 6개월 이상인 분',
    structure: '매트 15분 · 바 40분 · 센터 25분',
    detail: '기본 동작에 몸방향, 팔 사용, 시선이 추가되며 박자의 사용이 빨라집니다.',
  },
  {
    name: '레벨2 준비반',
    target: '레벨1과 레벨2 사이',
    detail: '수업 진행은 레벨2와 가깝습니다.',
  },
  {
    name: '레벨2',
    target: '발레를 시작한 지 최소 3년 이상인 분',
    structure: '바 40분 · 센터 40분',
    detail: '순서가 길고 복잡해지며 연속 회전, 점프를 배웁니다.',
  },
  {
    name: '레벨3',
    target: '순서를 보고 바로 따라할 수 있는 분',
    detail: '다양한 연결동작이 나옵니다.',
  },
];

/** 반 이름 → 레벨 안내 (설명이 정해진 반만 연결한다) */
export const levelGuideFor = (name) => LEVEL_GUIDE.find((g) => g.name === name) || null;

/** 시간표에 등장하는 반 이름 / 강사 (필터 옵션) */
export const CLASS_NAMES = [
  '베이직', '레벨1', '레벨2', '레벨3',
  '레벨1 준비반', '레벨2 준비반', '레벨3준비반', '레벨1 센터집중반',
  '토슈즈1', '작품반', '발레스트레칭',
];
/** 강사 노출 순서 — 원장님(소정T)이 먼저, 이후 가나다순 */
export const INSTRUCTORS = ['소정T', '경리T', '규리T', '서연T', '지민T', '현T', '혜란T'];

/**
 * 개인레슨 선생님 소개.
 * 시간표에는 '소정T'처럼 짧게 적히지만 예약 화면에서는 이름을 그대로 부른다.
 * tags는 확인된 것만 — 추측해서 채우지 않는다.
 */
export const INSTRUCTOR_PROFILE = {
  소정T: { name: '이소정', tags: ['원장', '10년 경력'] },
  경리T: { name: '박경리', tags: [] },
  규리T: { name: '박규리', tags: [] },
  서연T: { name: '임서연', tags: [] },
  혜란T: { name: '주혜란', tags: [] },
  지민T: { name: '김지민', tags: [] },
  현T: { name: '이현', tags: [] },
};

/* --- 개인레슨 예약 ---------------------------------------------------------
   정규 수업 위에 얹지 않는다. 강사가 비고 홀이 비는 시간만 후보가 된다.
   운영 시간대는 확인 전이라 시간표가 도는 범위(10:00~22:00)로 둔다. (POLICY 2-16)
   -------------------------------------------------------------------------- */
export const PRIVATE_HOURS = { open: 8 * 60, close: 22 * 60, step: 10 };
export const PRIVATE_DURATIONS = [60, 80];
export const ROOMS = ['A홀', 'B홀'];
/** 반복 예약 주기 — 매주 / 격주 */
export const PRIVATE_REPEAT = [
  { value: 1, label: '매주' },
  { value: 2, label: '2주에 한 번' },
];
/** 반복 예약 회차 — 한 텀(개강~종강) 안에서만 묶는다 */
export const PRIVATE_SERIES_COUNTS = [4, 8];

/** 내가 등록한 정규반 (요일 + 시작시간 + 반 이름) */
const MY_REGULAR_SLOTS = [
  { day: 2, t: '10:20', name: '레벨2' },        // 화 오전
  { day: 6, t: '10:30', name: '베이직' },       // 토 오전
  { day: 6, t: '12:00', name: '레벨1 준비반' }, // 토 낮
];

/**
 * 쿠폰으로 신청한 수업 — 정규 주 N회에 들어가지 않는다.
 * 각 쿠폰의 used 회차와 1:1로 맞물린다. 어긋나면 사용 내역이 잔여 회차와 따로 논다.
 */
const MY_COUPON_CLASSES = [
  { date: '2026-07-27', t: '20:20', name: '레벨2', couponId: 'cpn-001' },
  { date: '2026-07-29', t: '20:20', name: '레벨2', couponId: 'cpn-001' },
  { date: '2026-08-11', t: '17:40', name: '발레스트레칭', couponId: 'cpn-002' },
  { date: '2026-08-18', t: '20:40', name: '작품반', couponId: 'cpn-003' },
  { date: '2026-08-25', t: '20:40', name: '작품반', couponId: 'cpn-003' },
];

/** 이미 취소한 수업 (그만큼 보강으로 대체할 수 있다) */
const PRE_CANCELLED = [
  { date: '2026-08-04', t: '10:20' },  // 화 레벨2
];

/** 내가 정규 등록한 달 (0-indexed) — 7월·8월 연속 수강 중 */
const MY_REGULAR_MONTHS = [6, 7];

/* --- 다음달 정규반 수강신청 기간 (운영 정책) -------------------------------
   신청은 "현재달"에 다음달 것을 미리 한다.
     · 기존 회원 — 현재달 20일 오전 9시부터
     · 신규 회원 — 현재달 22일 오전 9시부터
   오픈일에 마감되는 게 아니라 **그 달 말일까지** 열려 있고,
   그 사이에는 자리가 남은 반에 한해 신청할 수 있다.
   기존 회원의 기준은 회원가입 여부가 아니라 "지난달에 수업을 들었는지"다.
   -------------------------------------------------------------------------- */
export const ENROLLMENT_OPEN_DAY = { returning: 20, new: 22 };
export const ENROLLMENT_OPEN_HOUR = 9;

/**
 * 홈에 "다음 달 신청은 N일부터" 안내를 띄우기 시작하는 날 (매월 이 날짜부터).
 * 오픈 한참 전부터 띄우면 알림이 아니라 배경이 된다.
 * 기존 20일 · 신규 22일 기준으로 각각 5일 · 7일 전부터 보인다.
 */
export const ENROLLMENT_NOTICE_DAY = 15;

/**
 * 진행 중인 달의 중도 등록 허용 여부 (예: 9월에 9월 정규반 신청).
 * 운영 정책 확정 전이라 기본은 닫아 둔다.
 * 마이 > 프로토타입 상태 보기에서 켜고 끄며 비교할 수 있다.
 */
export const ALLOW_MID_MONTH_ENROLLMENT = false;

/* --- 개인레슨 (시간표 밖 단건 예약) ---------------------------------------- */
const PRIVATE_LESSONS = [
  { date: '2026-08-16', t: '15:00', dur: 60, name: '개인레슨', instructor: '소정T', room: 'A홀' },
];

/* --- helpers -------------------------------------------------------------- */
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

/** 그 달에서 몇 번째 해당 요일인지 (1-indexed) */
const weekdayOccurrence = (d) => Math.floor((d.getDate() - 1) / 7) + 1;

function makeClass(date, slot, type = 'regular') {
  const [hh, mm] = slot.t.split(':').map(Number);
  const startAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm);
  const endAt = new Date(startAt.getTime() + slot.dur * 60000);
  const id = `class-${ymd(startAt)}-${slot.t.replace(':', '')}-${hash(slot.name + slot.room) % 997}`;
  const capacity = type === 'private' ? 1 : 12;
  // 쿠폰으로 들어갈 수 있는 자리는 반마다 2석 (정규 정원과 별도)
  // 정원은 반(요일+시간+반이름+월) 단위 — 같은 반의 모든 회차가 잔여석을 공유한다.
  // 결정적(deterministic) mock 값이며 실제 정원/대기 정책은 TBD.
  const slotSeed = `${slot.name}|${startAt.getDay()}|${slot.t}|${startAt.getMonth()}`;
  const seatsTaken = type === 'private' ? 1 : hash(slotSeed) % 14;
  return {
    id,
    name: slot.name,
    instructor: slot.instructor,
    room: slot.room,
    startAt,
    endAt,
    duration: slot.dur,
    type,
    capacity,
    seatsTaken: Math.min(seatsTaken, capacity),
    couponCapacity: type === 'private' ? 0 : COUPON_SEATS,
    couponTaken: type === 'private' ? 0 : hash(`${id}|coupon`) % (COUPON_SEATS + 1),
  };
}

/* --- 클래스 생성: 2026-07-01 ~ 2026-09-30 --------------------------------- */
function buildClasses() {
  const out = [];
  const cursor = new Date(2026, 6, 1);
  const end = new Date(2026, 8, 30);
  while (cursor <= end) {
    if (inTerm(cursor)) {
      for (const slot of WEEK_TEMPLATE[cursor.getDay()]) {
        if (slot.weeks && !slot.weeks.includes(weekdayOccurrence(cursor))) continue;
        out.push(makeClass(cursor, slot));
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const p of PRIVATE_LESSONS) {
    const [y, m, d] = p.date.split('-').map(Number);
    out.push(makeClass(new Date(y, m - 1, d), p, 'private'));
  }
  return out.sort((a, b) => a.startAt - b.startAt);
}

export const classes = buildClasses();
export const classById = new Map(classes.map((x) => [x.id, x]));

/* --- Enrollment ----------------------------------------------------------- */
function buildEnrollments() {
  const out = [];
  for (const cls of classes) {
    if (cls.type === 'private') {
      out.push({ id: `enr-${cls.id}`, classId: cls.id, userId: user.id, type: 'private', status: 'confirmed' });
      continue;
    }
    const t = `${pad(cls.startAt.getHours())}:${pad(cls.startAt.getMinutes())}`;
    const byCoupon = MY_COUPON_CLASSES.find((x) => x.date === ymd(cls.startAt) && x.t === t && x.name === cls.name);
    if (byCoupon) {
      out.push({
        id: `enr-${cls.id}`, classId: cls.id, userId: user.id,
        type: 'coupon', couponId: byCoupon.couponId, status: 'confirmed',
      });
      continue;
    }
    if (!MY_REGULAR_MONTHS.includes(cls.startAt.getMonth())) continue;
    const hit = MY_REGULAR_SLOTS.some((s) => (
      s.day === cls.startAt.getDay()
      && s.t === `${pad(cls.startAt.getHours())}:${pad(cls.startAt.getMinutes())}`
      && s.name === cls.name
    ));
    if (!hit) continue;
    const cancelled = PRE_CANCELLED.some(
      (x) => x.date === ymd(cls.startAt) && x.t === `${pad(cls.startAt.getHours())}:${pad(cls.startAt.getMinutes())}`,
    );
    out.push({
      id: `enr-${cls.id}`, classId: cls.id, userId: user.id, type: 'regular',
      status: cancelled ? 'cancelled' : 'confirmed',
    });
  }
  return out;
}

export const seed = {
  enrollments: buildEnrollments(),

  /** 지난 보강 사용 내역 (이번 달 사용분은 enrollments에서 계산한다) */
  makeupHistory: [
    { month: 6, label: '7월 30일 · 레벨2', source: '7월 21일 · 레벨2' },
  ],

  /** 보유 쿠폰 — 회차를 차감해 수업을 신청한다 */
  coupons: [
    // 지난달에 구매 — 만료가 가까워 카드에 남은 일수 배지가 켜진다
    { id: 'cpn-001', kind: 'general', name: '쿠폰 5회권', total: 5, used: 2, issuedAt: '2026-07-22', expiresAt: '2026-08-21', extended: 0 },
    { id: 'cpn-002', kind: 'stretching', name: '발레스트레칭 쿠폰 5회권', total: 5, used: 1, issuedAt: '2026-08-10', expiresAt: '2026-09-09', extended: 0 },
    // 8월 수강신청 때 발급 — 8월 개강일 ~ 9월 종강일
    { id: 'cpn-003', kind: 'special', name: '작품반 8회권', total: 8, used: 2, issuedAt: '2026-08-04', expiresAt: '2026-09-28', extended: 0 },
  ],




  /** 신청·구매 기록 (결제 수단 연동 전이라 금액 기록만 남긴다) */
  payments: [
    { id: 'pay-1', at: '2026-06-19', kind: 'regular', name: '7월 정규반', qty: '주3회', amount: 277000 },
    { id: 'pay-2', at: '2026-06-24', kind: 'coupon', name: '발레스트레칭 쿠폰', qty: '3회', amount: 75000 },
    { id: 'pay-3', at: '2026-07-06', kind: 'coupon', name: '일반 쿠폰', qty: '3회', amount: 84000 },
    { id: 'pay-4', at: '2026-07-20', kind: 'regular', name: '8월 정규반', qty: '주3회', amount: 277000 },
    { id: 'pay-5', at: '2026-07-22', kind: 'coupon', name: '일반 쿠폰', qty: '5회', amount: 133000 },
    { id: 'pay-6', at: '2026-08-04', kind: 'coupon', name: '8-9월 작품반', qty: '8회', amount: 264000 },
    { id: 'pay-7', at: '2026-08-10', kind: 'coupon', name: '발레스트레칭 쿠폰', qty: '5회', amount: 125000 },
  ],

  /**
   * 승인을 기다리는 개인레슨 요청.
   * 요청 → 대기 → 승인은 회원이 아무것도 안 해도 시간이 흐르는 구간이라,
   * 프로토타입에서도 '보내놓고 기다리는 중'인 상태가 하나는 있어야 한다.
   * 1회 요청이므로 picks는 확정 회차가 아니라 후보 시각이다.
   */
  privateRequests: [
    {
      id: 'pr-1',
      at: '2026-08-14',
      teacher: '소정T',
      mode: 'once',
      dur: 60,
      picks: [
        { ymd: '2026-08-20', start: 15 * 60, room: 'B홀' },
        { ymd: '2026-08-21', start: 14 * 60, room: 'A홀' },
      ],
      amount: PRIVATE_PRICE[60],
      status: 'pending',
    },
  ],

  // 알림 기능은 후속(P1)에서 노출한다. 데이터만 먼저 정의해 둔다.
  notifications: [
    { id: 'n-1', title: '보강 사용 기한이 다가와요', desc: '8월 31일까지 사용할 수 있는 보강 1회가 있어요.', at: '2026-08-14' },
    { id: 'n-2', title: '9월 수강신청이 곧 열려요', desc: '8월 20일부터 신청할 수 있어요.', at: '2026-08-13' },
    { id: 'n-3', title: '쿠폰 만료가 다가와요', desc: '쿠폰 3회가 9월 4일에 만료돼요.', at: '2026-08-12' },
  ],
};
