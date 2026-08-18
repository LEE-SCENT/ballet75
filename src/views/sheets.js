/* ==========================================================================
   발레75 — Bottom sheets
   수업 상세 / 선택한 수업 / 취소 확인 / 필터 / 수강권 신청 내역 / 쿠폰 구매
   ========================================================================== */

import {
  state, getClass, classStatus, STATUS_LABEL, selection, canCancel, makeupAvailable, makeupDeadline,
  cancelLimit, cancelLeft, cancelledCount,
  couponPrice, couponById, couponRemaining, shouldOfferExtend, activeCoupons,
  shopTotal, shopCount, filterCount, filterUnit,
  myPerWeek, regularPrice, enrollmentWindow, filterChipCount,
  privateDates, privateSlots, privateTime, isSameDay,
  timeRange, fmtFullDate, fmtMD, fmtMDDow, fmtYMD, parseYmd, won,
} from '../state.js';
import {
  NOW, termOf, COUPON_KIND_LABEL, ymd,
  PRIVATE_DURATIONS, PRIVATE_REPEAT, PRIVATE_SERIES_COUNTS,
} from '../data.js';
import { pickLine } from './private.js';
import {
  CLASS_NAMES, INSTRUCTORS, LEVEL_GUIDE, levelGuideFor, cancelLimitFor, QUOTA_UNCONFIRMED,
  COUPON_PRICE, COUPON_KINDS, COUPON_EXTEND, COUPON_SEATS, COUPON_VALID_DAYS,
} from '../data.js';
import { esc, icons, statusChip, typeTag } from '../ui.js';
import {
  bottomSheet, popupPanel, infoList, infoNotice, historyList,
  classInfoList, emptyBox, selectCard, stepper, confirmPopup,
  segmentedControl, calendar, calendarMonthDay,
} from '../components.js';

const shell = (inner, opts = {}) =>
  bottomSheet({ ...opts, body: inner, animate: state.ui.animateSheet });

/** 이 수업을 무엇으로 듣고 있는지 — 등록 종류를 그대로 읽는다 */
const TYPE_LABEL = { regular: '정규반', makeup: '보강', coupon: '쿠폰', private: '개인레슨' };
function typeLabel(c) {
  if (c.type === 'private') return '개인레슨';
  const e = state.data.enrollments.find((x) => x.classId === c.id && x.status !== 'cancelled');
  return TYPE_LABEL[e?.type] ?? '정규반';
}

/* --- 수업 상세 (PRD §26) --------------------------------------------------- */
function classDetail({ id }) {
  const c = getClass(id);
  if (!c) return shell('<p class="t-support">수업 정보를 찾을 수 없어요.</p>');
  const st = classStatus(c);
  const singleMode = state.enroll.mode === 'single';

  const rows = [
    ['수업', c.name],
    ['날짜', fmtFullDate(c.startAt)],
    ['시간', `${timeRange(c)} (${c.duration}분)`],
    ['강사', c.instructor],
    ...(c.room ? [['장소', c.room]] : []),
    ['구분', typeLabel(c)],
  ];

  const guide = levelGuideFor(c.name);

  // 취소가 안 되는 상태에서도 버튼을 지우지 않는다 — 비활성으로 남기고 이유를 위에 붙인다.
  // 쿠폰 수업은 취소 한도를 쓰지 않으므로 사유가 '당일'뿐이다 (canCancel 참고).
  const e = state.data.enrollments.find((x) => x.classId === c.id && x.status !== 'cancelled');
  let actions = '';
  let notice = '';
  if (st === 'enrolled' || st === 'pending') {
    if (canCancel(c)) {
      actions = `<button class="btn btn--critical" data-action="ask-cancel" data-id="${c.id}">수업 취소</button>`;
    } else {
      actions = '<button class="btn btn--critical" disabled>수업 취소</button>';
      const isPrivate = e?.type === 'private';
      const quotaOut = !isPrivate && e?.type !== 'coupon' && cancelLeft(c.startAt.getMonth()) <= 0;
      notice = infoNotice({
        text: isPrivate
          // 개인레슨은 정규반 취소·보강 규칙을 따르지 않는다 (POLICY 미정)
          ? '개인레슨은 앱에서 취소할 수 없어요. <b>관리자에게 문의</b>해 주세요.'
          : quotaOut
            ? `이번 달 취소 <b>${cancelLimit(c.startAt.getMonth())}회</b>를 모두 사용했어요`
            : '당일 수업은 취소할 수 없어요. 취소는 <b>하루 전날 자정</b>까지 가능해요.',
      });
    }
  } else if (st === 'selected') {
    actions = `<button class="btn btn--critical" data-action="unpick" data-id="${c.id}">선택 취소</button>`;
  } else if (st === 'available') {
    actions = singleMode
      ? `<button class="btn btn--primary" data-action="pick-makeup" data-id="${c.id}">이 수업 신청</button>`
      : `<button class="btn btn--primary" data-action="go-enroll">수강신청에서 신청하기</button>`;
  } else if (st === 'full') {
    notice = infoNotice({ text: '마감된 수업이에요.' });
  } else {
    notice = infoNotice({ text: '이미 지난 수업이에요.' });
  }

  return bottomSheet({
    title: c.name,
    info: guide ? { action: 'level-guide', name: guide.name, label: `${guide.name} 레벨 안내` } : null,
    notice,
    body: infoList(rows),
    actions,
    label: '수업 상세',
    // 데스크톱에서는 목록 옆 패널로 뜬다 (61:15036) — 모바일에서는 그대로 바텀시트
    variant: 'panel',
    animate: state.ui.animateSheet,
  });
}

/* --- 담은 수업 (PRD §15) --------------------------------------------------- */
const WD_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

function selectedSheet() {
  const {
    slots, sessions, total, perWeek, picked, left, complete,
  } = selection();
  const month = state.enroll.month;
  return shell(`
    <h2 class="sheet__title">담은 수업</h2>
    <p class="t-support mt-8">${month + 1}월 · 주 ${perWeek}회 · ${picked}/${perWeek} 담음${complete ? ` · 총 ${sessions}회` : ''}</p>
    ${complete ? '' : `<div class="mt-12 notice">주 ${perWeek}회 수강권이라 반 ${perWeek}개를 담아야 신청할 수 있어요. ${left}개 남았어요.<br>주 ${picked}회로 바꾸려면 위에서 횟수를 다시 골라주세요.</div>`}
    <div class="mt-16">
      ${slots.map((s) => `
        <div class="slotline slotline--row">
          <div style="flex:1;min-width:0">
            <div class="slotline__top">
              <span class="slotline__name">${esc(s.name)}</span>
            </div>
            <p class="slotline__meta">${WD_LABEL[s.day]}요일 ${s.timeRange} · ${esc(s.instructor)}</p>
            <p class="slotline__dates">${month + 1}월 ${s.remaining.length}회 · ${s.remaining.map((c) => c.startAt.getDate()).join('·')}일</p>
          </div>
          <button class="icon-btn icon-btn--sm" data-action="unpick-slot" data-key="${esc(s.key)}" aria-label="${esc(s.name)} 빼기">
            ${icons.close()}
          </button>
        </div>`).join('')}
    </div>
    <div class="total mt-16">
      <div class="kv total__sum"><span class="k">주 ${perWeek}회 수강료</span><span class="v">${won(total)}</span></div>
    </div>
    <div class="sheet__actions btn-row">
      <button class="btn btn--primary" data-action="to-confirm" ${complete ? '' : 'disabled'}>
        ${complete ? '신청하기' : `${left}개 더 담아주세요`}
      </button>
      <button class="btn btn--ghost" data-action="clear-selection">전체 취소</button>
    </div>
  `, { label: '담은 수업' });
}

/* --- 수업 취소 확인 (PRD §20.1) -------------------------------------------- */
function cancelConfirm({ id }) {
  const c = getClass(id);
  const e = state.data.enrollments.find((x) => x.classId === c.id && x.status !== 'cancelled');
  const isCoupon = e?.type === 'coupon';
  const m = c.startAt.getMonth();

  // 어느 수업인지는 설명 한 줄로 — 수업/날짜/시간을 각각 한 줄씩 쓰지 않는다.
  // 목록에는 "취소하고 나면 어떻게 되는지"만 남긴다. 지금 판단에 필요한 값이다.
  // 값은 전부 "취소하고 나면 어떻게 되는지"다
  const coupon = isCoupon ? couponById(e.couponId) : null;
  const rows = isCoupon
    ? [['쿠폰', coupon ? `${couponRemaining(coupon) + 1}/${coupon.total}회 남음` : '-']]
    : [
      ['취소', `${Math.max(0, cancelLeft(m) - 1)}/${cancelLimit(m)}회 남음`],
      ['보강', `${makeupAvailable() + 1}회 가능`],
    ];

  return confirmPopup({
    title: '이 수업을 취소할까요?',
    desc: `${esc(c.name)} · ${fmtMD(c.startAt)} (${WD_LABEL[c.startAt.getDay()]}) · ${timeRange(c)}`,
    body: infoList(rows),
    footNotice: infoNotice({
      tone: 'plain',
      text: isCoupon
        ? '쿠폰 사용 기간 안에 다른 수업을 신청할 수 있어요.'
        : `<b>${fmtMD(makeupDeadline(m))}</b> 안에 다른 수업을 신청할 수 있어요.`,
    }),
    actions: `<button class="btn btn--critical" data-action="do-cancel" data-id="${c.id}">수업 취소</button>`,
    label: '수업 취소 확인',
  });
}

/* --- 수강신청 통째로 취소 확인 ---------------------------------------------
   개별 수업 취소와 달리 그 달 등록이 전부 사라지므로 한 번 더 묻는다. */
function cancelEnrollConfirm({ month }) {
  const m = Number(month);
  const per = myPerWeek(m);
  const count = state.data.enrollments
    .filter((e) => e.type === 'regular' && getClass(e.classId)?.startAt.getMonth() === m).length;
  const plan = regularPrice(per);
  // 마감일은 아직 안 지났을 때만 — 중도 등록으로 열린 창은 마감일이 이미 지나 있다
  const { closeAt } = enrollmentWindow(m);

  return confirmPopup({
    title: `${m + 1}월 수강신청을 취소할까요?`,
    desc: `정규반 · 주${per}회 · ${count}회 수업`,
    body: infoList([
      ['취소되는 수업', `${count}회 전부`],
      ['환불 예정', plan ? won(plan.month) : '-'],
    ]),
    footNotice: infoNotice({
      tone: 'plain',
      text: closeAt > NOW
        ? `<b>${fmtMD(closeAt)}</b>까지는 다시 신청할 수 있어요.`
        : '신청 기간 안에서는 다시 신청할 수 있어요.',
    }),
    actions: `<button class="btn btn--critical" data-action="do-cancel-enroll" data-month="${m}">수강신청 취소</button>`,
    label: '수강신청 취소 확인',
  });
}

/* --- 필터 ----------------------------------------------------------------- */
// 시간대는 두지 않는다 — 목록에 시간이 그대로 보이고, 구간을 나눠도 걸러지는 게 거의 없다
const FILTERS = {
  weekday: ['월', '화', '수', '목', '금', '토', '일'],
  level: [...CLASS_NAMES],
  instructor: [...INSTRUCTORS],
};
const FILTER_LABEL = { weekday: '요일', level: '수업', instructor: '강사' };

function filterSheet() {
  const f = state.enroll.filter;
  const unit = filterUnit();
  const total = filterCount();

  return shell(`
    <h2 class="sheet__title">필터</h2>

    ${Object.entries(FILTERS).map(([key, opts]) => `
      <div class="mt-20">
        <div class="section__head" style="margin-bottom:10px">
          <p class="t-section">${FILTER_LABEL[key]}</p>
          ${f[key].length ? `<button class="section__more" data-action="clear-filter" data-key="${key}">해제</button>` : ''}
        </div>
        <div class="pills" style="flex-wrap:wrap">
          <button class="pill" aria-pressed="${f[key].length === 0}"
                  data-action="clear-filter" data-key="${key}">전체</button>
          ${opts.map((o) => {
    // 여러 개를 고를 수 있다. 다른 항목 조건에서 결과가 없는 옵션은 고를 수 없게 막는다.
    const selected = f[key].includes(o);
    const dead = !selected && filterCount({ [key]: [o] }) === 0;
    return `
            <button class="pill" aria-pressed="${selected}"
                    data-action="set-filter" data-key="${key}" data-value="${esc(o)}"
                    ${dead ? 'disabled' : ''}>${esc(o)}</button>`;
  }).join('')}
        </div>
      </div>`).join('')}

    <div class="sheet__actions btn-row">
      <button class="btn btn--primary" data-action="close-sheet" ${total ? '' : 'disabled'}>
        ${total ? `${unit} ${total}개 보기` : `조건에 맞는 ${unit}이 없어요`}
      </button>
      <button class="btn btn--ghost" data-action="reset-filter">초기화</button>
    </div>
  `, { label: '필터' });
}

/* --- 레벨 안내 -------------------------------------------------------------- */
/* --- 레벨 안내 --------------------------------------------------------------
   수업 상세의 인포 아이콘 → 그 레벨 하나만 짧게 (작은 팝업)
   수강신청의 레벨 안내 버튼 → 전체 목록
   -------------------------------------------------------------------------- */
/** 레벨명과 구성 시간은 한 줄에 마주 본다 — 구성은 오른쪽 (Figma ListLevelInfo) */
const guideBlock = (g) => `
  <p class="guide__target">${esc(g.target)}</p>
  <p class="guide__detail">${esc(g.detail)}</p>`;

/** 취소·보강 규칙 — 짧으니 작은 팝업으로 */
export function makeupGuidePopup() {
  const per = myPerWeek();
  return `
    <div class="popup-scrim" data-action="close-popup"></div>
    <div class="popup popup--compact" role="dialog" aria-modal="true" aria-label="취소·보강 안내">
      <div class="popup__head">
        <h2 class="popup__title">취소와 보강</h2>
        <button class="icon-btn icon-btn--sm" data-action="close-popup" aria-label="닫기">${icons.close()}</button>
      </div>
      <div class="popup__body">
        <p class="guide__detail">
          주 ${per}회 수강권은 한 달에 <strong>${cancelLimitFor(per)}번</strong>까지 취소할 수 있고,
          취소한 횟수만큼 다른 수업을 보강으로 신청할 수 있어요.
        </p>
        <p class="guide__detail">
          보강은 마감되지 않은 반에, 수업 <strong>하루 전날 자정까지</strong> 신청할 수 있어요.
          당일에는 취소도 보강 신청도 할 수 없어요.
        </p>
        ${QUOTA_UNCONFIRMED.includes(per)
          ? `<p class="footnote">* 주 ${per}회의 횟수는 운영 정책 확정 전이에요.</p>` : ''}
      </div>
    </div>`;
}

/** 레벨 안내 — 항상 전체 목록을 풀모달로. focus를 주면 그 레벨을 강조한다 */
export function levelGuidePopup({ focus } = {}) {
  return popupPanel({
    title: '레벨 안내',
    label: '레벨 안내',
    body: `
      <div class="guides">
        ${LEVEL_GUIDE.map((g) => `
          <div class="guide ${focus === g.name ? 'is-focus' : ''}">
            <div class="guide__top">
              <p class="guide__name">${esc(g.name)}</p>
              ${g.structure ? `<p class="guide__structure">${esc(g.structure)}</p>` : ''}
            </div>
            ${guideBlock(g)}
          </div>`).join('')}
      </div>
      <div class="mt-20">${infoNotice({
    tone: 'warn',
    text: '처음 발레를 시작할 때 자주 하는 질문은 발레75 블로그에서 확인하실 수 있어요.',
  })}</div>`,
    actions: `
      <a class="btn btn--outline" href="https://m.blog.naver.com/ballet_75_/223121484508"
         target="_blank" rel="noopener">발레75 블로그</a>`,
  });
}

/* --- 이용 내역 / 보강 내역 — 목록이 짧아 시트로 띄운다 -------------------- */
export function historySheet() {
  // 최근 3개월치만 — 그 이상은 관리자 문의
  const from = new Date(NOW.getFullYear(), NOW.getMonth() - 2, 1);
  const items = state.data.payments
    .filter((p) => parseYmd(p.at) >= from)
    .sort((a, b) => b.at.localeCompare(a.at));

  // 제목·안내는 sheet 헤더에 두어 고정하고, 목록만 body 안에서 스크롤한다
  const body = items.length
    ? historyList(items.map((p) => ({
      name: p.name,
      qty: p.qty,
      date: fmtMDDow(parseYmd(p.at)),
      amount: won(p.amount),
      refund: p.kind === 'refund',
    })))
    : emptyBox('아직 결제 내역이 없어요');

  return shell(body, { title: '결제 내역', desc: '최근 3개월 내역만 보여드려요', label: '결제 내역' });
}

/* --- 수강권 신청 내역 (Figma 56:13324 · 56:13288 · 56:13305 · 59:13733) ------
   수강권 카드를 누르면 열린다. "몇 회 남음"만으로는 알 수 없는
   '무엇에 썼는지'를 회차 단위로 펼쳐 준다.
   목록에는 예정·수강 완료·취소가 섞여 있어 공통분모는 '사용'이 아니라 '신청'이다.
   신청 기간이 열려 있는 달이면 신청 자체를 바꾸거나 무를 수 있다. */

/** 등록 한 건 → 목록 한 줄. 지난 회차와 취소분은 흐리게 두고 상태를 오른쪽에 적는다 */
function usageRow(e) {
  const c = getClass(e.classId);
  if (!c) return null;
  const cancelled = e.status === 'cancelled';
  const done = !cancelled && c.startAt <= NOW;
  return {
    id: c.id,
    title: c.name,
    meta: `${fmtMDDow(c.startAt)} ${timeRange(c)} · ${c.room ? `${c.instructor} · ${c.room}` : c.instructor}`,
    note: cancelled ? '취소' : done ? '사용 완료' : '',
    dim: cancelled || done,
    // 아직 안 지난 회차만 눌러서 상세(취소)로 갈 수 있다
    action: cancelled || done ? '' : 'class-detail',
    startAt: c.startAt,
  };
}

/** 작품반은 그 자체가 반 이름이라 '쿠폰'을 덧붙이지 않는다 */
const couponTitle = (c) => (c.kind === 'special'
  ? COUPON_KIND_LABEL[c.kind]
  : `${COUPON_KIND_LABEL[c.kind] ?? c.name} 쿠폰`);

const usageBody = (rows) => (rows.length
  ? classInfoList(rows)
  : emptyBox('아직 신청 내역이 없어요'));

function usageSheet({ kind, id, month }) {
  // 정규반 — 수강권 한 장(= 한 달)을 기준으로
  if (kind === 'regular') {
    const m = month === undefined ? NOW.getMonth() : Number(month);
    const term = termOf(m);
    const rows = state.data.enrollments
      .filter((e) => e.type === 'regular' && getClass(e.classId)?.startAt.getMonth() === m)
      .map(usageRow).filter(Boolean)
      .sort((a, b) => b.startAt - a.startAt);

    // 신청 기간이 열려 있는 동안에는 신청을 바꾸거나 통째로 무를 수 있다 (59:13733)
    const editable = rows.length && enrollmentWindow(m).open;

    return shell(usageBody(rows), {
      title: '신청 내역',
      // 기간이 먼저 — 이 수강권이 언제까지인지가 목록을 읽는 기준이다
      desc: `${term ? `${fmtYMD(term.start)} ~ ${fmtYMD(term.end)} · ` : ''}정규반 · 주${myPerWeek(m)}회`,
      label: '정규반 신청 내역',
      // 취소·보강 규칙은 상시 노출 대신 제목 옆 정보 아이콘 뒤에 둔다
      info: { action: 'makeup-guide', label: '취소·보강 안내' },
      actions: editable
        ? `<button class="btn btn--critical" data-action="ask-cancel-enroll" data-month="${m}">수강신청 취소</button>`
        : rows.length ? '' : '<button class="btn btn--outline" data-action="go-enroll">수강 신청</button>',
    });
  }

  // 쿠폰 — 그 쿠폰으로 신청한 회차만
  const coupon = couponById(id) ?? activeCoupons()[0];
  if (!coupon) return shell(emptyBox('수강권 정보를 찾을 수 없어요'), { title: '신청 내역' });

  const rows = state.data.enrollments
    .filter((e) => e.couponId === coupon.id)
    .map(usageRow).filter(Boolean)
    .sort((a, b) => b.startAt - a.startAt);

  // 만료가 코앞이고 회차가 남았을 때만 연장을 권한다 — 지나면 되살릴 수 없다
  const offerExtend = shouldOfferExtend(coupon);
  const left = couponRemaining(coupon);

  return shell(usageBody(rows), {
    title: '신청 내역',
    // 총 회차보다 '몇 번 신청했는지'가 아래 목록과 바로 맞물린다
    desc: `${fmtYMD(parseYmd(coupon.issuedAt))} ~ ${fmtYMD(parseYmd(coupon.expiresAt))} · ${couponTitle(coupon)} · ${coupon.used}/${coupon.total}회 신청`,
    label: '쿠폰 신청 내역',
    notice: offerExtend
      ? infoNotice({
        text: `<b>${fmtMD(parseYmd(coupon.expiresAt))}</b>에 만료되는 쿠폰이에요. 만료일이 지나면 사용할 수 없어요.`,
      })
      : '',
    // 연장이 먼저, 그다음이 이 쿠폰을 쓰는 일 — 기한을 놓치면 쓸 회차도 없다
    actions: [
      offerExtend
        ? `<button class="btn btn--accent" data-action="extend-coupon" data-id="${coupon.id}">${COUPON_EXTEND.days}일 연장 신청 · 결제하기</button>`
        : '',
      left > 0
        ? `<button class="btn btn--outline" data-action="use-coupon" data-id="${coupon.id}">수강 신청</button>`
        : '',
    ].join(''),
  });
}

/* --- 개인레슨 예약 조건 -----------------------------------------------------
   시간을 먼저 잡는 자리다. 캘린더에는 '강사가 비고 홀도 비는' 날만 열린다. */
const pillRow = (opts, current, action) => `
  <div class="pills">
    ${opts.map((o) => `
      <button class="pill" aria-pressed="${String(o.value) === String(current)}"
              data-action="${action}" data-value="${o.value}">${esc(o.label)}</button>`).join('')}
  </div>`;

const condField = (label, body) => `
  <div class="condfield"><p class="condfield__label">${esc(label)}</p>${body}</div>`;

function privateCondSheet() {
  const p = state.private;
  const opts = { dur: p.dur };
  const open = privateDates(p.month, opts);
  const openSet = new Set(open.map((d) => ymd(d)));
  const first = new Date(2026, p.month, 1);
  const days = new Date(2026, p.month + 1, 0).getDate();

  // 달력 — 예약할 수 있는 날만 누를 수 있다
  const cells = [
    ...['일', '월', '화', '수', '목', '금', '토'].map((l) => calendarMonthDay({ context: 'label', label: l })),
    ...Array.from({ length: first.getDay() }, () => calendarMonthDay({ context: 'blank' })),
    ...Array.from({ length: days }, (_, i) => {
      const d = new Date(2026, p.month, i + 1);
      const key = ymd(d);
      return calendarMonthDay({
        date: i + 1,
        state: !openSet.has(key) ? 'disabled' : p.date === key ? 'selected' : 'default',
        today: isSameDay(d, NOW),
        action: 'private-day',
        day: key,
      });
    }),
  ];

  const slots = p.date ? privateSlots(parseYmd(p.date), opts) : [];
  const series = p.mode === 'series' && p.seriesMode === 'repeat';

  return shell(`
    ${condField('예약 방식', segmentedControl({
    id: 'pmode',
    options: [{ value: 'once', label: '1회' }, { value: 'series', label: '여러 회' }],
    value: p.mode,
    action: 'private-mode',
    from: state.ui.segFrom?.pmode,
  }))}
    ${condField('수업시간', pillRow(
    PRIVATE_DURATIONS.map((d) => ({ value: d, label: `${d}분` })), p.dur, 'private-dur',
  ))}
    ${p.mode === 'series' ? condField('여러 회 방식', segmentedControl({
    id: 'pseries',
    options: [{ value: 'repeat', label: '반복 예약' }, { value: 'manual', label: '직접 여러 개 선택' }],
    value: p.seriesMode,
    action: 'private-series-mode',
    from: state.ui.segFrom?.pseries,
  })) : ''}
    ${series ? condField('반복 규칙', `
      ${pillRow(PRIVATE_REPEAT, p.every, 'private-every')}
      <div class="mt-8">${pillRow(
    PRIVATE_SERIES_COUNTS.map((n) => ({ value: n, label: `${n}회` })), p.count, 'private-count',
  )}</div>`) : ''}
    ${condField(series ? '시작하는 날' : '날짜', calendar({
    label: `${p.month + 1}월`,
    prev: 'private-month-prev',
    next: 'private-month-next',
    body: `<div class="calendar__grid">${cells.join('')}</div>`,
  }))}
    ${p.date ? condField('시작 시각', slots.length
    ? pillRow(slots.map((s) => ({ value: s.start, label: privateTime(s.start) })), null, 'private-time')
    : '<p class="t-support">이 날은 남는 시간이 없어요.</p>') : ''}
    ${condField(`선택된 회차${p.picks.length ? ` · ${p.picks.length}개` : ''}`, p.picks.length
    ? `<ul class="picklist">${p.picks.map((x, i) => `
        <li class="pickrow">
          <span>${esc(pickLine(x))}</span>
          <button class="pickrow__del" data-action="private-remove-pick" data-value="${i}">삭제</button>
        </li>`).join('')}</ul>`
    : '<p class="t-support">아직 선택된 회차가 없어요.</p>')}
  `, {
    title: '예약 조건',
    label: '개인레슨 예약 조건',
    actions: `<button class="btn btn--primary" data-action="close-sheet" ${p.picks.length ? '' : 'disabled'}>
      조건 반영하고 선생님 보기
    </button>`,
  });
}

/* --- 쿠폰 구매 -------------------------------------------------------------- */
function couponShopSheet() {
  const total = shopTotal();
  const count = shopCount();

  return bottomSheet({
    title: '쿠폰',
    body: `
      <div class="selectgroup">
        ${COUPON_KINDS.map((k) => {
    const p = COUPON_PRICE[k];
    return selectCard({
      title: p.name,
      meta: p.bundles ? `1회 ${won(p.unit)} · 묶음 할인 자동 적용` : `1회 ${won(p.unit)}`,
      control: stepper({
        value: state.shop[k] ?? 0, kind: k, dec: 'shop-dec', inc: 'shop-inc', max: 10,
      }),
    });
  }).join('')}
      </div>
      <ul class="notelist">
        <li>쿠폰 유효기간은 등록일 기준 ${COUPON_VALID_DAYS}일이에요.</li>
        <li>당일 취소는 불가하고, 결석 시 쿠폰이 차감돼요.</li>
        <li>모든 수업의 쿠폰 자리는 ${COUPON_SEATS}석이에요.</li>
        <li>만료 전에 ${COUPON_EXTEND.days}일 연장을 ${COUPON_EXTEND.times}회 할 수 있어요. (${won(COUPON_EXTEND.price)})</li>
      </ul>`,
    actions: `
      <button class="btn btn--primary" data-action="buy-coupon" ${count && total !== null ? '' : 'disabled'}>
        ${count && total !== null ? `${won(total)} 결제하기` : '결제하기'}
      </button>`,
    label: '쿠폰 구매',
    animate: state.ui.animateSheet,
  });
}


export function sheetView(entry) {
  const map = {
    'class-detail': classDetail,
    selected: selectedSheet,
    'cancel-confirm': cancelConfirm,
    'cancel-enroll': cancelEnrollConfirm,
    filter: filterSheet,
    'coupon-shop': couponShopSheet,
    'private-cond': privateCondSheet,
    usage: usageSheet,
    history: historySheet,
  };
  const fn = map[entry.name];
  return fn ? fn(entry.props || {}) : '';
}
