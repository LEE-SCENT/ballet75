/* ==========================================================================
   발레75 — 개인레슨 예약 (POLICY §개인레슨)
   정규반·쿠폰과 달리 회원이 자리를 잡는 게 아니라 가능한 시간을 골라
   요청을 보내고, 선생님 확인 → 원장 승인을 거쳐 확정된다.
   그래서 선생님을 지정해도 '신청'이 아니라 '후보'다.

   순서도 반대다 — 조건(시간)을 먼저 잡고, 그 시간에 되는 선생님을 본다.
   ========================================================================== */

import {
  state, privateTeachers, privateTime, privateAmount, fmtMDDow, parseYmd, won,
} from '../state.js';
import {
  INSTRUCTORS, INSTRUCTOR_PROFILE, PRIVATE_PRICE, PRIVATE_DURATIONS,
} from '../data.js';
import { esc, icons, subHeader } from '../ui.js';
import { segmentedControl, infoNotice, emptyBox, chip } from '../components.js';

const TABS = [{ value: 'book', label: '예약하기' }, { value: 'requests', label: '내 요청' }];

export const teacherName = (short) => INSTRUCTOR_PROFILE[short]?.name ?? short;

/** 회차 한 줄 — 9월 3일 (목) 08:00 · A홀 */
export const pickLine = (p) =>
  `${fmtMDDow(parseYmd(p.ymd))} ${privateTime(p.start)}${p.room ? ` · ${p.room}` : ''}`;

/* --- 예약하기 -------------------------------------------------------------- */

/** 조건 요약 — 아직 안 잡았으면 무엇을 하는 자리인지 그대로 적는다 */
function condRow() {
  const { picks, dur, mode } = state.private;
  const value = picks.length
    ? `${mode === 'series' ? '여러 회' : '1회'} · ${dur}분 · ${picks.length}개 선택`
    : '';
  return `
    <button class="condrow" data-action="private-cond">
      <span class="condrow__body">
        <span class="condrow__label">날짜, 시간으로 검색</span>
        <span class="condrow__value">${value || '날짜, 시간으로 검색'}</span>
      </span>
      ${icons.chevronDown({ size: 20 })}
    </button>`;
}

function teacherCard(short) {
  const p = INSTRUCTOR_PROFILE[short] ?? { name: short, tags: [] };
  return `
    <button class="teacher" data-action="private-submit" data-value="${esc(short)}">
      <span class="teacher__avatar">${esc(p.name.slice(0, 1))}</span>
      <span class="teacher__body">
        <span class="teacher__top">
          <span class="teacher__name">${esc(p.name)}</span>
          <span class="teacher__tag">후보</span>
        </span>
        <span class="teacher__meta">발레 개인레슨 · 맞춤 지도</span>
        ${p.tags.length ? `<span class="teacher__tags">${p.tags.map(chip).join('')}</span>` : ''}
      </span>
    </button>`;
}

function bookTab() {
  const { picks, dur } = state.private;
  const list = picks.length ? privateTeachers(picks, dur) : INSTRUCTORS;

  return `
    ${condRow()}
    <button class="reco mt-12" data-action="private-submit" data-value="">
      <span class="reco__title">학원 추천</span>
      <span class="reco__desc">시간 후보를 먼저 보내주시면 학원에서 선생님을 배정해요.</span>
    </button>
    ${picks.length ? `<p class="t-meta mt-16">고른 시간에 가능한 선생님 ${list.length}명</p>` : ''}
    <div class="teachers mt-12">
      ${list.length
    ? list.map(teacherCard).join('')
    : emptyBox('고른 시간에 가능한 선생님이 없어요')}
    </div>
    <p class="footnote">${picks.length
    ? '선생님을 고르면 요청이 전송돼요. 확정 전이라 결제되지 않아요.'
    : '먼저 위에서 날짜와 시간을 골라 주세요.'}</p>`;
}

/* --- 내 요청 --------------------------------------------------------------- */
const STATUS_TEXT = { pending: '확인 중', approved: '승인', rejected: '반려' };

const requestCard = (r) => `
  <div class="reqcard">
    <div class="reqcard__top">
      <p class="reqcard__title">${r.teacher ? `${esc(teacherName(r.teacher))} 선생님` : '학원 추천'}</p>
      <span class="status status--${r.status}">${STATUS_TEXT[r.status] ?? r.status}</span>
    </div>
    <p class="reqcard__meta">${r.mode === 'series' ? `여러 회 ${r.picks.length}회` : `1회 · 후보 ${r.picks.length}개`} · ${r.dur}분 · ${won(r.amount)}</p>
    <ul class="reqcard__when">
      ${r.picks.map((p) => `<li>${esc(pickLine(p))}</li>`).join('')}
    </ul>
    ${r.status === 'pending' ? '<p class="footnote">승인되면 결제 안내를 드려요. 요청 시점에는 결제되지 않아요.</p>' : ''}
  </div>`;

function requestsTab() {
  const list = state.data.privateRequests.slice().reverse();
  if (!list.length) return emptyBox('아직 개인레슨 요청이 없어요');
  return `<div class="reqlist">${list.map(requestCard).join('')}</div>`;
}

/* --- page ------------------------------------------------------------------ */
export function privatePage() {
  const { tab } = state.private;
  return `
    ${subHeader('개인레슨 예약')}
    <div class="content content--bare">
      <div class="mt-12">
        ${infoNotice({
    tone: 'plain',
    text: '가능한 시간 중에서 골라 요청하면 <b>선생님 확인과 원장 승인</b> 후 확정돼요.',
  })}
      </div>
      <div class="mt-16">
        ${segmentedControl({
    id: 'private', options: TABS, value: tab, action: 'private-tab', from: state.ui.segFrom?.private,
  })}
      </div>
      <div class="mt-16">${tab === 'book' ? bookTab() : requestsTab()}</div>
      <p class="footnote">개인레슨은 ${PRIVATE_DURATIONS.map((d) => `${d}분 ${won(PRIVATE_PRICE[d])}`).join(' · ')}이고, 여러 회도 할인 없이 회차만큼 계산돼요.</p>
    </div>`;
}

export { privateAmount };
