/* ==========================================================================
   발레75 — 디자인 시스템 컴포넌트
   Figma: Ballet75 / 내 수업 · Components (40:523)

   Figma의 컴포넌트 경계를 그대로 옮긴다.
     segmentedControl        (40:626)  → segmentedControl / segmentedOption
     calendar                (40:524)  → calendar
       calendar/weekDay      (40:613)  → calendarWeekDay
       calendar/monthDay     (40:587)  → calendarMonthDay
     classListCard/Group     (40:641)  → classListCard
     classListCard/List      (40:654)  → classListRow
   ========================================================================== */

import { esc, icons } from './ui.js';

/* --- segmentedControl (40:626) -------------------------------------------
   options: [{ value, label }]
   흰 알약은 옵션 배경이 아니라 따로 떠 있는 thumb다 — 그래야 미끄러질 수 있다.
   from(직전 값)이 오면 그 자리에서 현재 자리로 한 번 슬라이드한다.
   화면이 통째로 다시 그려지므로 transition이 아니라 keyframe으로 재생한다.      */
export const segmentedControl = ({
  id, options, value, action, from,
}) => {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  const fi = options.findIndex((o) => o.value === from);
  const move = fi >= 0 && fi !== i;
  return `
    <div class="segmented" data-seg="${esc(id ?? '')}"
         style="--n:${options.length};--i:${i}${move ? `;--from:${fi}` : ''}">
      <span class="segmented__thumb${move ? ' is-move' : ''}"></span>
      ${options.map((o) => `
        <button class="segmented__option" aria-selected="${o.value === value}"
                data-action="${action}" data-value="${esc(o.value)}">${esc(o.label)}</button>`).join('')}
    </div>`;
};

/* --- calendar (40:524) ----------------------------------------------------
   control(‹ 라벨 ›) + body. body는 weekDay 줄이나 monthDay 격자를 받는다.   */
export const calendar = ({ label, prev, next, body }) => `
  <div class="calendar">
    <div class="calendar__control">
      <button class="calendar__nav" data-action="${prev}" aria-label="이전">${icons.chevronLeft({ size: 20 })}</button>
      <p class="calendar__label">${esc(label)}</p>
      <button class="calendar__nav" data-action="${next}" aria-label="다음">${icons.chevronRight({ size: 20 })}</button>
    </div>
    ${body}
  </div>`;

/**
 * calendar/weekDay (40:613) — 요일 + 날짜를 함께 쌓는 66px 칸.
 * state: default | selected | disabled  ·  today면 아래에 점이 붙는다.
 */
export const calendarWeekDay = ({
  wd, date, state = 'default', today = false, action, day,
}) => {
  const cls = `calday calday--week is-${state}${today ? ' is-today' : ''}`;
  const inner = `
    <span class="calday__wd">${esc(wd)}</span>
    <span class="calday__n">${date}</span>
    ${today ? '<span class="calday__badge"></span>' : ''}`;
  return state === 'disabled'
    ? `<div class="${cls}">${inner}</div>`
    : `<button class="${cls}" data-action="${action}" data-day="${day}"
               aria-pressed="${state === 'selected'}">${inner}</button>`;
};

/**
 * calendar/monthDay (40:587) — 월 격자 한 칸.
 * context: label(요일 머리글) | day(날짜) | blank(앞뒤 빈칸)
 */
export const calendarMonthDay = ({
  context = 'day', label, date, state = 'default', today = false, action, day,
}) => {
  if (context === 'blank') return '<div class="calday calday--blank"></div>';
  if (context === 'label') return `<div class="calday calday--label">${esc(label)}</div>`;

  const cls = `calday calday--day is-${state}${today ? ' is-today' : ''}`;
  const inner = `<span class="calday__n">${date}</span>${today ? '<span class="calday__badge"></span>' : ''}`;
  return state === 'disabled'
    ? `<div class="${cls}">${inner}</div>`
    : `<button class="${cls}" data-action="${action}" data-day="${day}"
               aria-pressed="${state === 'selected'}">${inner}</button>`;
};

/* --- classListCard/Group (40:641) -----------------------------------------
   tone: default(흰 카드) | accent(#996994 채움 — 오늘)                      */
export const classListCard = ({ tone = 'default', rows }) =>
  `<div class="classcard${tone === 'accent' ? ' classcard--accent' : ''}">${rows.join('')}</div>`;

/**
 * classListCard/List (40:654) — 카드 안의 수업 한 줄.
 * 지난 수업은 흐리게 두되 상세는 계속 열 수 있다 (Figma의 disabled는 색만 차용).
 */
export const classListRow = ({
  id, start, end, title, meta, past = false, action = 'class-detail',
}) => `
  <button class="classrow${past ? ' is-past' : ''}" data-action="${action}" data-id="${id}">
    <span class="classrow__inner">
      <span class="classrow__time">
        <span class="classrow__start">${esc(start)}</span>
        <span class="classrow__end">~${esc(end)}</span>
      </span>
      <span class="classrow__info">
        <span class="classrow__title">${esc(title)}</span>
        <span class="classrow__meta">${esc(meta)}</span>
      </span>
      <span class="classrow__aside">${icons.chevronRight({ size: 24 })}</span>
    </span>
  </button>`;

/**
 * classCard (60:13977) — 홈 맨 위에 쌓이는 알림 한 줄.
 * 아이콘 20 + 문장 + (배지 | 셰브런). 문장 안의 숫자만 <b>로 굵게 한다.
 * tone: makeup(pointe/100) | coupon·guide(clara/100) | notice(giselle/50)
 */
export const alertCard = ({
  tone = 'notice', icon, text, badge, arrow = false, action, id = '',
}) => {
  const inner = `
    <span class="alert__icon">${icon}</span>
    <span class="alert__text">${text}</span>
    ${badge ? chip(badge) : ''}
    ${arrow ? `<span class="alert__aside">${icons.chevronRight({ size: 20 })}</span>` : ''}`;
  return action
    ? `<button class="alert alert--${tone}" data-action="${action}" data-id="${esc(id)}">${inner}</button>`
    : `<div class="alert alert--${tone}">${inner}</div>`;
};

/* ==========================================================================
   오버레이 — Figma Ballet75 / 내 수업 (41:2782 BottomSheet, 41:2877 Popup)
   ========================================================================== */

/**
 * BottomSheet (41:2782)
 * wrapper(흰 카드) 안에 grip · Header(제목 + 인포 + 설명) · Body · buttons.
 * body만 넘기면 예전처럼 자유 영역으로도 쓸 수 있다.
 */
export const bottomSheet = ({
  title, info, badge, desc, notice, body, footNotice, actions, label,
  animate = true, variant = '', close = 'close-sheet',
}) => `
  <div class="scrim${variant ? ` scrim--${variant}` : ''}${animate ? '' : ' is-static'}" data-action="${close}"></div>
  <div class="sheet${variant ? ` sheet--${variant}` : ''}${animate ? '' : ' is-static'}"
       role="dialog" aria-modal="true" ${label ? `aria-label="${esc(label)}"` : ''}>
    <button class="sheet__grip" data-action="${close}" aria-label="닫기"></button>
    <button class="sheet__close" data-action="${close}" aria-label="닫기">${icons.close({ size: 24 })}</button>
    ${title ? `
      <header class="sheet__header">
        <div class="sheet__titlerow">
          <h2 class="sheet__title">${esc(title)}</h2>
          ${info ? `
            <button class="sheet__info" data-action="${info.action}"
                    ${info.name ? `data-name="${esc(info.name)}"` : ''} aria-label="${esc(info.label || '안내')}">
              ${icons.info({ size: 20 })}
            </button>` : ''}
          ${badge || ''}
        </div>
        ${desc ? `<p class="sheet__desc">${desc}</p>` : ''}
      </header>` : ''}
    ${notice || ''}
    <div class="sheet__body">${body}</div>
    ${footNotice || actions ? `
      <div class="sheet__footer">
        ${footNotice || ''}
        ${actions || ''}
      </div>` : ''}
  </div>`;

/**
 * Popup (41:2899 Sticky)
 * 화면을 덮는 패널. 헤더는 항상 고정이고, 내용이 그 아래로 들어가면
 * 구분선이 켜진다(.is-stuck — app.js에서 스크롤에 맞춰 토글).
 * Figma의 비고정 변형은 쓰는 화면이 없어 두지 않는다.
 */
export const popupPanel = ({
  title, body, actions, close = 'close-popup', label,
}) => `
  <div class="popup" role="dialog" aria-modal="true" aria-label="${esc(label || title || '')}">
    <header class="popup__header">
      <h2 class="popup__title">${esc(title)}</h2>
      <button class="popup__close" data-action="${close}" aria-label="닫기">${icons.close()}</button>
    </header>
    <div class="popup__body">
      ${body}
      ${actions ? `<div class="popup__actions">${actions}</div>` : ''}
    </div>
  </div>`;

/** List/ItemBasic — 라벨·값 한 줄씩 쌓는 정보 목록 */
export const infoList = (rows) => `
  <dl class="infolist">
    ${rows.map(([k, v]) => `
      <div class="infolist__row">
        <dt>${esc(k)}</dt><dd>${esc(v)}</dd>
      </div>`).join('')}
  </dl>`;

/**
 * List/ItemHistory (56:12794)
 * 무엇을 얼마나 샀는지 왼쪽, 금액은 오른쪽. 줄 사이에만 구분선이 있다.
 * rows: [{ name, qty, date, amount }]
 */
export const historyList = (rows) => `
  <ul class="histlist">
    ${rows.map(({ name, qty, date, amount, refund }) => `
      <li class="histrow">
        <div class="histrow__content">
          <p class="histrow__head">${esc(name)}${qty ? ` · ${esc(qty)}` : ''}</p>
          <p class="histrow__desc">${esc(date)}</p>
        </div>
        <p class="histrow__amount${refund ? ' histrow__amount--refund' : ''}">${esc(amount)}</p>
      </li>`).join('')}
  </ul>`;

/**
 * List/ItemClassInfo (56:13337)
 * 수강권으로 들은(들을) 수업 한 줄. 지난 회차는 흐리게 두고 오른쪽에 상태를 적는다.
 * rows: [{ id, title, meta, note, dim, action }]
 */
export const classInfoList = (rows) => `
  <ul class="cilist">
    ${rows.map(({ id, title, meta, note, dim, action }) => {
    const inner = `
      <span class="cirow__info">
        <span class="cirow__title">${esc(title)}</span>
        <span class="cirow__meta">${esc(meta)}</span>
      </span>
      ${note ? `<span class="cirow__note">${esc(note)}</span>` : ''}`;
    return `
      <li class="cirow${dim ? ' cirow--dim' : ''}">
        ${action
    ? `<button class="cirow__body" data-action="${action}" data-id="${id}">${inner}</button>`
    : `<div class="cirow__body">${inner}</div>`}
      </li>`;
  }).join('')}
  </ul>`;

/** 목록이 비었을 때 자리를 지키는 회색 박스 (56:13318) */
export const emptyBox = (text) => `<div class="emptybox"><p>${esc(text)}</p></div>`;

/** classCard — 아이콘 + 문장 한 덩어리의 안내 박스. tone: notice | warn */
export const infoNotice = ({ text, tone = 'notice' }) => `
  <div class="infonotice infonotice--${tone}">
    <span class="infonotice__icon">${icons.infoFilled({ size: 20 })}</span>
    <p class="infonotice__text">${text}</p>
  </div>`;

/* ==========================================================================
   수강권 — Figma Ballet75 / ClassCard (53:11590)
   ========================================================================== */

/** chips (53:11588) — 짙은 알약 배지 */
export const chip = (label) => `<span class="chip">${esc(label)}</span>`;

/**
 * ClassCard (53:11590) — 195×182 고정 카드.
 *   type   : regular(75pointe/100) | coupon · special(75clara/100)
 *   kind   : 정규반 / 쿠폰
 *   title  : 주2회 / 5회권 / 작품반
 *   term   : 2026. 8. 4 ~ 2026. 8. 31
 *   badge  : 16일 남음
 *   rows   : [[라벨, 값], …]  — 아래 반투명 블록에 한 줄씩
 */
export const classCard = ({
  type = 'regular', kind, title, term, badge, rows = [], action, id = '',
}) => `
  <button class="pass pass--${type}" data-action="${action}" data-id="${esc(id)}">
    <span class="pass__info">
      <span class="pass__top">
        <span class="pass__title">
          <span class="pass__kind">${esc(kind)}</span>
          <span class="pass__name">${esc(title)}</span>
        </span>
        ${badge ? chip(badge) : ''}
      </span>
      ${term ? `<span class="pass__term">${esc(term)}</span>` : ''}
    </span>
    <span class="pass__desc">
      ${rows.map(([k, v]) => `
        <span class="pass__row"><span class="pass__k">${esc(k)}</span><span class="pass__v">${esc(v)}</span></span>`).join('')}
    </span>
  </button>`;

/**
 * 수강권 캐러셀 — 한 화면에 두 장이 보이므로 점은 카드가 아니라 '페이지' 수만큼 찍는다.
 * (카드 4장 → 점 2개)
 */
export const classCardList = (cards, perPage = 2) => {
  const pages = Math.ceil(cards.length / perPage);
  return `
    <div class="passwrap">
      <div class="passlist">${cards.join('')}</div>
      ${pages > 1
    ? `<div class="passdots" data-per-page="${perPage}">${
      Array.from({ length: pages }, (_, i) => `<span class="passdot${i === 0 ? ' is-on' : ''}"></span>`).join('')
    }</div>`
    : ''}
    </div>`;
};

/* --- selectCard + stepper — Figma 쿠폰 구매 시트 (55:12583) ---------------- */

/** stepper — 빼기 / 수량 / 더하기. 수량 0이면 빼기 버튼이 비활성이다 */
export const stepper = ({ value, dec, inc, kind, max }) => `
  <span class="stepper">
    <button class="stepper__btn" data-action="${dec}" data-kind="${kind}"
            aria-label="줄이기" ${value <= 0 ? 'disabled' : ''}>${icons.minus({ size: 20 })}</button>
    <span class="stepper__num">${value}</span>
    <button class="stepper__btn" data-action="${inc}" data-kind="${kind}"
            aria-label="늘리기" ${max != null && value >= max ? 'disabled' : ''}>${icons.plus({ size: 20 })}</button>
  </span>`;

/** selectCard — 이름·설명 왼쪽, 오른쪽에 조작부 */
export const selectCard = ({ title, meta, control }) => `
  <div class="selectcard">
    <span class="selectcard__label">
      <span class="selectcard__title">${esc(title)}</span>
      ${meta ? `<span class="selectcard__meta">${esc(meta)}</span>` : ''}
    </span>
    ${control}
  </div>`;
