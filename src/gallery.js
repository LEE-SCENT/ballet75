/* ==========================================================================
   발레75 — 디자인 시스템 갤러리
   components.js를 그대로 import해 렌더한다. 문서용으로 다시 그리지 않으므로
   컴포넌트를 고치면 이 페이지도 함께 바뀐다. (components.html에서 연다)
   ========================================================================== */

import {
  segmentedControl, calendar, calendarWeekDay, calendarMonthDay,
  classListCard, classListRow, alertCard,
  bottomSheet, popupPanel,
  infoList, historyList, classInfoList, emptyBox, infoNotice, chip,
  classCard, classCardList, stepper, selectCard,
} from './components.js';
import { icons } from './ui.js';

/* --- 뼈대 ------------------------------------------------------------------ */
const group = (name, items) => `
  <section class="grp">
    <h2 class="grp__name">${name}</h2>
    ${items.join('')}
  </section>`;

const item = ({ name, node, desc, body }) => `
  <article class="item">
    <div class="item__top">
      <h3 class="item__name">${name}</h3>
      ${node ? `<span class="item__node">${node}</span>` : ''}
    </div>
    ${desc ? `<p class="item__desc">${desc}</p>` : ''}
    ${body}
  </article>`;

const canvas = (inner, { label = '', sub = false, narrow = false } = {}) => `
  <div class="canvas${sub ? ' canvas--sub' : ''}">
    ${label ? `<p class="canvas__label">${label}</p>` : ''}
    <div class="${narrow ? 'w430' : ''}">${inner}</div>
  </div>`;

/* --- 예시 데이터 ------------------------------------------------------------ */
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const rows = (n = 2) => Array.from({ length: n }, (_, i) => classListRow({
  id: `demo-${i}`,
  start: ['10:30', '12:00'][i] ?? '19:00',
  end: ['11:50', '13:20'][i] ?? '20:20',
  title: ['베이직', '레벨1 준비반'][i] ?? '레벨2',
  meta: '경리T · A홀',
  past: false,
  action: 'noop',
}));

/* --- 섹션 ------------------------------------------------------------------ */
const sections = [
  group('폼 · 탐색', [
    item({
      name: 'segmentedControl', node: '40:626',
      desc: '흰 알약은 옵션 배경이 아니라 따로 떠 있는 thumb다 — 그래야 값이 바뀔 때 미끄러진다.',
      body: canvas(`<div class="col">
        ${segmentedControl({ id: 'g1', options: [{ value: 'a', label: '주간' }, { value: 'b', label: '월간' }], value: 'a', action: 'noop' })}
        ${segmentedControl({ id: 'g2', options: [{ value: 'a', label: '1회' }, { value: 'b', label: '여러 회' }], value: 'b', action: 'noop' })}
      </div>`, { narrow: true }),
    }),
    item({
      name: 'stepper',
      desc: '쿠폰 구매 수량. 0에서는 빼기가 잠긴다.',
      body: canvas(`<div class="row">
        ${stepper({ value: 0, dec: 'noop', inc: 'noop', kind: 'a', max: 10 })}
        ${stepper({ value: 3, dec: 'noop', inc: 'noop', kind: 'b', max: 10 })}
      </div>`),
    }),
    item({
      name: 'selectCard',
      desc: '이름·설명 왼쪽, 컨트롤 오른쪽. 쿠폰 구매 시트에서 stepper와 함께 쓴다.',
      body: canvas(selectCard({
        title: '일반 쿠폰',
        meta: '1회 33,000원 · 묶음 할인 자동 적용',
        control: stepper({ value: 2, dec: 'noop', inc: 'noop', kind: 'c', max: 10 }),
      }), { narrow: true }),
    }),
  ]),

  group('캘린더', [
    item({
      name: 'calendar · calendarWeekDay', node: '40:524 · 40:613',
      desc: '주간 — 요일과 날짜를 함께 쌓는 칸. 오늘은 아래에 점이 붙는다.',
      body: canvas(calendar({
        label: '8월 9일 - 15일', prev: 'noop', next: 'noop',
        body: `<div class="calendar__week">${WD.map((w, i) => calendarWeekDay({
    wd: w, date: 9 + i, action: 'noop', day: `d${i}`,
    state: i === 6 ? 'selected' : i < 2 ? 'disabled' : 'default',
    today: i === 6,
  })).join('')}</div>`,
      }), { narrow: true }),
    }),
    item({
      name: 'calendarMonthDay', node: '40:587',
      desc: 'context — label(요일 머리글) / day(날짜) / blank(앞뒤 빈칸)',
      body: canvas(`<div class="calendar__grid">
        ${WD.map((w) => calendarMonthDay({ context: 'label', label: w })).join('')}
        ${Array.from({ length: 6 }, () => calendarMonthDay({ context: 'blank' })).join('')}
        ${Array.from({ length: 15 }, (_, i) => calendarMonthDay({
    date: i + 1, action: 'noop', day: `m${i}`,
    state: i === 7 ? 'selected' : i % 3 === 0 ? 'disabled' : 'default',
    today: i === 7,
  })).join('')}
      </div>`, { narrow: true }),
    }),
  ]),

  group('수업 목록', [
    item({
      name: 'classListCard · classListRow', node: '40:641 · 40:654',
      desc: 'tone — default(흰 카드) / accent(오늘). 지난 수업은 색만 죽이고 상세는 계속 열린다.',
      body: canvas(`<div class="col">
        ${classListCard({ rows: rows(2) })}
        ${classListCard({ tone: 'accent', rows: rows(2) })}
        ${classListCard({
    rows: [classListRow({
      id: 'p', start: '10:30', end: '11:50', title: '베이직', meta: '경리T · A홀', past: true, action: 'noop',
    })],
  })}
      </div>`, { narrow: true }),
    }),
    item({
      name: 'classInfoList', node: '56:13337',
      desc: '수강권으로 들은 회차. 지난 것과 취소분은 흐리게 두고 상태를 오른쪽에 적는다.',
      body: canvas(classInfoList([
        { id: 1, title: '레벨2', meta: '8월 25일 (화) 10:20~11:40 · 소정T · A홀' },
        { id: 2, title: '베이직', meta: '8월 11일 (화) 10:30~11:50 · 경리T · A홀', note: '사용 완료', dim: true },
        { id: 3, title: '레벨2', meta: '8월 4일 (화) 10:20~11:40 · 소정T · A홀', note: '취소', dim: true },
      ]), { narrow: true }),
    }),
    item({
      name: 'historyList', node: '56:12794',
      desc: '무엇을 얼마나 샀는지 왼쪽, 금액은 오른쪽. 환불은 음수 + 빨간색.',
      body: canvas(historyList([
        { name: '발레스트레칭 쿠폰', qty: '5회', date: '8월 10일 (월)', amount: '125,000원' },
        { name: '8월 정규반', qty: '주3회', date: '7월 20일 (월)', amount: '277,000원' },
        { name: '8월 정규반', qty: '주3회', date: '8월 15일 (토)', amount: '-277,000원', refund: true },
      ]), { narrow: true }),
    }),
    item({
      name: 'infoList',
      desc: '라벨·값 한 줄씩. 수업 상세와 취소 확인에서 쓴다.',
      body: canvas(infoList([['수업', '베이직'], ['날짜', '8월 15일 토요일'], ['구분', '정규반']]), { narrow: true }),
    }),
  ]),

  group('카드 · 안내', [
    item({
      name: 'alertCard', node: '60:13977',
      desc: '홈 맨 위에 쌓이는 알림. 문장 안의 숫자만 굵게. tone — makeup / coupon / guide / notice',
      body: canvas(`<div class="col">
        ${alertCard({ tone: 'notice', icon: icons.infoFilled({ size: 20 }), text: '기존 회원 수강신청은 <b>8월 20일</b>부터 가능해요' })}
        ${alertCard({ tone: 'makeup', icon: icons.flower({ size: 20 }), text: '이번 달 보강 가능한 수업이 <b>2회</b> 있어요', badge: '16일 남음' })}
        ${alertCard({ tone: 'coupon', icon: icons.ticket(true), text: '9/4까지 사용 가능한 쿠폰이 <b>3회</b> 남았어요', badge: '20일 남음' })}
        ${alertCard({ tone: 'guide', icon: icons.infoFilled({ size: 20 }), text: '발레를 처음 시작하는 분들을 위한 Q&amp;A', arrow: true, action: 'noop' })}
      </div>`, { narrow: true }),
    }),
    item({
      name: 'classCard · classCardList', node: '53:11590',
      desc: '수강권 카드. 한 화면에 두 장이 보이므로 점은 카드 수가 아니라 페이지 수만큼 찍는다.',
      body: canvas(classCardList([
        classCard({
          type: 'regular', kind: '8월 정규반', title: '주3회', term: '2026. 8. 4 ~ 2026. 8. 31',
          rows: [['취소', '1/2회 남음'], ['보강', '1회 가능']], action: 'noop',
        }),
        classCard({
          type: 'coupon', kind: '쿠폰', title: '일반', term: '2026. 7. 22 ~ 2026. 8. 21',
          badge: '6일 남음', rows: [['잔여', '3/5회 남음']], action: 'noop',
        }),
        classCard({
          type: 'coupon', kind: '쿠폰', title: '작품반', term: '2026. 8. 4 ~ 2026. 9. 28',
          rows: [['잔여', '6/8회 남음']], action: 'noop',
        }),
      ]), { narrow: true }),
    }),
    item({
      name: 'infoNotice', node: '41:2794',
      desc: 'tone — notice(giselle/50) / warn(clara/200) / plain(배경 없음)',
      body: canvas(`<div class="col">
        ${infoNotice({ text: '당일 수업은 취소할 수 없어요. 취소는 <b>하루 전날 자정</b>까지 가능해요.' })}
        ${infoNotice({ tone: 'warn', text: '마감된 수업이에요.' })}
        ${infoNotice({ tone: 'plain', text: '<b>8월 31일</b> 안에 다른 수업을 신청할 수 있어요.' })}
      </div>`, { narrow: true }),
    }),
    item({
      name: 'chip · emptyBox', node: '56:13318',
      desc: '칩은 남은 일수·상태를, emptyBox는 비어 있는 목록의 자리를 지킨다.',
      body: `${canvas(`<div class="row">${chip('6일 남음')}${chip('만료')}${chip('D-1')}</div>`)}
             ${canvas(emptyBox('아직 신청 내역이 없어요'), { narrow: true })}`,
    }),
  ]),

  group('오버레이', [
    item({
      name: 'bottomSheet', node: '41:2782',
      desc: 'grip · 헤더(제목 + 인포 + 설명) · 본문 · 버튼. 데스크톱에서는 가운데 모달이나 우측 패널로 바뀐다.',
      body: `<div class="stage">${bottomSheet({
    title: '이 수업을 취소할까요?',
    desc: '베이직 · 8월 22일 (토) · 10:30~11:50',
    body: infoList([['취소', '0/2회 남음'], ['보강', '2회 가능']]),
    footNotice: infoNotice({ tone: 'plain', text: '<b>8월 31일</b> 안에 다른 수업을 신청할 수 있어요.' }),
    actions: '<button class="btn btn--critical" data-action="noop">수업 취소</button>',
    animate: false,
  })}</div>`,
    }),
    item({
      name: 'popupPanel', node: '41:2899',
      desc: '화면을 덮는 패널. 헤더는 고정이고 내용이 그 아래로 들어가면 구분선이 켜진다.',
      body: `<div class="stage">${popupPanel({
    title: '레벨 안내',
    close: 'noop',
    body: `<div class="guides">
        <div class="guide"><div class="guide__top"><p class="guide__name">베이직</p><p class="guide__struct">매트 30분 · 바 40분 · 센터 10분</p></div>
          <p class="guide__target">발레를 처음 시작하는 분</p><p class="guide__detail">바른 자세와 발레의 기본 동작을 익힙니다.</p></div>
        <div class="guide"><div class="guide__top"><p class="guide__name">레벨1</p><p class="guide__struct">매트 15분 · 바 40분 · 센터 25분</p></div>
          <p class="guide__target">발레를 시작한 지 최소 6개월 이상인 분</p><p class="guide__detail">기본 동작에 몸방향, 팔 사용, 시선이 추가됩니다.</p></div>
      </div>`,
  })}</div>`,
    }),
  ]),
];

document.getElementById('gal').innerHTML = `
  <header class="gal__head">
    <h1 class="gal__title">발레75 디자인 시스템</h1>
    <p class="gal__lead">
      <code>src/components.js</code>를 그대로 import해 렌더합니다 —
      컴포넌트를 고치면 이 페이지도 함께 바뀝니다.
      칩에 적힌 번호는 대응하는 Figma 노드입니다.
    </p>
  </header>
  ${sections.join('')}`;

// 갤러리에서는 어떤 버튼도 실제로 동작하지 않는다
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action]')) e.preventDefault();
});
