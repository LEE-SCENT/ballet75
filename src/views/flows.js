/* ==========================================================================
   발레75 — Stacked flow pages
   신청 확인 / 신청 완료 / 신청 실패 / 보강 신청 / 보강 완료 / 취소 완료
   (PRD §16–18, §21, §23–24, §29)
   ========================================================================== */

import {
  state, getClass, selection, bookingMethods, makeupDeadline, makeupAvailable,
  cancelLeft, cancelLimit, activeCoupons, couponRemaining,
  timeRange, fmtFullDate, fmtMD, won,
} from '../state.js';
import { NOW } from '../data.js';
import { infoList } from '../components.js';
import { esc, icons, subHeader, placeLine } from '../ui.js';
import { privatePage } from './private.js';

const WD_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

/** 담은 반 1건 — 요일·시간과 그 달의 회차를 함께 보여준다 */
const slotLine = (s, month) => `
  <div class="slotline">
    <p class="slotline__name">${esc(s.name)}</p>
    <p class="slotline__meta">${WD_LABEL[s.day]}요일 ${s.timeRange} · ${s.room ? `${esc(s.instructor)} · ${esc(s.room)}` : esc(s.instructor)}</p>
    <p class="slotline__dates">${month + 1}월 ${s.count ?? s.remaining.length}회 · ${(s.dates ?? s.remaining.map((c) => c.startAt.getDate())).join('·')}일</p>
  </div>`;

/** 수강료는 반 종류가 아니라 주 N회로 정해진다 */
const totalRow = ({ perWeek, sessions, total, plan, makeup }) => `
  <div class="total">
    <div class="kv"><span class="k">주 ${perWeek}회 · ${sessions}회 수업</span><span class="v">회당 ${won(plan.perSession)}</span></div>
    <div class="kv"><span class="k">취소 · 보강</span><span class="v">월 ${makeup}회</span></div>
    <div class="kv total__sum"><span class="k">월 수강료</span><span class="v">${won(total)}</span></div>
  </div>`;

/* --- 신청 확인 (PRD §17) --------------------------------------------------- */
function confirmPage() {
  const sel = selection();
  const { slots, perWeek } = sel;
  const month = state.enroll.month;

  return `
    ${subHeader('수강 신청')}
    <div class="content content--bare">
      <h1 class="t-page mt-8">${month + 1}월 · 주 ${perWeek}회<br>이대로 신청할까요?</h1>

      <div class="mt-24 card">
        ${slots.map((s) => slotLine(s, month)).join('')}
      </div>

      ${sel.plan ? `<div class="mt-16">${totalRow(sel)}</div>` : ''}

      <div class="mt-20 notice">수업 취소는 하루 전날 자정까지 가능하고, 당일 취소는 할 수 없어요.</div>
      <p class="footnote">* 수강료는 4주(28일) 수업 기준입니다. 결제 시점·방식은 운영 정책 확정 후 안내됩니다.</p>

      <div class="footbar footbar--push">
        <button class="btn btn--primary" data-action="submit-regular">신청하기</button>
      </div>
    </div>`;
}

/* --- 신청 완료 (PRD §18) --------------------------------------------------- */
function completePage(props) {
  const r = props.receipt;
  if (!r) return '';
  return `
    <div class="content content--bare">
      <div class="result">
        <div class="result__mark">${icons.check({ size: 24 })}</div>
        <h1 class="result__title">수강 신청이 완료됐어요</h1>
        <p class="t-support mt-16">${r.month + 1}월 · 주 ${r.perWeek}회 · ${r.sessions}회 수업${r.total ? ` · ${won(r.total)}` : ''}</p>
        <div class="result__body card">${r.slots.map((s) => slotLine(s, r.month)).join('')}</div>
        <p class="t-support mt-16">한 달에 ${r.makeup}번까지 취소하고, 취소한 만큼 보강으로 신청할 수 있어요.</p>
        <p class="footnote">신청 결과와 결제 안내는 확인 후 알려드려요.</p>
      </div>
      <div class="footbar footbar--push">
        <div class="btn-row">
          <button class="btn btn--primary" data-action="go-my">내 수업 보기</button>
          <button class="btn btn--ghost" data-action="continue-enroll">수강신청 계속하기</button>
        </div>
      </div>
    </div>`;
}

/* --- 신청 실패 (PRD §29) --------------------------------------------------- */
function submitErrorPage() {
  return `
    ${subHeader('수강 신청')}
    <div class="content content--bare">
      <div class="result">
        <div class="result__mark result__mark--neutral">${icons.close()}</div>
        <h1 class="result__title">수강 신청을<br>완료하지 못했어요</h1>
        <p class="t-support mt-16">선택한 수업은 유지됩니다.</p>
      </div>
      <div class="footbar footbar--push">
        <div class="btn-row">
          <button class="btn btn--primary" data-action="submit-regular">다시 신청하기</button>
          <button class="btn btn--ghost" data-action="back-to-enroll">담은 수업 확인</button>
        </div>
      </div>
    </div>`;
}

/* --- 단건 신청 확인 (보강 · 쿠폰) — PRD §23 ------------------------------- */
function makeupConfirmPage(props) {
  const c = getClass(props.classId);
  const methods = bookingMethods(c);
  const picked = state.enroll.payWith;

  // 진입할 때 잡아둔 수단을 기본으로, 안 되면 쓸 수 있는 첫 수단으로
  const isPicked = (m) => (picked?.kind === 'coupon'
    ? m.kind === 'coupon' && m.couponId === picked.couponId
    : m.kind === picked?.kind);
  const current = methods.find((m) => m.enabled && isPicked(m)) || methods.find((m) => m.enabled);

  return `
    ${subHeader('수업 신청')}
    <div class="content content--bare">
      <h1 class="t-page mt-8">이 수업을 신청할까요?</h1>

      <div class="mt-24 flowbox">
        <p class="flowbox__name">${esc(c.name)}</p>
        <p class="flowbox__meta">${fmtFullDate(c.startAt)}<br>${timeRange(c)}<br>${placeLine(c)}</p>
      </div>

      <section class="section" style="margin-top:24px">
        <div class="section__head"><h2 class="t-section">무엇으로 신청할까요?</h2></div>
        <div class="methods">
          ${methods.map((m) => `
            <button class="method" data-state="${m.enabled ? 'on' : 'off'}"
                    aria-pressed="${current && isSame(m, current)}"
                    data-action="pick-method" data-kind="${m.kind}" data-coupon="${m.couponId || ''}"
                    ${m.enabled ? '' : 'disabled'}>
              <span class="method__name">${esc(m.label)}</span>
              <span class="method__meta">${m.enabled ? esc(m.detail) : esc(m.reason)}</span>
            </button>`).join('')}
        </div>
      </section>

      <div class="mt-20 notice">
        ${current?.kind === 'coupon'
          ? '신청하면 쿠폰 1회가 차감돼요. 당일 취소와 결석 시에는 복구되지 않아요.'
          : `이번 달 보강 1회를 사용해요. ${fmtMD(makeupDeadline())}까지 신청할 수 있어요.`}
      </div>

      <div class="footbar footbar--push">
        <button class="btn btn--primary" data-action="submit-booking" data-id="${c.id}" ${current ? '' : 'disabled'}>
          ${current ? `${esc(current.label)}으로 신청` : '신청할 수 있는 수단이 없어요'}
        </button>
      </div>
    </div>`;
}

const isSame = (a, b) => a.kind === b.kind && (a.couponId || '') === (b.couponId || '');

/* --- 보강 완료 (PRD §24) --------------------------------------------------- */
function makeupCompletePage(props) {
  const c = getClass(props.classId);
  return `
    <div class="content content--bare">
      <div class="result">
        <div class="result__mark">${icons.check({ size: 24 })}</div>
        <h1 class="result__title">수업 신청이 완료됐어요</h1>
        ${props.method ? `<p class="t-support mt-16">${esc(props.method)}을 사용했어요.</p>` : ''}
        <div class="result__body flowbox">
          <p class="flowbox__name">${esc(c.name)}</p>
          <p class="flowbox__meta">${fmtFullDate(c.startAt)}<br>${timeRange(c)}<br>${placeLine(c)}</p>
        </div>
      </div>
      <div class="footbar footbar--push">
        <button class="btn btn--primary" data-action="go-my">내 수업 보기</button>
      </div>
    </div>`;
}

/* --- 취소 완료 (Figma 50:8489) --------------------------------------------
   바텀 네비를 덮지 않는다 — 취소 뒤에도 여기가 '내 수업'이라는 맥락이 남는다. */
function cancelCompletePage(props) {
  const isCoupon = props.type === 'coupon';
  const m = NOW.getMonth();
  const coupon = activeCoupons()[0];

  const rows = isCoupon
    ? [['쿠폰', `${coupon ? couponRemaining(coupon) : 0}회 남음`]]
    : [
      ['취소', `${cancelLeft(m)}/${cancelLimit(m)}회 남음`],
      ['보강', `${makeupAvailable()}회 가능`],
    ];

  return `
    <div class="result">
      <span class="result__mark">${icons.flowerCheck({ size: 96 })}</span>
      <div class="result__head">
        <p class="result__title">수업을 취소했어요</p>
      </div>
      ${infoList(rows)}
      <div class="result__actions">
        <button class="btn btn--primary" data-action="${isCoupon ? 'use-coupon' : 'find-makeup'}">
          ${isCoupon ? '쿠폰으로 신청하기' : '보강 수업 찾기'}
        </button>
        <button class="btn btn--outline" data-action="go-my">내 수업으로</button>
      </div>
    </div>`;
}

/* --- router --------------------------------------------------------------- */
export function stackPage(entry) {
  const { name, props = {} } = entry;
  const map = {
    confirm: confirmPage,
    complete: completePage,
    'submit-error': submitErrorPage,
    'makeup-confirm': makeupConfirmPage,
    'makeup-complete': makeupCompletePage,
    'cancel-complete': cancelCompletePage,
    private: privatePage,
  };
  const fn = map[name];
  const withNav = name === 'cancel-complete' ? ' stack-page--withnav' : '';
  return `<div class="stack-page${withNav} ${state.ui.animateStack ? '' : 'is-static'}">${fn ? fn(props) : ''}</div>`;
}
