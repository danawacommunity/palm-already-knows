'use strict';
/* ============================================================
 * 01. 설정 · 데이터
 * 운영하면서 바꿀 만한 값은 전부 이 파일에 모여 있습니다.
 * ============================================================ */

const CONFIG = {
  GAME_TITLE: '손금은 이미 알고 있다.',
  GATE_ENABLED: false,     // false: 횟수 제한 없이 누구나 무료. true 로 바꾸면 "친구가 접속해야 다시 하기" 규칙이 다시 켜진다
  FIRST_PLAY_FREE: true,   // 첫 1회는 무료
  DAILY_BONUS_LIMIT: 1,    // 공유로 얻은 "다시 하기"는 하루에 몇 번까지 쓸 수 있는지
  API_BASE: 'api',         // server.js 와 같은 주소에서 서비스할 때의 API 경로
  TZ_OFFSET_MIN: 540,      // 하루의 기준 시간대 (한국 = UTC+9)
  POLL_MS: 5000,           // 친구 접속 여부를 다시 확인하는 간격
};

/* 여섯 가지 성향. 각 성향이 손금의 어느 선에서 나오는지는 04-traits.js 참고 */
const TRAITS = [
  { id: 'vital',  name: '활력', line: 'life',  mean: '지치지 않는 체력과 에너지' },
  { id: 'advent', name: '모험', line: 'life',  mean: '새 길만 보면 못 참는 모험심' },
  { id: 'heart',  name: '감성', line: 'heart', mean: '정 많고 표현이 풍부한 낭만' },
  { id: 'logic',  name: '이성', line: 'head',  mean: '따질 건 따지는 합리성' },
  { id: 'dream',  name: '상상', line: 'head',  mean: '남다른 상상력과 감각' },
  { id: 'grit',   name: '뚝심', line: 'fate',  mean: '한번 정하면 끝까지 가는 뚝심' },
];
const TRAIT_INDEX = Object.fromEntries(TRAITS.map((t, i) => [t.id, i]));
/* 보통 손금에서 성향별로 나오는 평균 점수(모의 실험값). 자동차 외 추천을 고를 때는 이 평균보다
 * 얼마나 높고 낮은지를 본다. 그래야 특정 성향의 추천만 자주 나오지 않는다. */
const TRAIT_BASE = [65, 62, 66, 67, 64, 70];

const LINE_INFO = {
  life:  { name: '생명선', color: '#0E7C6B' },
  head:  { name: '두뇌선', color: '#2456C8' },
  heart: { name: '감정선', color: '#C3251C' },
  fate:  { name: '운명선', color: '#7A3EB8' },
  sun:     { name: '태양선', color: '#D97706' },
  mercury: { name: '수성선', color: '#0891B2' },
  mars:    { name: '이중 생명선', color: '#8B5E34' },
};

/* 구(丘): 손바닥의 도톰한 여섯 자리와 뜻 */
const MOUNT_INFO = {
  jupiter: { name: '목성구', where: '검지 아래', mean: '리더십과 자존심', traits: ['grit', 'vital'] },
  saturn:  { name: '토성구', where: '중지 아래', mean: '책임감과 신중함', traits: ['logic', 'grit'] },
  apollo:  { name: '태양구', where: '약지 아래', mean: '예술성과 인기', traits: ['heart', 'dream'] },
  mercury: { name: '수성구', where: '새끼손가락 아래', mean: '말솜씨와 수완', traits: ['logic', 'advent'] },
  venus:   { name: '금성구', where: '엄지 두덩', mean: '애정과 체력', traits: ['vital', 'heart'] },
  luna:    { name: '월구', where: '손날 아래쪽', mean: '상상력과 감수성', traits: ['dream', 'advent'] },
};

/* 자동차 목록.
 * profile = [활력, 모험, 감성, 이성, 상상, 뚝심] (0~100)
 * body    = 그림 종류 (05-draw.js 의 drawCar 참고). 그림은 차종을 나타내는 일반적인 만화체이며
 *           특정 모델의 디자인을 따라 그리지 않습니다.
 * fit     = 성향별로 "왜 이 차와 맞는지" 한 줄
 */
const CARS = [
  {
    id: 'sports', name: '포르쉐 911', kind: '스포츠카', body: 'sports', color: '#D7263D',
    profile: [95, 70, 60, 60, 40, 85],
    tagline: '매일이 서킷, 타협 없는 완벽주의자의 차',
    punch: '달리려고 태어난 손, 달리려고 태어난 차!',
    fit: {
      vital: '밟는 만큼 바로 응답하는 주행 성능',
      grit: '수십 년 한길만 판 스포츠카의 고집',
      advent: '굽은 길을 찾아다니는 주행 본능',
    },
  },
  {
    id: 'offroad', name: '지프 랭글러', kind: '오프로더', body: 'offroad', color: '#6B7F3A',
    profile: [88, 98, 50, 35, 60, 55],
    tagline: '길이 끝나는 곳에서 여행이 시작되는 사람의 차',
    punch: '길이 없으면? 만들면 되지!',
    fit: {
      advent: '포장도로가 끝나도 멈추지 않는 정통 오프로더',
      vital: '진흙도 바위도 거뜬한 체력',
      dream: '지붕과 문을 떼고 달리는 자유로움',
    },
  },
  {
    id: 'minivan', name: '기아 카니발', kind: '미니밴', body: 'minivan', color: '#2B3A67',
    profile: [60, 40, 95, 60, 35, 70],
    tagline: '내 사람은 내가 다 태운다, 정 많은 대장의 차',
    punch: '다 타! 한 명도 빠짐없이!',
    fit: {
      heart: '내 사람을 전부 태우는 넉넉한 3열',
      grit: '가족의 일상을 묵묵히 책임지는 든든함',
      logic: '사람과 짐을 다 따져본 실속',
    },
  },
  {
    id: 'luxury', name: '제네시스 G80', kind: '럭셔리 세단', body: 'luxury', color: '#2A2A31',
    profile: [50, 20, 50, 78, 35, 98],
    tagline: '묵묵히 쌓아 올린 사람이 누리는 조용한 품격',
    punch: '뚝심으로 올라온 자리, 승차감으로 보상받자.',
    fit: {
      grit: '한 단계씩 쌓아 올린 사람에게 어울리는 품격',
      logic: '과시보다 완성도를 고르는 안목',
      heart: '타는 사람을 배려하는 정숙한 승차감',
    },
  },
  {
    id: 'sedan', name: '현대 아반떼', kind: '준중형 세단', body: 'sedan', color: '#5B7C99',
    profile: [55, 35, 40, 95, 40, 62],
    tagline: '따질 거 다 따져본 사람의 가장 합리적인 정답',
    punch: '가격, 연비, 디자인… 계산 끝났다!',
    fit: {
      logic: '가격과 유지비를 따져보면 남는 합리적인 답',
      grit: '매일의 출퇴근을 꾸준히 책임지는 성실함',
      vital: '가볍고 경쾌한 몸놀림',
    },
  },
  {
    id: 'hatch', name: '미니 쿠퍼', kind: '소형 해치백', body: 'hatch', color: '#0F8B8D',
    profile: [65, 58, 82, 30, 92, 30],
    tagline: '남들과 같은 건 재미없는 개성파의 장난감',
    punch: '작다고? 존재감은 제일 크거든!',
    fit: {
      dream: '어디에 세워도 눈에 띄는 개성',
      heart: '운전 자체가 즐거워지는 감성',
      vital: '작은 몸집으로 골목을 누비는 민첩함',
    },
  },
  {
    id: 'ev', name: '현대 아이오닉 5', kind: '전기 크로스오버', body: 'ev', color: '#7FB7BE',
    profile: [50, 55, 30, 88, 90, 45],
    tagline: '미래를 먼저 살아보는 얼리어답터의 차',
    punch: '미래에서 왔습니다. 충전은 하고요.',
    fit: {
      dream: '미래에서 온 듯한 전기차 감각',
      logic: '충전과 유지비까지 계산하는 똑똑한 선택',
      advent: '전기를 꺼내 쓰며 어디서든 머무는 확장성',
    },
  },
  {
    id: 'kei', name: '기아 레이', kind: '박스형 경차', body: 'kei', color: '#8EC9E8',
    profile: [35, 28, 68, 72, 70, 50],
    tagline: '작은 공간도 알차게 쓰는 살림꾼의 만능 박스',
    punch: '작지만 다 들어가. 내 꿈도, 이삿짐도!',
    fit: {
      logic: '작은 차체에 공간을 꽉 채운 실속',
      dream: '시트를 접으면 뭐든 되는 변신 공간',
      heart: '동글동글 정이 가는 친근함',
    },
  },
  {
    id: 'suv', name: '현대 싼타페', kind: '중형 SUV', body: 'suv', color: '#2E6F57',
    profile: [75, 68, 62, 62, 48, 68],
    tagline: '뭐 하나 빠지는 게 없는 육각형 인간의 육각형 SUV',
    punch: '출근도 캠핑도 장보기도, 다 된다니까!',
    fit: {
      vital: '출퇴근부터 캠핑까지 다 해내는 체력',
      advent: '주말마다 떠나고 싶게 만드는 넉넉한 적재 공간',
      grit: '가족과 짐을 든든하게 받쳐주는 안정감',
      heart: '온 가족이 편안한 넓은 실내',
      logic: '쓰임새를 두루 따져본 균형',
      dream: '차박까지 되는 활용도',
    },
  },
  {
    id: 'muscle', name: '포드 머스탱', kind: '머슬카', body: 'muscle', color: '#1F5FBF',
    profile: [85, 72, 92, 25, 55, 45],
    tagline: '가슴이 시키는 대로 사는 낭만파의 심장',
    punch: '이성은 잠깐 꺼두셔도 좋습니다. 부르릉!',
    fit: {
      heart: '엔진 소리만으로 가슴이 뛰는 낭만',
      vital: '긴 보닛 아래 넘치는 힘',
      advent: '목적지 없이 달려도 좋은 드라이브 본능',
    },
  },
  {
    id: 'pickup', name: '기아 타스만', kind: '픽업트럭', body: 'pickup', color: '#B5651D',
    profile: [85, 65, 35, 55, 25, 95],
    tagline: '말보다 행동, 묵직하게 다 해내는 일꾼의 차',
    punch: '짐이든 꿈이든, 일단 실어!',
    fit: {
      grit: '무거운 짐도 군말 없이 싣는 묵직함',
      vital: '험한 길도 밀고 나가는 힘',
      advent: '일터와 캠핑장을 가리지 않는 활동 반경',
    },
  },
  {
    id: 'camper', name: '현대 스타리아', kind: '차박 밴', body: 'camper', color: '#F28F3B',
    profile: [58, 82, 72, 35, 88, 32],
    tagline: '세우는 곳이 곧 집, 자유로운 영혼의 움직이는 방',
    punch: '오늘 집은… 바다 앞으로 할게요.',
    fit: {
      dream: '세우는 곳이 곧 집이 되는 움직이는 방',
      advent: '발길 닿는 대로 떠나는 차박 여행',
      heart: '좋아하는 사람들과 둘러앉는 넓은 실내',
    },
  },
];

/* 다시 찍어야 할 때의 안내 문구 */
const RETAKE = {
  no_palm:    { title: '사진에서 손바닥을 찾지 못했어요', tip: '손바닥을 쫙 펴서 사진에 크게 나오게, 손과 다른 색의 배경 앞에서 다시 찍어주세요.' },
  too_dark:   { title: '어두워서 손바닥이 보이지 않아요', tip: '밝은 곳에서 다시 찍어주세요.' },
  too_bright: { title: '빛이 너무 강해요', tip: '빛 번짐이 없는 곳에서 플래시를 끄고 다시 찍어주세요.' },
  no_hand:    { title: '손바닥이 또렷하게 구분되지 않아요', tip: '손바닥을 쫙 펴서 크게, 손과 다른 색의 배경 앞에서 다시 찍어주세요.' },
  misaligned: { title: '손가락이 잘 보이지 않아요', tip: '손가락을 살짝 벌리고 손 전체가 나오게 찍어주세요.' },
  thumb:      { title: '엄지가 잘 보이지 않아요', tip: '엄지를 옆으로 벌리고 손 전체가 나오게 찍어주세요. 고른 손(왼손/오른손)과 찍은 손이 같은지도 확인해 주세요.' },
  background: { title: '손과 배경이 구분되지 않아요', tip: '손과 다른 색의 배경 앞에서 다시 찍어주세요.' },
  faint:      { title: '손금이 또렷하게 보이지 않아요', tip: '흔들리지 않게, 밝은 곳에서 손바닥을 쫙 펴고 다시 찍어주세요.' },
};
