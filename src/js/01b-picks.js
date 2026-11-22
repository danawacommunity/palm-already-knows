'use strict';
/* ============================================================
 * 01b. 자동차 말고 함께 추천하는 것들
 *
 * 항목마다 후보가 여러 개 있고, 후보마다 "어떤 성향과 맞는지"를 w 로 적어 둡니다.
 *   w: { vital 활력, advent 모험, heart 감성, logic 이성, dream 상상, grit 뚝심 } 중 관련 있는 것만.
 * 판독한 사람에게서 두드러지는 성향과 w 가 가장 잘 겹치는 후보가 뽑힙니다(04-traits.js 의 choose).
 * tier 가 있는 후보는 그 나잇대에서만 후보가 됩니다: young(10·20대) / mid(30·40대) / senior(50대 이상)
 *
 * 제품은 해마다 바뀌는 모델명 대신 "제조사 · 브랜드 · 제품군"으로 적었습니다.
 * 운영 전에 현재 판매 중인 제품군인지 한 번 확인해 주세요.
 * ============================================================ */

const PICKS = {
  /* ---------- 스타일 ---------- */
  watch: {
    label: '시계',
    options: [
      { tier: 'young', w: { vital: 1 }, name: '가민 · 포러너', why: '기록이 쌓일수록 신나는 러닝 워치' },
      { tier: 'young', w: { advent: 1 }, name: '카시오 · 지샥(G-SHOCK)', why: '어디에 부딪혀도 멀쩡한 터프함' },
      { tier: 'young', w: { heart: 1 }, name: '카시오 · 빈티지 시리즈', why: '레트로 감성 한 스푼' },
      { tier: 'young', w: { logic: 1 }, name: '샤오미 · 스마트 밴드', why: '필요한 기능만, 값은 가볍게' },
      { tier: 'young', w: { dream: 1 }, name: '스와치 · 문스와치', why: '남들과 다른 색을 고르는 재미' },
      { tier: 'young', w: { grit: 1 }, name: '세이코 · 세이코 5 스포츠', why: '첫 기계식 시계의 정석' },
      { tier: 'mid', w: { vital: 1 }, name: '애플 · 애플워치 울트라', why: '운동도 일도 한계까지' },
      { tier: 'mid', w: { advent: 1 }, name: '해밀턴 · 카키 필드', why: '야전에서 태어난 필드 워치' },
      { tier: 'mid', w: { heart: 1 }, name: '까르띠에 · 탱크', why: '시간이 지나도 우아한 사각 시계' },
      { tier: 'mid', w: { logic: 1 }, name: '티쏘 · PRX', why: '값·마감·디자인을 따지면 남는 답' },
      { tier: 'mid', w: { dream: 1 }, name: '노모스 · 탕겐테', why: '바우하우스 디자인의 정갈한 개성' },
      { tier: 'mid', w: { grit: 1 }, name: '튜더 · 블랙 베이', why: '묵직하게 오래 차는 다이버 워치' },
      { tier: 'senior', w: { vital: 1 }, name: '오메가 · 씨마스터', why: '여전히 현역인 활동파의 시계' },
      { tier: 'senior', w: { advent: 1 }, name: '롤렉스 · 익스플로러', why: '탐험가의 이름을 가진 시계' },
      { tier: 'senior', w: { heart: 1 }, name: '예거 르쿨트르 · 리베르소', why: '뒤집으면 이야기가 나오는 시계' },
      { tier: 'senior', w: { logic: 1 }, name: '그랜드 세이코 · 헤리티지 컬렉션', why: '이름값보다 완성도를 보는 안목' },
      { tier: 'senior', w: { dream: 1 }, name: '파네라이 · 루미노르', why: '멀리서도 알아보는 개성' },
      { tier: 'senior', w: { grit: 1 }, name: '롤렉스 · 서브마리너', why: '대를 물려도 되는 한 점' },
    ],
  },
  outfit: {
    label: '복장 스타일',
    options: [
      { w: { vital: 1 }, name: '애슬레저', why: '조거 팬츠와 러닝화, 바로 뛰어나갈 수 있는 차림' },
      { w: { advent: 1 }, name: '고프코어', why: '바람막이와 카고 팬츠, 산에서 막 내려온 듯한 차림' },
      { w: { heart: 1 }, name: '빈티지 캐주얼', why: '포근한 니트와 코듀로이, 오래 입어 정든 차림' },
      { w: { logic: 1 }, name: '미니멀', why: '무채색 셋업, 로고 없이 깔끔한 기본 아이템' },
      { w: { dream: 1 }, name: '스트릿 믹스매치', why: '오버핏에 색 하나 포인트, 남들과 다른 조합' },
      { w: { grit: 1 }, name: '아메카지', why: '워크 재킷과 생지 데님, 길들여 입는 옷' },
    ],
  },
  brand: {
    label: '어울리는 브랜드',
    options: [
      { w: { vital: 1 }, name: '나이키', why: '일단 움직이고 보는 사람의 브랜드' },
      { w: { advent: 0.9, grit: 0.4 }, name: '파타고니아', why: '오래 입고 멀리 가는 사람의 브랜드' },
      { w: { logic: 1 }, name: '무인양품', why: '꾸밈보다 쓰임을 고르는 사람의 브랜드' },
      { w: { dream: 1 }, name: '레고', why: '머릿속 그림을 손으로 만드는 사람의 브랜드' },
      { w: { heart: 1 }, name: '디즈니', why: '이야기에 약한 낭만파의 브랜드' },
      { w: { grit: 1 }, name: '리바이스', why: '유행과 상관없이 한 벌을 오래 입는 사람의 브랜드' },
      { w: { vital: 0.7, heart: 0.5 }, name: '룰루레몬', why: '몸과 마음을 같이 챙기는 사람의 브랜드' },
      { w: { dream: 0.6, logic: 0.6 }, name: '이케아', why: '직접 조립하며 공간을 바꾸는 사람의 브랜드' },
      { w: { advent: 0.6, grit: 0.6 }, name: '스탠리', why: '튼튼한 도구 하나로 어디든 가는 사람의 브랜드' },
      { w: { dream: 0.8, heart: 0.4 }, name: '젠틀몬스터', why: '평범한 건 심심한 사람의 브랜드' },
    ],
  },

  /* ---------- 먹고 사기 ---------- */
  food: {
    label: '음식',
    options: [
      { w: { vital: 1 }, name: '삼겹살·소고기 구이', why: '잘 먹어야 잘 달리는 에너지파' },
      { w: { advent: 1 }, name: '마라탕·쌀국수·타코', why: '안 먹어본 맛부터 고르는 탐험가' },
      { w: { heart: 1 }, name: '소금빵·케이크와 커피', why: '맛만큼 분위기도 중요한 낭만파' },
      { w: { logic: 1 }, name: '한식 정식·샐러드 볼', why: '영양과 값을 같이 따지는 합리파' },
      { w: { dream: 1 }, name: '오마카세·퓨전 요리', why: '다음 접시가 궁금한 호기심파' },
      { w: { grit: 1 }, name: '국밥·김치찌개', why: '단골집 한 곳만 파는 뚝심파' },
      { w: { advent: 0.7, vital: 0.7 }, name: '캠핑 바비큐', why: '밖에서 먹어야 제맛인 활동파' },
      { w: { logic: 0.6, grit: 0.6 }, name: '평양냉면', why: '슴슴한 맛의 깊이를 아는 미식가' },
      { w: { heart: 0.6, vital: 0.5 }, name: '떡볶이·치킨', why: '좋아하는 사람과 나눠 먹어야 맛있는 타입' },
    ],
  },
  /* 장보는 곳. type: mart(오프라인 마트) / online(온라인 쇼핑몰) / market(재래시장) / daiso(다이소) / bulk(식자재마트) */
  shop: {
    label: '장보는 곳',
    types: { mart: '오프라인 마트', online: '온라인 쇼핑몰', market: '재래시장', daiso: '다이소', bulk: '식자재마트' },
    options: [
      { type: 'mart', w: { heart: 0.7, vital: 0.4, grit: 0.3 }, name: '오프라인 마트 · 이마트', why: '카트 끌고 한 바퀴 돌아야 장 본 것 같은 타입' },
      { type: 'mart', w: { vital: 0.8, grit: 0.5 }, name: '오프라인 마트 · 코스트코', why: '크게 사서 든든하게 쟁여 두는 타입' },
      { type: 'online', w: { logic: 0.7, vital: 0.5 }, name: '온라인 쇼핑몰 · 쿠팡', why: '필요하면 바로, 내일 아침에 받아야 하는 타입' },
      { type: 'online', w: { logic: 1, grit: 0.3 }, name: '온라인 쇼핑몰 · 다나와 가격비교 후 최저가 몰', why: '같은 물건이면 한 푼이라도 따져 보는 타입' },
      { type: 'online', w: { heart: 0.7, dream: 0.5 }, name: '온라인 쇼핑몰 · 컬리', why: '장바구니에도 취향을 담는 타입' },
      { type: 'online', w: { dream: 0.9, heart: 0.3 }, name: '온라인 쇼핑몰 · 무신사·29CM', why: '남들이 모르는 브랜드를 먼저 찾는 타입' },
      { type: 'online', w: { advent: 0.8, dream: 0.4, logic: 0.2 }, name: '온라인 쇼핑몰 · 알리익스프레스', why: '바다 건너 신기한 물건을 캐는 타입' },
      { type: 'market', w: { heart: 0.8, advent: 0.5, grit: 0.3 }, name: '재래시장 · 동네 전통시장', why: '덤과 흥정, 사람 구경이 즐거운 타입' },
      { type: 'daiso', w: { dream: 0.7, logic: 0.5, advent: 0.2 }, name: '다이소', why: '천 원짜리에서 쓸모를 발견하는 타입' },
      { type: 'bulk', w: { grit: 0.8, logic: 0.5, vital: 0.3 }, name: '식자재마트', why: '재료부터 큼직하게 사서 직접 해 먹는 타입' },
    ],
  },

  /* ---------- 전자기기 · 컴퓨터 ---------- */
  egear: {
    label: '전자기기 브랜드',
    options: [
      { w: { heart: 1 }, name: '애플', why: '스펙표보다 손에 쥔 느낌을 믿는 타입' },
      { w: { logic: 1 }, name: '삼성전자', why: '성능·호환·AS까지 따져 보면 남는 답' },
      { w: { grit: 1 }, name: 'LG전자', why: '한번 들이면 오래 쓰는 타입' },
      { w: { vital: 1 }, name: '소니', why: '게임·카메라·헤드폰까지 놀 줄 아는 타입' },
      { w: { advent: 1 }, name: 'DJI', why: '밖으로 나가야 제 실력이 나오는 타입' },
      { w: { dream: 1 }, name: '낫싱(Nothing)', why: '속이 비치는 디자인처럼 남다른 타입' },
      { w: { logic: 0.7, advent: 0.5 }, name: '샤오미', why: '없는 게 없고 값은 가벼운 걸 찾는 타입' },
    ],
  },
  cpu: {
    label: 'CPU',
    options: [
      { w: { vital: 1 }, name: 'AMD · 라이젠 · 라이젠 7 X3D 시리즈', why: '게임 프레임을 끝까지 뽑아내는 3D 캐시' },
      { w: { logic: 1 }, name: 'AMD · 라이젠 · 라이젠 5 시리즈', why: '값 대비 성능을 계산하면 남는 답' },
      { w: { dream: 1 }, name: 'AMD · 라이젠 · 라이젠 9 시리즈', why: '편집과 렌더링을 한꺼번에 돌리는 다코어' },
      { w: { grit: 1 }, name: '인텔 · 코어 울트라 · 코어 울트라 7 시리즈', why: '묵묵히 오래 돌아가는 든든한 주력' },
      { w: { heart: 1 }, name: '인텔 · 코어 울트라 · 코어 울트라 5 시리즈', why: '조용하고 무난한, 일상에 맞는 균형' },
      { w: { advent: 1 }, name: 'AMD · 라이젠 · 내장 그래픽 G 시리즈', why: '그래픽카드 없이 작게 짜서 들고 다니는' },
    ],
  },
  mb: {
    label: '메인보드',
    options: [
      { w: { vital: 1 }, name: 'ASUS · ROG · STRIX 시리즈', why: '전원부와 쿨링에 아낌없이 투자한 게이밍 보드' },
      { w: { advent: 1 }, name: '기가바이트 · AORUS · 미니 ITX 보드', why: '손바닥만 한 크기에 다 넣은 보드' },
      { w: { heart: 1 }, name: '애즈락 · 스틸레전드 · 화이트 보드', why: '하얀 본체를 완성하는 은빛 무늬' },
      { w: { logic: 1 }, name: 'MSI · MAG · 토마호크 시리즈', why: '값과 구성을 따지면 늘 후보에 오르는' },
      { w: { dream: 1 }, name: 'ASUS · ProArt · 크리에이터 보드', why: '작업용 단자를 넉넉히 갖춘 창작자용' },
      { w: { grit: 1 }, name: 'ASUS · TUF Gaming · 내구성 보드', why: '오래 버티는 부품만 골라 쓴' },
    ],
  },
  mouse: {
    label: '마우스',
    options: [
      { w: { vital: 1 }, name: '로지텍 · G · PRO X 슈퍼라이트', why: '가벼워서 손이 먼저 나가는 게이밍 마우스' },
      { w: { advent: 1 }, name: '로지텍 · MX · MX Anywhere 시리즈', why: '카페 유리 테이블에서도 되는 휴대용' },
      { w: { heart: 1 }, name: '로지텍 · 페블 · 페블 마우스', why: '조약돌처럼 동글고 조용한' },
      { w: { logic: 1 }, name: '로지텍 · G · G304', why: '무선 게이밍을 합리적인 값에' },
      { w: { dream: 1 }, name: '켄싱턴 · 엑스퍼트 · 트랙볼 마우스', why: '손목 대신 공을 굴리는 남다른 선택' },
      { w: { grit: 1 }, name: '벤큐 · 조위(ZOWIE) · EC 시리즈', why: '유행을 안 타는 기본기' },
    ],
  },
  keyboard: {
    label: '키보드',
    options: [
      { w: { vital: 1 }, name: '스틸시리즈 · 에이펙스 · 에이펙스 프로', why: '누르는 깊이까지 조절하는 반응 속도' },
      { w: { advent: 1 }, name: 'PFU · 해피해킹(HHKB) · 프로페셔널', why: '가방에 쏙 들어가는 작은 배열' },
      { w: { heart: 1 }, name: '로지텍 · 팝(POP) · 팝 키', why: '타자기 같은 동그란 키와 색감' },
      { w: { logic: 1 }, name: '한성컴퓨터 · GK 시리즈 · 무접점 키보드', why: '무접점을 합리적인 값에' },
      { w: { dream: 1 }, name: '키크론 · Q 시리즈 · 커스텀 키보드', why: '스위치와 키캡을 취향대로 바꾸는' },
      { w: { grit: 1 }, name: '레오폴드 · FC 시리즈 · FC900R', why: '십 년을 써도 그대로인 기본기' },
    ],
  },
  pccase: {
    label: '컴퓨터 케이스',
    options: [
      { w: { vital: 1 }, name: '리안리 · O11 · O11 다이나믹', why: '팬을 가득 달아도 넉넉한 어항 케이스' },
      { w: { advent: 1 }, name: '쿨러마스터 · 마스터박스 · NR200P', why: '한 손에 들리는 미니 ITX' },
      { w: { heart: 1 }, name: '프랙탈 디자인 · North · 노스', why: '원목 패널로 거실에도 어울리는' },
      { w: { logic: 1 }, name: '다크플래쉬 · DLX 시리즈 · 메쉬 케이스', why: '팬까지 넣어 주는 실속 구성' },
      { w: { dream: 1 }, name: '하이트(HYTE) · Y 시리즈 · Y70', why: '파노라마 유리로 속을 전시하는' },
      { w: { grit: 1 }, name: '프랙탈 디자인 · Define · 디파인 7', why: '조용하고 묵직한 정통 타워' },
    ],
  },
  laptop: {
    label: '노트북',
    options: [
      { w: { vital: 1 }, name: '레노버 · 리전 · 리전 프로', why: '데스크톱 못지않게 달리는 게이밍 노트북' },
      { w: { advent: 1 }, name: 'LG전자 · 그램 · 그램 16', why: '가방에 넣은 걸 잊을 만큼 가벼운' },
      { w: { heart: 1 }, name: '애플 · 맥북 · 맥북 에어', why: '열 때마다 기분이 좋아지는 한 대' },
      { w: { logic: 1 }, name: '레노버 · 아이디어패드 · 슬림 5', why: '값과 성능의 균형을 따지면 나오는' },
      { w: { dream: 1 }, name: '애플 · 맥북 · 맥북 프로', why: '영상도 음악도 한 대로 만드는 작업실' },
      { w: { grit: 1 }, name: '레노버 · 씽크패드 · T 시리즈', why: '빨간 점 하나로 수십 년을 버틴 업무용' },
      { w: { logic: 0.5, heart: 0.4, vital: 0.3 }, name: '삼성전자 · 갤럭시 북 · 갤럭시 북 프로', why: '휴대폰과 이어 쓰기 편한 만능형' },
    ],
  },
  monitor: {
    label: '모니터',
    options: [
      { w: { vital: 1 }, name: 'LG전자 · 울트라기어 · OLED 게이밍 모니터', why: '빠른 화면에서 잔상 없이 반응하는' },
      { w: { advent: 1 }, name: 'LG전자 · 그램 · 그램 +view', why: '노트북 옆에 펼치는 휴대용 모니터' },
      { w: { heart: 1 }, name: '삼성전자 · 스마트 모니터 · M8', why: '본체 없이도 영화 한 편, 하얗고 얇은' },
      { w: { logic: 1 }, name: 'MSI · MAG · QHD 게이밍 모니터', why: '해상도·주사율·값을 고르게 맞춘' },
      { w: { dream: 1 }, name: '벤큐 · PD 시리즈 · 디자이너 모니터', why: '색을 정확히 봐야 하는 작업용' },
      { w: { grit: 1 }, name: '델 · 울트라샤프 · U 시리즈', why: '사무실에서 오래 검증된 표준' },
      { w: { vital: 0.5, logic: 0.5 }, name: '삼성전자 · 오디세이 · 오디세이 G5', why: '게임과 작업을 한 대로 해결하는' },
    ],
  },

  /* ---------- 대형가전 ---------- */
  tv: {
    label: 'TV',
    options: [
      { w: { vital: 1 }, name: 'LG전자 · 올레드 evo · 대화면 올레드 TV', why: '스포츠와 게임의 빠른 화면에 강한' },
      { w: { heart: 1 }, name: '삼성전자 · 더 프레임 · 액자형 TV', why: '꺼져 있을 때도 그림이 되는' },
      { w: { logic: 1 }, name: 'LG전자 · QNED · 실속형 대화면 TV', why: '크기와 화질, 값을 고르게 맞춘' },
      { w: { dream: 1 }, name: 'LG전자 · 스탠바이미 · 이동식 스크린', why: '집 안 어디든 끌고 다니는 화면' },
      { w: { grit: 1 }, name: '삼성전자 · Neo QLED · 대화면 TV', why: '거실 한가운데를 오래 지킬 한 대' },
      { w: { advent: 1 }, name: '삼성전자 · 더 프리스타일 · 휴대용 프로젝터', why: '캠핑장 천막도 영화관으로 만드는' },
    ],
  },
  fridge: {
    label: '냉장고',
    options: [
      { w: { heart: 1 }, name: '삼성전자 · 비스포크 · 컬러 패널 4도어', why: '주방 분위기에 맞춰 색을 고르는' },
      { w: { grit: 1 }, name: 'LG전자 · 디오스 오브제컬렉션 · 4도어', why: '한번 들이면 오래 쓰는 정석' },
      { w: { logic: 1 }, name: 'LG전자 · 디오스 · 실속형 양문형', why: '용량과 전기료를 따져 고른' },
      { w: { dream: 1 }, name: '삼성전자 · 비스포크 AI 패밀리허브 · 화면 달린 4도어', why: '냉장고 문에서 레시피를 찾는' },
      { w: { vital: 1 }, name: 'LG전자 · 디오스 오브제컬렉션 · 얼음정수기 냉장고', why: '운동 뒤에 얼음물이 바로 나오는' },
      { w: { advent: 1 }, name: 'LG전자 · 디오스 오브제컬렉션 · 컨버터블 패키지', why: '사는 방식이 바뀌면 조합도 바꾸는' },
    ],
  },
  /* whyBy: 어느 성향 때문에 뽑혔는지에 따라 이유 문구를 달리 보여 준다 */
  kimchi: {
    label: '김치냉장고',
    options: [
      { w: { grit: 1, heart: 0.8 }, name: '위니아 · 딤채 · 뚜껑형', whyBy: { grit: '땅속 김칫독 방식을 고집해 온 원조', heart: '어머니 손맛처럼 익혀 주는 원조' } },
      { w: { logic: 1, dream: 0.8 }, name: '삼성전자 · 비스포크 김치플러스 · 스탠드형', whyBy: { logic: '김치 말고도 칸칸이 나눠 쓰는 실속', dream: '와인도 과일도 넣어 보는 변신 칸' } },
      { w: { vital: 1, advent: 0.8 }, name: 'LG전자 · 디오스 김치톡톡 · 스탠드형', whyBy: { vital: '김장 한 번에 넉넉히 들어가는 대용량', advent: '새로 담근 김치도 금세 익혀 맛보는' } },
    ],
  },
  washer: {
    label: '세탁기·건조기',
    options: [
      { w: { logic: 1, dream: 0.7 }, name: '삼성전자 · 비스포크 AI 콤보 · 세탁건조 일체형', whyBy: { logic: '옮겨 담는 수고까지 계산에서 뺀', dream: '한 대가 세탁부터 건조까지 하는 새 방식' } },
      { w: { grit: 1 }, name: 'LG전자 · 트롬 오브제컬렉션 · 워시타워', why: '세탁기 위에 건조기, 정석 그대로' },
      { w: { advent: 1, heart: 0.6 }, name: 'LG전자 · 트롬 오브제컬렉션 · 워시콤보', whyBy: { advent: '한 대로 끝내고 남는 자리를 쓰는', heart: '빨래 걱정 없이 저녁을 보내는' } },
      { w: { vital: 1 }, name: '삼성전자 · 비스포크 그랑데 AI · 대용량 세탁기와 건조기', why: '운동복도 이불도 한 번에 돌리는' },
    ],
  },
  aircon: {
    label: '에어컨',
    options: [
      { w: { heart: 1, dream: 0.7 }, name: '삼성전자 · 비스포크 무풍 갤러리 · 스탠드형', whyBy: { heart: '찬 바람이 직접 닿지 않아 포근한', dream: '거실에 그림처럼 놓이는' } },
      { w: { grit: 1, vital: 0.7 }, name: 'LG전자 · 휘센 오브제컬렉션 타워 · 스탠드형', whyBy: { grit: '여름마다 믿고 켜는', vital: '넓은 거실도 금세 식히는' } },
      { w: { logic: 1 }, name: 'LG전자 · 휘센 · 벽걸이형 인버터', why: '방 크기와 전기료에 딱 맞춘' },
      { w: { advent: 1 }, name: '파세코 · 창문형 에어컨 · 프리미엄', why: '기사님 없이 내 손으로 다는' },
    ],
  },
  styler: {
    label: '의류관리기',
    options: [
      { w: { grit: 1, logic: 0.8 }, name: 'LG전자 · 스타일러 오브제컬렉션 · 5벌형', whyBy: { grit: '의류관리기를 처음 만든 원조', logic: '세탁소 가는 횟수를 줄여 주는' } },
      { w: { heart: 1, dream: 0.8 }, name: '삼성전자 · 비스포크 에어드레서 · 대용량', whyBy: { heart: '아끼는 옷을 곱게 돌보는', dream: '옷장처럼 색을 맞춰 들이는' } },
      { w: { vital: 1, advent: 0.8 }, name: 'LG전자 · 스타일러 · 슈케어(신발관리기)', whyBy: { vital: '운동화가 옷보다 많은 사람의', advent: '비 맞은 등산화도 다음 날 다시 신는' } },
    ],
  },
  dish: {
    label: '식기세척기',
    options: [
      { w: { logic: 1, vital: 0.8 }, name: 'LG전자 · 디오스 오브제컬렉션 · 식기세척기', whyBy: { logic: '설거지 시간을 계산해서 돌려받는', vital: '설거지할 시간에 운동하러 가는' } },
      { w: { heart: 1, dream: 0.8 }, name: '삼성전자 · 비스포크 · 식기세척기', whyBy: { heart: '식사 뒤의 대화를 지켜 주는', dream: '주방 색에 맞춰 들이는' } },
      { w: { grit: 1, advent: 0.8 }, name: '밀레 · G 시리즈 · 식기세척기', whyBy: { grit: '한번 사서 오래 쓰는 독일산', advent: '바다 건너온 원조를 써 보는' } },
    ],
  },

  /* ---------- 어울리는 사는 곳 ---------- */
  region: {
    label: '사는 곳',
    options: [
      { area: '한국', w: { vital: 0.6, dream: 0.7 }, name: '서울특별시 성동구(성수동)', why: '새 가게가 매주 생기는 동네' },
      { area: '한국', w: { logic: 1 }, name: '경기도 성남시(판교)', why: '일과 생활의 효율을 따지면 나오는 답' },
      { area: '한국', w: { logic: 0.6, grit: 0.7 }, name: '세종특별자치시', why: '반듯하게 계획된 도시의 안정감' },
      { area: '한국', w: { vital: 0.8, heart: 0.5 }, name: '부산광역시 해운대구', why: '바다와 도심을 하루에 다 누리는' },
      { area: '한국', w: { heart: 0.8, advent: 0.4 }, name: '강원특별자치도 강릉시', why: '바다 보며 커피 한 잔이 일상인' },
      { area: '한국', w: { advent: 0.8, vital: 0.6 }, name: '강원특별자치도 양양군', why: '출근 전에 파도부터 타는' },
      { area: '한국', w: { advent: 0.6, dream: 0.7 }, name: '제주특별자치도 서귀포시', why: '섬의 속도로 사는 자유' },
      { area: '한국', w: { heart: 0.6, grit: 0.6 }, name: '전북특별자치도 전주시', why: '한옥 골목과 밥상이 든든한' },
      { area: '한국', w: { grit: 0.9, heart: 0.3 }, name: '경상북도 경주시', why: '천 년을 버틴 도시의 느긋함' },
      { area: '한국', w: { logic: 0.7, dream: 0.4 }, name: '대전광역시 유성구', why: '연구소와 빵집이 함께 있는 과학도시' },
      { area: '한국', w: { dream: 0.7, logic: 0.5 }, name: '인천광역시 연수구(송도)', why: '미래 도시처럼 정돈된 국제도시' },
      { area: '한국', w: { heart: 1 }, name: '전라남도 여수시', why: '밤바다가 매일의 풍경인' },
      { area: '한국', w: { grit: 0.8, vital: 0.5 }, name: '울산광역시', why: '일할 땐 일하고 쉴 땐 바다로 가는' },
      { area: '한국', w: { heart: 0.5, dream: 0.7 }, name: '광주광역시 동구', why: '예술과 미식이 골목마다 있는' },
      { area: '한국', w: { dream: 0.6, heart: 0.6, advent: 0.2 }, name: '경상남도 통영시', why: '항구와 예술가의 도시' },
      { area: '한국', w: { vital: 0.7, grit: 0.5 }, name: '대구광역시 수성구', why: '뜨거운 만큼 화끈한 도시' },
      { area: '한국', w: { advent: 0.7, grit: 0.3, vital: 0.3 }, name: '충청북도 단양군', why: '하늘과 강을 놀이터로 삼는' },
      { area: '한국', w: { heart: 0.6, advent: 0.5 }, name: '충청남도 태안군', why: '노을과 갯벌이 가까운' },
      { area: '해외', w: { grit: 0.7, heart: 0.6 }, name: '일본 교토', why: '전통을 고집스럽게 지키는 골목' },
      { area: '해외', w: { dream: 0.8, logic: 0.5 }, name: '일본 도쿄', why: '취향마다 가게가 하나씩 있는' },
      { area: '해외', w: { vital: 0.8, dream: 0.6 }, name: '미국 뉴욕', why: '잠들지 않는 도시의 속도' },
      { area: '해외', w: { heart: 0.9, dream: 0.4 }, name: '프랑스 파리', why: '산책이 곧 전시 관람인' },
      { area: '해외', w: { logic: 0.7, heart: 0.5 }, name: '덴마크 코펜하겐', why: '일과 삶의 균형을 설계한 도시' },
      { area: '해외', w: { advent: 1, vital: 0.4 }, name: '뉴질랜드 퀸스타운', why: '번지점프가 사업이 된 모험의 도시' },
      { area: '해외', w: { advent: 0.7, dream: 0.6 }, name: '태국 치앙마이', why: '노트북 하나로 한 달 살아 보는' },
      { area: '해외', w: { logic: 0.8, grit: 0.6 }, name: '스위스 취리히', why: '시계처럼 정확하게 굴러가는' },
      { area: '해외', w: { heart: 0.6, advent: 0.6 }, name: '포르투갈 리스본', why: '언덕과 노을, 느린 트램' },
      { area: '해외', w: { dream: 1 }, name: '독일 베를린', why: '뭘 해도 이상하지 않은 실험의 도시' },
      { area: '해외', w: { vital: 0.6, advent: 0.5, heart: 0.3 }, name: '호주 시드니', why: '아침 수영으로 하루를 여는' },
      { area: '해외', w: { grit: 0.6, vital: 0.4, logic: 0.4 }, name: '싱가포르', why: '규칙과 효율로 빛나는 도시국가' },
      { area: '북한', w: { grit: 0.8, advent: 0.7 }, name: '개성시', why: '아직은 갈 수 없지만, 길이 열리면 가장 먼저 달려갈 고려의 옛 수도' },
      { area: '북한', w: { advent: 0.7, heart: 0.6, grit: 0.3 }, name: '원산시', why: '아직은 갈 수 없지만, 언젠가 걸어 보고 싶은 동해의 항구' },
    ],
  },
};

/* 어느 성향으로 고를지: 1 = 가장 두드러진 성향(기본), 2 = 두 번째, 3 = 세 번째.
 * 모든 항목을 한 가지 성향으로만 고르면 추천이 전부 비슷해지므로, 항목마다 보는 성향을 나눴습니다. */
const PICK_LENS = {
  watch: 2, brand: 2, food: 2, mb: 2, monitor: 2, fridge: 2, aircon: 2,
  mouse: 3, keyboard: 3, pccase: 3, kimchi: 3, styler: 3, dish: 3,
};

/* 결과 화면의 묶음(탭) */
const PICK_GROUPS = [
  { id: 'style', tab: '스타일', cats: ['watch', 'outfit', 'pcolor', 'brand'] },
  { id: 'life', tab: '먹고 사기', cats: ['food', 'shop'] },
  { id: 'tech', tab: '전자·PC', cats: ['egear', 'cpu', 'mb', 'mouse', 'keyboard', 'pccase', 'laptop', 'monitor'] },
  { id: 'home', tab: '대형가전', cats: ['tv', 'fridge', 'kimchi', 'washer', 'aircon', 'styler', 'dish'] },
  { id: 'people', tab: '사람', cats: ['ptype', 'pmbti', 'plook'] },
  { id: 'place', tab: '사는 곳', cats: ['region'] },
];

/* 퍼스널컬러: 손바닥 피부 톤(밝기, 노란 기)으로 네 계절 중 하나 */
const PERSONAL_COLORS = {
  spring: { name: '봄 웜톤', desc: '밝고 노란 기가 도는 톤', swatches: [['#FF8C69', '코랄'], ['#FFD3A5', '피치'], ['#FFF4D6', '아이보리'], ['#C9A25F', '라이트 카멜'], ['#A8C66C', '옐로 그린']] },
  summer: { name: '여름 쿨톤', desc: '밝고 붉은 기가 도는 톤', swatches: [['#B9A7E0', '라벤더'], ['#9CCBEE', '스카이블루'], ['#F2A7B8', '로즈 핑크'], ['#C9CDD3', '라이트 그레이'], ['#A6DCCB', '민트']] },
  autumn: { name: '가을 웜톤', desc: '깊고 노란 기가 도는 톤', swatches: [['#D2A12C', '머스터드'], ['#B5553A', '테라코타'], ['#6E6B3A', '카키'], ['#6B4226', '브라운'], ['#8E2F1E', '브릭 레드']] },
  winter: { name: '겨울 쿨톤', desc: '깊고 붉은 기가 도는 톤', swatches: [['#111111', '블랙'], ['#FFFFFF', '화이트'], ['#1F3FAE', '로열 블루'], ['#7B1E3A', '와인'], ['#0E7C5B', '에메랄드']] },
};

/* 어울리는 사람: 내게 가장 낮은 성향을 채워 주는 타입 */
const PARTNER = {
  type: {
    vital: { name: '먼저 손 내밀어 끌어 주는 에너자이저', why: '조용한 당신의 하루에 시동을 걸어 줄 사람' },
    advent: { name: '새로운 곳으로 데려가 주는 탐험가', why: '익숙한 길만 가는 당신의 지도를 넓혀 줄 사람' },
    heart: { name: '마음을 말로 잘 꺼내는 다정한 표현가', why: '속마음을 아끼는 당신 대신 먼저 말해 줄 사람' },
    logic: { name: '계획과 계산을 맡아 주는 든든한 현실주의자', why: '마음 가는 대로 가는 당신의 브레이크가 되어 줄 사람' },
    dream: { name: '엉뚱한 이야기로 웃게 해 주는 아이디어 뱅크', why: '현실적인 당신의 하루에 재미를 더해 줄 사람' },
    grit: { name: '한결같이 자리를 지키는 뚝심 있는 사람', why: '궁금한 게 많은 당신이 돌아올 자리가 되어 줄 사람' },
  },
  /* 인상(동물상). m = 상대가 남성일 때, f = 여성일 때, n = 성별을 모를 때·10대 */
  look: {
    vital: { name: '강아지상', n: '잘 웃고 눈꼬리가 순해 보기만 해도 기운 나는 인상', m: '웃으면 눈이 반달이 되는 훈훈한 인상', f: '웃음이 많고 눈꼬리가 순한 사랑스러운 인상' },
    advent: { name: '여우상', n: '눈매가 또렷하고 표정이 다채로운 인상', m: '눈매가 길고 또렷한 날렵한 인상', f: '눈매가 또렷하고 표정이 풍부한 매력적인 인상' },
    heart: { name: '사슴상', n: '눈이 맑고 선이 고운 인상', m: '눈이 맑고 선이 고운 부드러운 인상', f: '눈이 크고 맑은 청순한 인상' },
    logic: { name: '고양이상', n: '차분하고 단정한 이목구비', m: '차분하고 단정한 이목구비의 지적인 인상', f: '눈매가 살짝 올라간 도회적인 인상' },
    dream: { name: '토끼상', n: '동글동글하고 장난기 어린 인상', m: '동글동글하고 장난기 어린 소년 같은 인상', f: '동글동글하고 장난기 어린 발랄한 인상' },
    grit: { name: '곰상', n: '푸근하고 듬직한 인상', m: '어깨가 넓고 푸근한 듬직한 인상', f: '푸근하고 편안한 미소의 인상' },
  },
  /* 널리 알려진 MBTI 궁합표를 따름 */
  mbti: {
    INFP: ['ENFJ', 'ENTJ'], ENFP: ['INFJ', 'INTJ'], INFJ: ['ENFP', 'ENTP'], ENFJ: ['INFP', 'ISFP'],
    INTJ: ['ENFP', 'ENTP'], ENTJ: ['INFP', 'INTP'], INTP: ['ENTJ', 'ESTJ'], ENTP: ['INFJ', 'INTJ'],
    ISFP: ['ENFJ', 'ESFJ'], ESFP: ['ISFJ', 'ISTJ'], ISTP: ['ESFJ', 'ESTJ'], ESTP: ['ISFJ', 'ISTJ'],
    ISFJ: ['ESFP', 'ESTP'], ESFJ: ['ISFP', 'ISTP'], ISTJ: ['ESFP', 'ESTP'], ESTJ: ['INTP', 'ISTP'],
  },
};

const PROFILE_LABEL = {
  hand: { left: '왼손', right: '오른손' },
  gender: { m: '남자', f: '여자', u: '성별 모름' },
  age: { 10: '10대', 20: '20대', 30: '30대', 40: '40대', 50: '50대', 60: '60대 이상' },
};
