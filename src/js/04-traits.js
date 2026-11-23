'use strict';
/* ============================================================
 * 04. 수상학 해석: 손금 측정값 → 여섯 성향 → 어울리는 자동차 → 이유
 *
 * 해석의 뼈대 (전통 수상학의 통설을 따름)
 *   생명선  길고 진함 → 체력·회복력(활력) / 크게 휘어 금성구가 넓음 → 활동 반경·모험심
 *   감정선  손가락 쪽으로 휘어 오르고 진함 → 풍부한 감정 표현(감성)
 *   두뇌선  길고 곧음 → 현실 감각·분석력(이성) / 월구 쪽으로 흘러내림 → 상상력(상상)
 *           생명선과 떨어져 출발 → 독립심·대담함(모험에 가산)
 *   운명선  또렷하게 오름 → 목표 의식·꾸준함(뚝심)
 * ============================================================ */

const Fortune = (function () {
  const c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const norm = (v, lo, hi) => c01((v - lo) / (hi - lo));
  const pct = (v) => Math.round(v * 100);

  /* 측정값을 0~1로 환산. 각 구간의 가운데가 "보통 손금"이 되도록 잡았다.
   * 선의 깊이는 조명에 따라 달라지므로, 절대값이 아니라 "세 주요선 평균 대비 얼마나 진한가"를 쓴다. */
  function features(lines) {
    const L = lines.life, H = lines.heart, D = lines.head, F = lines.fate;
    const majors = [L, H, D].filter((l) => l.found);
    const md = majors.reduce((s, l) => s + l.depth, 0) / Math.max(1, majors.length) || 0.08;
    const rel = (l, lo, hi) => norm(l.depth / md, lo, hi);
    const f = {};
    f.lifeLen = L.found ? norm(L.len, 0.62, 1.0) : 0.15;
    f.lifeDepth = L.found ? rel(L, 0.65, 1.35) : 0.1;
    f.lifeReach = L.found ? norm(L.reach, 0.36, 0.54) : 0.3;
    f.heartLen = H.found ? norm(H.len, 0.42, 0.80) : 0.2;
    f.heartRise = H.found ? norm(H.rise, 0.02, 0.22) : 0.3;
    f.heartDepth = H.found ? rel(H, 0.65, 1.35) : 0.1;
    f.headLen = D.found ? norm(D.len, 0.42, 0.88) : 0.2;
    f.headSlope = D.found ? norm(D.slopeDeg, 6, 30) : 0.4;
    f.headDepth = D.found ? rel(D, 0.65, 1.35) : 0.1;
    f.headGap = D.found && D.gap != null ? norm(D.gap, 0.02, 0.10) : 0.3;
    f.fate = F.found
      ? 0.45 + 0.30 * norm(F.len, 0.3, 0.85) + 0.25 * norm(F.depth / md, 0.4, 1.1)
      : 0.10 + 0.25 * norm(F.len, 0, 0.3);
    f.steady = 1 - c01(((L.breaks || 0) + (H.breaks || 0) + (D.breaks || 0)) / 4);
    return f;
  }

  /* 보조선·특별한 손금·구·손 모양이 성향에 더하는 점수. why 에는 무엇이 더했는지 남긴다 */
  /* 손톱 빛깔: 같은 조명에서 찍은 손바닥 피부색과 견주어 본다 (red | pale | mid) */
  function nailTone(nl, skin) {
    if (!nl || !skin) return 'mid';
    const d = nl.pink - ((0.5 * skin[0] - 0.418688 * skin[1] - 0.081312 * skin[2]) - (-0.168736 * skin[0] - 0.331264 * skin[1] + 0.5 * skin[2]));
    return d >= 4 ? 'red' : d <= -6 ? 'pale' : 'mid';
  }
  function bonus(a) {
    const b = { vital: 0, advent: 0, heart: 0, logic: 0, dream: 0, grit: 0 };
    const why = { vital: [], advent: [], heart: [], logic: [], dream: [], grit: [] };
    const add = (id, v, name) => { b[id] += v; if (!why[id].includes(name)) why[id].push(name); };
    const L = a.lines || {}, M = a.marks || {}, S = a.special || {}, mt = (a.mounts && a.mounts.order) || [], sh = a.shape;
    if (L.sun && L.sun.found) { add('dream', 0.10, '태양선'); add('heart', 0.08, '태양선'); }
    if (L.mercury && L.mercury.found) add('logic', 0.10, '수성선');
    if (L.mars && L.mars.found) { add('vital', 0.10, '이중 생명선'); add('grit', 0.05, '이중 생명선'); }
    const mc = Math.min(2, (M.marriage && M.marriage.count) || 0), tc = Math.min(3, (M.travel && M.travel.count) || 0), nc = Math.min(2, (M.money && M.money.count) || 0);
    if (mc) add('heart', 0.04 * mc, '결혼선');
    if (tc) add('advent', 0.05 * tc, '여행선');
    if (nc) add('logic', 0.04 * nc, '재물선');
    if (S.m) add('grit', 0.08, 'M자 손금');
    if (S.simian) add('grit', 0.12, '막쥔손금');
    if (mt[0] && MOUNT_INFO[mt[0]]) {
      add(MOUNT_INFO[mt[0]].traits[0], 0.06, MOUNT_INFO[mt[0]].name);
      add(MOUNT_INFO[mt[0]].traits[1], 0.04, MOUNT_INFO[mt[0]].name);
    }
    const nl = a.nail;
    if (nl) {
      if (nl.ratio != null && nl.ratio >= 1.2) { add('heart', 0.05, '긴 손톱'); add('dream', 0.04, '긴 손톱'); }
      else if (nl.ratio != null && nl.ratio <= 0.95) { add('vital', 0.05, '넓은 손톱'); add('advent', 0.03, '넓은 손톱'); }
      else if (nl.ratio != null) { add('grit', 0.03, '고른 손톱'); add('logic', 0.03, '고른 손톱'); }
      const tone = nailTone(nl, a.quality && a.quality.skin);
      if (tone === 'red') add('vital', 0.04, '붉은 손톱');
      else if (tone === 'pale') add('logic', 0.04, '맑은 손톱');
      if (nl.moon) { add('grit', 0.03, '또렷한 반달'); add('vital', 0.03, '또렷한 반달'); }
    }
    if (sh) {
      if (sh.fingerRatio != null && sh.fingerRatio >= 0.83) add('logic', 0.06, '긴 손가락');
      if (sh.fingerRatio != null && sh.fingerRatio <= 0.73) add('vital', 0.06, '짧은 손가락');
      if (sh.thumbDeg != null && sh.thumbDeg >= 45) add('advent', 0.08, '넓게 벌어진 엄지');
      if (sh.thumbDeg != null && sh.thumbDeg <= 25) add('grit', 0.05, '모아 쥔 엄지');
      if (sh.idxRing >= 0.03) add('grit', 0.04, '긴 검지');
      if (sh.idxRing <= -0.03) { add('advent', 0.04, '긴 약지'); add('dream', 0.03, '긴 약지'); }
    }
    return { b, why };
  }

  function traitScores(f, bon) {
    const x = bon || { vital: 0, advent: 0, heart: 0, logic: 0, dream: 0, grit: 0 };
    const raw = {
      vital: 0.45 * f.lifeLen + 0.35 * f.lifeDepth + 0.20 * f.lifeReach,
      advent: 0.55 * f.lifeReach + 0.25 * f.headGap + 0.20 * f.headSlope,
      heart: 0.45 * f.heartRise + 0.30 * f.heartDepth + 0.25 * f.heartLen,
      logic: 0.40 * f.headLen + 0.35 * (1 - f.headSlope) + 0.25 * f.headDepth,
      dream: 0.70 * f.headSlope + 0.30 * f.heartRise,
      grit: 0.65 * f.fate + 0.20 * f.steady + 0.15 * f.lifeDepth,
    };
    return TRAITS.map((t) => Math.round(22 + 77 * c01(raw[t.id] + x[t.id])));
  }

  /* 자동차 고르기: 점수의 절대 크기가 아니라 "어느 성향이 상대적으로 두드러지는가"를 비교한다 */
  function pickCar(scores) {
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const u = scores.map((s) => s - mean);
    const un = Math.hypot(...u);
    const spread = un / Math.sqrt(scores.length);
    const rank = CARS.map((car) => {
      const cm = car.profile.reduce((a, b) => a + b, 0) / car.profile.length;
      const c = car.profile.map((p) => p - cm);
      const cos = un > 0 ? u.reduce((s, v, i) => s + v * c[i], 0) / (un * Math.hypot(...c)) : 0;
      return { car, cos, contrib: u.map((v, i) => v * c[i]) };
    }).sort((a, b) => b.cos - a.cos);
    let best = rank[0], balanced = false;
    if (spread < 7) {            // 여섯 성향이 고르게 발달한 손 → 팔방미인 SUV
      best = rank.find((r) => r.car.id === 'suv');
      balanced = true;
    }
    const sync = balanced ? Math.round(96 - spread) : Math.round(72 + 27 * Math.max(0, best.cos));
    return { car: best.car, sync, balanced, u, contrib: best.contrib };
  }

  const depthWord = (d) => (d >= 0.11 ? '매우 진함' : d >= 0.07 ? '진함' : d >= 0.04 ? '보통' : '옅음');

  /* 성향 하나에 대한 근거: 어느 선의 어떤 측정값 때문인지 */
  function evidence(id, lines, f) {
    const L = lines.life, H = lines.heart, D = lines.head, F = lines.fate;
    switch (id) {
      case 'vital':
        return f.lifeLen >= f.lifeDepth
          ? {
            line: 'life', bubble: '생명선이 손목까지 길~게 뻗었구먼!', short: '손목까지 길게 뻗은 생명선',
            detail: `생명선이 엄지와 검지 사이에서 손목 쪽으로 길게 이어집니다(전체 호의 ${pct(L.len)}%, 선명도 ${depthWord(L.depth)}).`,
            meaning: '수상학에서 길고 진한 생명선은 타고난 체력과 회복력을 뜻합니다.',
          }
          : {
            line: 'life', bubble: '생명선이 굵고 진하게 패였구먼!', short: '굵고 진한 생명선',
            detail: `생명선이 주변 피부보다 ${pct(L.depth)}% 어둡게 패여 또렷합니다(선명도 ${depthWord(L.depth)}, 전체 호의 ${pct(L.len)}%).`,
            meaning: '수상학에서 길고 진한 생명선은 타고난 체력과 회복력을 뜻합니다.',
          };
      case 'advent':
        return 0.55 * f.lifeReach >= 0.25 * f.headGap + 0.05 || !D.found || D.gap == null
          ? {
            line: 'life', bubble: '생명선이 손바닥 한복판까지 휘었어!', short: '손바닥 한복판까지 크게 도는 생명선',
            detail: `생명선이 엄지 쪽에서 손바닥 폭의 ${pct(L.reach)}% 지점까지 크게 휘어 돕니다. 엄지 두덩(금성구)이 넓다는 뜻입니다.`,
            meaning: '넓게 도는 생명선은 활동 반경이 넓고 낯선 곳을 즐기는 기질로 풉니다.',
          }
          : {
            line: 'head', bubble: '두뇌선과 생명선이 따로 출발하는구먼!', short: '생명선과 떨어져 출발하는 두뇌선',
            detail: `두뇌선과 생명선의 시작점이 손바닥 길이의 ${pct(Math.abs(D.gap))}%만큼 떨어져 있습니다.`,
            meaning: '두 선이 따로 출발하면 독립심이 강하고 대담한 성격으로 풉니다.',
          };
      case 'heart':
        return 0.45 * f.heartRise >= 0.30 * f.heartDepth
          ? {
            line: 'heart', bubble: '감정선 끝이 검지 쪽으로 휘어 오르네!', short: '검지 쪽으로 휘어 오르는 감정선',
            detail: `감정선이 새끼손가락 아래에서 시작해 손바닥 폭의 ${pct(H.len)}%를 가로지르고, 끝이 손가락 쪽으로 휘어 올라갑니다.`,
            meaning: '손가락 쪽으로 휘어 오르는 감정선은 정이 많고 표현이 풍부한 상입니다.',
          }
          : {
            line: 'heart', bubble: '감정선이 깊고 진하구먼!', short: '깊고 진한 감정선',
            detail: `감정선이 주변 피부보다 ${pct(H.depth)}% 어둡게 패여 또렷하고(선명도 ${depthWord(H.depth)}), 손바닥 폭의 ${pct(H.len)}%를 가로지릅니다.`,
            meaning: '깊고 진한 감정선은 감정이 풍부하고 한번 준 마음이 오래가는 상입니다.',
          };
      case 'logic':
        return 0.35 * (1 - f.headSlope) >= 0.40 * f.headLen
          ? {
            line: 'head', bubble: '두뇌선이 자로 그은 듯 곧구먼!', short: '자로 그은 듯 곧은 두뇌선',
            detail: `두뇌선의 기울기가 ${Math.round(D.slopeDeg)}°로 거의 수평이고, 손바닥 폭의 ${pct(D.len)}%를 가로지릅니다.`,
            meaning: '곧게 뻗은 두뇌선은 현실 감각과 분석력을 뜻합니다.',
          }
          : {
            line: 'head', bubble: '두뇌선이 손날까지 길게 갔구먼!', short: '손날 쪽까지 길게 뻗은 두뇌선',
            detail: `두뇌선이 손바닥 폭의 ${pct(D.len)}%를 가로지를 만큼 깁니다(기울기 ${Math.round(D.slopeDeg)}°).`,
            meaning: '긴 두뇌선은 깊이 생각하고 꼼꼼하게 따져보는 성격을 뜻합니다.',
          };
      case 'dream':
        return 0.70 * f.headSlope >= 0.30 * f.heartRise || !H.found
          ? {
            line: 'head', bubble: '두뇌선이 아래로 스르륵 흘러내리네!', short: '아래로 흘러내리는 두뇌선',
            detail: `두뇌선이 손바닥 아래쪽 월구 방향으로 ${Math.round(D.slopeDeg)}° 기울어 내려갑니다.`,
            meaning: '월구 쪽으로 흘러내리는 두뇌선은 상상력과 창의성을 뜻합니다.',
          }
          : {
            line: 'heart', bubble: '감정선이 둥글게 휘어 오르네!', short: '둥글게 휘어 오르는 감정선',
            detail: `감정선 끝이 손가락 쪽으로 손바닥 길이의 ${pct(Math.max(0, H.rise))}%만큼 휘어 올라갑니다.`,
            meaning: '부드럽게 휘는 감정선은 풍부한 감수성과 상상력으로 풉니다.',
          };
      default:
        return F.found
          ? {
            line: 'fate', bubble: '운명선이 중지 쪽으로 쭉 올라가는구먼!', short: '중지 쪽으로 곧게 오르는 운명선',
            detail: `운명선이 손목 쪽에서 중지 방향으로 또렷하게 올라갑니다(추적 구간 ${pct(F.len)}%, 선명도 ${depthWord(F.depth)}).`,
            meaning: '또렷한 운명선은 목표가 분명하고 한번 정한 길을 끝까지 가는 뚝심을 뜻합니다.',
          }
          : {
            line: 'life', bubble: '주요선이 끊김 없이 이어지는구먼!', short: '끊김 없이 이어지는 주요선',
            detail: '생명선·감정선·두뇌선에 끊긴 곳이 거의 없이 고르게 이어집니다.',
            meaning: '끊김 없는 선은 흔들리지 않는 꾸준함으로 풉니다.',
          };
    }
  }

  /* 판독 결과 → 화면에 쓸 결과 묶음 */
  function read(analysis, profile) {
    const f = features(analysis.lines);
    const bon = bonus(analysis);
    const scores = traitScores(f, bon.b);
    const pick = pickCar(scores);
    // 이유: 내 성향 중 상대적으로 높고(u>0), 이 차의 성격과도 맞는(contrib 큼) 성향 두 가지
    let order = TRAITS.map((t, i) => ({ i, u: pick.u[i], k: pick.contrib[i] }));
    const strong = order.filter((o) => o.u > 0).sort((a, b) => (pick.balanced ? b.u - a.u : b.k - a.k));
    const rest = order.filter((o) => o.u <= 0).sort((a, b) => b.u - a.u);
    order = strong.concat(rest).slice(0, 2);
    const reasons = order.map((o) => {
      const t = TRAITS[o.i], ev = evidence(t.id, analysis.lines, f);
      return Object.assign({
        trait: t.id, name: t.name, score: scores[o.i],
        fit: pick.car.fit[t.id] || `이 차와 닮은 점은 ${t.mean}`,
        plus: bon.why[t.id].length ? `${bon.why[t.id].join(', ')}도 ${t.name} 점수를 더했습니다.` : '',
      }, ev);
    });
    const [a, b] = reasons;
    const script = {
      p1: a.bubble,
      p2: '게다가 ' + b.bubble,
      p3: pick.balanced
        ? '여섯 성향이 고르게 높은 육각형 손금… 맞는 차는 딱 하나!'
        : `${a.name} ${a.score}점에 ${b.name} ${b.score}점… 이 손에 맞는 차는 딱 하나!`,
      p4: pick.car.punch,
    };
    return {
      v: 3, ts: Date.now(), carId: pick.car.id, sync: pick.sync, balanced: pick.balanced,
      scores, reasons, script, lines: analysis.lines, quality: analysis.quality,
      marks: analysis.marks || null, special: analysis.special || null, mounts: analysis.mounts || null, shape: analysis.shape || null, nail: analysis.nail || null,
      boost: bon.why,
      profile: Object.assign({ hand: 'right', gender: 'u', age: 30 }, profile || {}),
      skin: (analysis.quality && analysis.quality.skin) || null,
    };
  }

  /* ============================================================
   * 자동차 말고 함께 추천하는 것들 (후보 목록은 01b-picks.js)
   * ============================================================ */
  const tierOf = (age) => (age <= 20 ? 'young' : age <= 40 ? 'mid' : 'senior');
  /* 보통 손금의 평균(TRAIT_BASE)과 견준 뒤, 그 사람 안에서 상대적으로 높고 낮은 정도로 바꾼다 */
  function centred(scores) {
    const adj = scores.map((v, i) => v - TRAIT_BASE[i]);
    const mean = adj.reduce((a, b) => a + b, 0) / adj.length;
    return adj.map((v) => v - mean);
  }
  /* 후보 가운데 내 두드러진 성향과 가장 잘 겹치는 것을 고른다 */
  function choose(options, u, tier) {
    let best = null;
    for (const o of options) {
      if (o.tier && o.tier !== tier) continue;
      let sum = 0, norm2 = 0, top = null, topV = -1e9;
      for (const k of Object.keys(o.w)) {
        const v = u[TRAIT_INDEX[k]] * o.w[k];
        sum += v; norm2 += o.w[k] * o.w[k];
        if (v > topV) { topV = v; top = k; }
      }
      const sc = sum / Math.sqrt(norm2);
      if (!best || sc > best.score) best = { opt: o, score: sc, trait: top };
    }
    return best;
  }
  /* 손바닥 피부색 → 퍼스널컬러 (sRGB → CIELAB 의 밝기 L 과 색상각) */
  function personalColor(rgb) {
    if (!rgb) return null;
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const r = lin(rgb[0]), g = lin(rgb[1]), b = lin(rgb[2]);
    const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const L = 116 * f(Y) - 16, a = 500 * (f(X) - f(Y)), bb = 200 * (f(Y) - f(Z));
    const hue = Math.atan2(bb, a) * 180 / Math.PI;
    const warm = hue >= 48, light = L >= 66;
    const id = warm ? (light ? 'spring' : 'autumn') : (light ? 'summer' : 'winter');
    return { id, L: Math.round(L), hue: Math.round(hue), warm, light };
  }
  function heartStyle(H) {
    if (!H || !H.found) return '감정선이 옅어, 마음을 쉽게 드러내지 않고 천천히 가까워지는 편입니다.';
    if (H.rise >= 0.14) return '감정선이 검지 쪽으로 크게 휘어 올라, 좋아하는 마음을 먼저 표현하는 편입니다.';
    if (H.rise <= 0.05) return '감정선이 곧게 뻗어, 시간을 두고 천천히 마음을 여는 편입니다.';
    return '감정선이 고르게 이어져, 한번 마음을 주면 오래 가는 편입니다.';
  }
  /* u = centred(scores). 활력·모험 → E/I, 상상 → N/S, 이성과 감성 → T/F, 뚝심과 모험 → J/P */
  function myMbti(u) {
    const I = TRAIT_INDEX;
    return (u[I.vital] + u[I.advent] >= 0 ? 'E' : 'I') + (u[I.dream] >= 0 ? 'N' : 'S')
      + (u[I.logic] >= u[I.heart] ? 'T' : 'F') + (u[I.grit] >= u[I.advent] ? 'J' : 'P');
  }

  function extras(res) {
    const prof = Object.assign({ hand: 'right', gender: 'u', age: 30 }, res.profile || {});
    const u = centred(res.scores), tier = tierOf(prof.age);
    const chip = (id) => (id ? `${TRAITS[TRAIT_INDEX[id]].name} ${res.scores[TRAIT_INDEX[id]]}` : '');
    // 항목에 따라 두 번째·세 번째로 두드러진 성향으로 고른다 (PICK_LENS)
    const order = u.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
    const lens = (k) => {
      const v = u.slice();
      for (let j = 0; j < k - 1; j++) v[order[j]] = -100;
      return v;
    };
    const items = {};
    for (const cat of Object.keys(PICKS)) {
      const c = choose(PICKS[cat].options, lens(PICK_LENS[cat] || 1), tier);
      items[cat] = { cat, label: PICKS[cat].label, name: c.opt.name, why: (c.opt.whyBy && c.opt.whyBy[c.trait]) || c.opt.why, chip: chip(c.trait), trait: c.trait };
      if (cat === 'region') {
        items[cat].name = `${c.opt.area === '한국' ? '대한민국' : c.opt.area} · ${c.opt.name}`;
        items[cat].area = c.opt.area;
        items[cat].short = c.opt.area === '북한' ? `북한 ${c.opt.name}` : c.opt.name;
      }
      if (cat === 'shop') {
        items[cat].short = c.opt.name.split(' · ').pop();
        // 유형별 궁합: 유형마다 가장 잘 맞는 후보의 점수를 50~99로 환산
        const byType = {};
        for (const o of PICKS.shop.options) {
          const sc = choose([o], u, tier).score;
          if (!(o.type in byType) || sc > byType[o.type]) byType[o.type] = sc;
        }
        const vals = Object.values(byType), lo = Math.min(...vals), hi = Math.max(...vals);
        items[cat].bars = Object.keys(byType)
          .map((t) => ({ label: PICKS.shop.types[t], pct: Math.round(50 + 49 * (hi > lo ? (byType[t] - lo) / (hi - lo) : 0.5)) }))
          .sort((a, b) => b.pct - a.pct);
      }
    }
    // 퍼스널컬러
    const pc = personalColor(res.skin);
    if (pc) {
      const P = PERSONAL_COLORS[pc.id];
      items.pcolor = {
        cat: 'pcolor', label: '퍼스널컬러', name: P.name, swatches: P.swatches, chip: '',
        why: `찍힌 손바닥 피부가 ${P.desc}이에요(밝기 ${pc.L}, 색상각 ${pc.hue}°). 조명에 따라 달라질 수 있어요.`,
      };
    } else {
      items.pcolor = { cat: 'pcolor', label: '퍼스널컬러', name: '판독 불가', why: '이 결과에는 피부색 측정값이 없어요. 다시 찍으면 나옵니다.', chip: '' };
    }
    // 어울리는 사람: 가장 낮은 성향을 채워 주는 타입
    let weak = 0;
    u.forEach((v, i) => { if (v < u[weak]) weak = i; });
    const wid = TRAITS[weak].id, teen = prof.age <= 10, g = prof.gender;
    const who = teen ? '친구' : g === 'u' ? '상대' : '이성';
    const me = myMbti(u), lookKey = teen || g === 'u' ? 'n' : g === 'm' ? 'f' : 'm';
    items.ptype = {
      cat: 'ptype', label: teen ? '잘 맞는 친구' : `어울리는 ${who}`, name: PARTNER.type[wid].name,
      why: `${PARTNER.type[wid].why}. ${heartStyle(res.lines && res.lines.heart)}`, chip: `내 ${chip(wid)}`, weak: wid,
    };
    items.pmbti = {
      cat: 'pmbti', label: `${who}의 MBTI`, name: PARTNER.mbti[me].join(' · '),
      why: `손금으로 본 당신은 ${me} 기질이에요. 서로의 빈 곳을 채워 주는 조합입니다.`, chip: '',
    };
    items.plook = {
      cat: 'plook', label: teen ? '친구의 인상' : g === 'u' ? '상대의 인상' : '이성의 외모', name: PARTNER.look[wid].name,
      why: PARTNER.look[wid][lookKey], chip: '',
    };
    const groups = PICK_GROUPS.map((gr) => ({ id: gr.id, tab: gr.tab, whyTitle: gr.why, items: gr.cats.map((c) => items[c]) }));
    for (const gr of groups) gr.whyText = groupWhy(gr, res, me);
    return { groups, items, mbti: me, profile: prof };
  }

  /* 주요선 말고 더 읽은 것들: 보조선, 특별한 손금, 구(丘), 손 모양 */
  function reading(res) {
    const L = res.lines || {}, M = res.marks, S = res.special, mt = res.mounts, sh = res.shape, out = [];
    const tn = (ids) => ids.map((id) => TRAITS[TRAIT_INDEX[id]].name);
    if (L.sun && M) {
      const cnt = (k) => (M[k] ? M[k].count : 0);
      const rows = [
        L.sun.found
          ? { tag: '태양선', color: LINE_INFO.sun.color, text: `약지 아래로 손바닥 길이의 ${pct(L.sun.len)}%만큼 오릅니다. 재능을 알아봐 주는 사람이 많은 인기의 선입니다.`, plus: tn(['dream', 'heart']) }
          : { tag: '태양선', color: LINE_INFO.sun.color, text: '또렷하게 보이지 않습니다. 박수보다 실력을 먼저 쌓는 대기만성형으로 풉니다.' },
        L.mercury.found
          ? { tag: '수성선', color: LINE_INFO.mercury.color, text: `새끼손가락 쪽으로 비스듬히 ${pct(L.mercury.len)}%만큼 오릅니다. 사업선이라고도 하며 말솜씨와 수완을 뜻합니다.`, plus: tn(['logic']) }
          : { tag: '수성선', color: LINE_INFO.mercury.color, text: '보이지 않습니다. 건강선이라고도 하는 선이라, 수상학에서는 없는 편을 오히려 잔병 없는 손으로 봅니다.' },
        L.mars.found
          ? { tag: '이중 생명선', color: LINE_INFO.mars.color, text: '생명선 안쪽에 나란히 한 줄이 더 있습니다. 화성선이라고도 하며, 지쳐도 금방 일어나는 회복력을 뜻합니다.', plus: tn(['vital', 'grit']) }
          : { tag: '이중 생명선', color: LINE_INFO.mars.color, text: '보이지 않습니다. 생명선 한 줄로 꾸준히 가는 손입니다.' },
        { tag: '결혼선', color: '#DB2777', text: ['또렷한 선이 없습니다. 지금은 인연보다 내 일에 마음이 가 있는 때로 풉니다.', '또렷한 한 줄입니다. 한 사람에게 깊이 마음 쓰는 타입으로 풉니다.', '두 줄입니다. 정이 많아 인연이 넉넉한 타입으로 풉니다.', '세 줄 이상입니다. 주변에 사람이 끊이지 않는 타입으로 풉니다.'][Math.min(3, cnt('marriage'))], plus: cnt('marriage') ? tn(['heart']) : null },
        { tag: '여행선', color: '#2563EB', text: ['보이지 않습니다. 익숙한 곳에서 힘을 얻는 타입으로 풉니다.', '한 줄입니다. 가끔 훌쩍 떠나야 충전되는 타입으로 풉니다.', '두 줄입니다. 한곳에 오래 머물면 좀이 쑤시는 타입으로 풉니다.', '세 줄 이상입니다. 역마살이라 부르는, 떠돌수록 운이 트이는 손으로 풉니다.'][Math.min(3, cnt('travel'))], plus: cnt('travel') ? tn(['advent']) : null },
        { tag: '재물선', color: '#B45309', text: ['또렷한 선이 없습니다. 모으기보다 쓰는 데서 보람을 찾는 타입으로 풉니다.', '새끼손가락 아래에 한 줄입니다. 들어온 돈을 꾸준히 지키는 타입으로 풉니다.', '새끼손가락 아래에 두 줄 이상입니다. 돈이 들어오는 길이 여러 갈래인 손으로 풉니다.'][Math.min(2, cnt('money'))], plus: cnt('money') ? tn(['logic']) : null },
      ];
      out.push({ title: '보조선', rows });
    }
    if (S && (S.m || S.simian)) {
      const rows = [];
      if (S.m) rows.push({ tag: 'M자 손금', color: '#C3251C', text: '생명선·두뇌선·감정선에 운명선이 가로질러 M자를 이룹니다. 직감이 좋고 뒷심으로 재물을 모은다는 손금입니다.', plus: tn(['grit']) });
      if (S.simian) rows.push({ tag: '막쥔손금', color: '#C3251C', text: '감정선과 두뇌선이 한 줄로 이어져 손바닥을 가로지릅니다. 한번 마음먹으면 끝을 보는 집중력을 뜻합니다.', plus: tn(['grit']) });
      out.push({ title: '특별한 손금', rows });
    }
    if (mt && mt.order && mt.order.length >= 2) {
      const row = (id, rank) => ({ tag: MOUNT_INFO[id].name, color: '#1A1410', text: `${rank} 혈색이 도는 자리입니다(${MOUNT_INFO[id].where}). ${MOUNT_INFO[id].mean}을 뜻합니다.`, plus: rank === '가장' ? tn(MOUNT_INFO[id].traits) : null });
      out.push({ title: '구(丘)', rows: [row(mt.order[0], '가장'), row(mt.order[1], '두 번째로')], note: '구는 도톰하게 솟은 정도로 보지만 사진으로는 잴 수 없어, 주변보다 붉은 기가 도는 정도로 가늠했습니다.' });
    }
    const nl = res.nail;
    if (nl) {
      const rows = [];
      rows.push(nl.ratio == null
        ? { tag: '모양', color: '#1A1410', text: '손톱의 테두리가 또렷하게 잡히지 않아 모양은 읽지 못했습니다. 빛이 반사되지 않는 곳에서 손톱 한 개만 틀에 꽉 차게 찍으면 읽을 수 있습니다.' }
        : nl.ratio >= 1.2 ? { tag: '모양', color: '#1A1410', text: '세로로 긴 손톱입니다. 수상학에서는 마음이 여리고 상상력이 풍부한 사람의 손톱으로 봅니다. 다툼을 싫어하고 분위기를 부드럽게 만드는 재주가 있으며, 예술·감각을 쓰는 일과 잘 맞습니다.', plus: tn(['heart', 'dream']) }
        : nl.ratio <= 0.95 ? { tag: '모양', color: '#1A1410', text: '가로로 넓은 손톱입니다. 수상학에서는 솔직하고 몸이 먼저 움직이는 사람의 손톱으로 봅니다. 돌려 말하지 못하고 뒤끝이 없으며, 승부가 분명한 일에서 힘을 냅니다.', plus: tn(['vital', 'advent']) }
        : { tag: '모양', color: '#1A1410', text: '길이와 너비가 고른 손톱입니다. 수상학에서는 치우침 없이 차근차근 해내는 사람의 손톱으로 봅니다. 감정과 판단의 균형이 좋아 주변에서 믿고 일을 맡깁니다.', plus: tn(['grit', 'logic']) });
      const tone = nailTone(nl, res.skin);
      rows.push(tone === 'red' ? { tag: '빛깔', color: '#C3251C', text: '손바닥보다 붉은 기가 도는 손톱입니다. 기운이 넘치고 열이 많은 기질로 풉니다. 하고 싶은 일이 생기면 바로 달려드는 추진력이 있고, 그만큼 성미가 급한 면도 있습니다.', plus: tn(['vital']) }
        : tone === 'pale' ? { tag: '빛깔', color: '#C3251C', text: '맑고 옅은 빛의 손톱입니다. 차분하게 따져 보는 기질로 풉니다. 쉽게 들뜨지 않고 한 걸음 물러나 상황을 보는 침착함이 있습니다.', plus: tn(['logic']) }
        : { tag: '빛깔', color: '#C3251C', text: '고운 분홍빛 손톱입니다. 모나지 않고 두루 잘 어울리는 기질로 풉니다. 사람 사이에서 편안함을 주어 인복이 따른다고 봅니다.' });
      rows.push(nl.moon ? { tag: '반달', color: '#0E6E66', text: '뿌리 쪽에 반달이 또렷합니다. 한번 시작하면 밀고 나가는 추진력과 버티는 힘이 좋다고 풉니다.', plus: tn(['grit', 'vital']) }
        : { tag: '반달', color: '#0E6E66', text: '반달이 뚜렷하게 보이지 않습니다. 서두르지 않고 제 속도로 가는 타입으로 풉니다. 무리해서 몰아치기보다 꾸준히 나눠서 하는 방식이 맞습니다.' });
      // 한 줄 종합
      const shapeWord = nl.ratio == null ? '' : nl.ratio >= 1.2 ? '여린 마음' : nl.ratio <= 0.95 ? '솔직한 행동력' : '고른 균형감';
      const toneWord = tone === 'red' ? '뜨거운 기운' : tone === 'pale' ? '차분한 판단' : '부드러운 친화력';
      rows.push({ tag: '종합', color: '#1A1410', text: `${shapeWord ? shapeWord + '에 ' : ''}${toneWord}${nl.moon ? ', 여기에 밀고 나가는 뒷심까지' : ''} 갖춘 손톱입니다. 손금 풀이와 겹치는 대목이 있다면 그 성향이 특히 강하다는 뜻으로 봅니다.` });
      out.push({ title: '손톱', rows, note: '엄지 손톱 한 개의 모양과 빛깔만 재미로 본 것입니다. 조명과 매니큐어에 따라 달라질 수 있고, 건강 상태를 뜻하지 않습니다.' });
    }
    if (sh) {
      const rows = [];
      if (sh.fingerRatio != null) {
        const r = sh.fingerRatio;
        rows.push({ tag: '손가락 길이', color: '#1A1410', text: r >= 0.83 ? '손바닥에 비해 긴 편입니다. 꼼꼼하게 따져 보는 분석형으로 풉니다.' : r <= 0.73 ? '손바닥에 비해 짧은 편입니다. 생각보다 몸이 먼저 나가는 행동형으로 풉니다.' : '손바닥과 균형이 맞습니다. 생각과 행동이 고르게 가는 손으로 풉니다.', plus: r >= 0.83 ? tn(['logic']) : r <= 0.73 ? tn(['vital']) : null });
      }
      if (sh.thumbDeg != null) {
        const d = sh.thumbDeg;
        rows.push({ tag: '엄지 각도', color: '#1A1410', text: `${d}°로 ${d >= 45 ? '넓게 벌어집니다. 대범하고 씀씀이가 시원한 타입으로 풉니다.' : d <= 25 ? '모아 쥐는 편입니다. 신중하고 알뜰한 타입으로 풉니다.' : '보통입니다. 상황에 맞게 조절하는 타입으로 풉니다.'}`, plus: d >= 45 ? tn(['advent']) : d <= 25 ? tn(['grit']) : null });
      }
      rows.push({ tag: '검지와 약지', color: '#1A1410', text: sh.idxRing >= 0.03 ? '검지가 더 깁니다. 앞에 나서서 이끄는 타입으로 풉니다.' : sh.idxRing <= -0.03 ? '약지가 더 깁니다. 승부와 모험을 즐기는 타입으로 풉니다.' : '길이가 비슷합니다. 나설 때와 물러설 때를 아는 타입으로 풉니다.', plus: sh.idxRing >= 0.03 ? tn(['grit']) : sh.idxRing <= -0.03 ? tn(['advent', 'dream']) : null });
      out.push({ title: '손 모양', rows });
    }
    return out;
  }

  /* 선 하나의 판독 요약 (결과 화면의 범례) */
  function lineSummary(id, l) {
    if (!l.found) return id === 'fate' ? '뚜렷하지 않음 · 정해진 길보다 스스로 개척하는 타입' : '옅어서 일부만 읽힘';
    const d = `선명도 ${depthWord(l.depth)}`;
    if (id === 'life') return `전체 호의 ${pct(l.len)}% · 손바닥 폭 ${pct(l.reach)}%까지 휘어 돎 · ${d}`;
    if (id === 'heart') return `손바닥 폭의 ${pct(l.len)}% · 끝이 ${l.rise >= 0.03 ? '위로 휘어 오름' : l.rise <= -0.02 ? '아래로 내려감' : '곧게 뻗음'} · ${d}`;
    if (id === 'head') return `손바닥 폭의 ${pct(l.len)}% · 기울기 ${Math.round(l.slopeDeg)}° · ${d}`;
    return `손목에서 중지 쪽으로 ${pct(l.len)}% · ${d}`;
  }

  /* ---------- 묶음마다 "왜 이걸 골랐는지" ---------- */
  const GROUP_FLAVOR = {
    style: '옷차림과 소지품은 성향이 가장 먼저 드러나는 곳이라',
    life: '무엇을 먹고 어디서 장을 보는지에도 성향이 묻어나서',
    tech: '매일 손에 쥐는 기기와 PC는 쓰는 사람의 습관을 닮아야 오래 아껴 쓰게 되니',
    home: '대형가전은 한번 들이면 10년을 함께하는 살림이라',
    people: '사람은 나와 같은 점보다 나에게 없는 점을 채워 줄 때 오래가서',
    place: '사는 곳은 하루의 리듬을 정하는 곳이라',
  };
  /* 성향 하나가 손금 어디에서 나왔는지 한 줄로 */
  function traitSource(res, id) {
    const f = features(res.lines), ev = evidence(id, res.lines, f), plus = (res.boost && res.boost[id]) || [];
    const w = plus.slice(0, 2).join('·'), last = w.charCodeAt(w.length - 1);
    const ga = last >= 0xAC00 && last <= 0xD7A3 && (last - 0xAC00) % 28 === 0 ? '가' : '이';      // 받침 없으면 '가'
    return `${ev.short}${plus.length ? `(여기에 ${w}${ga} 더함)` : ''}`;
  }
  function groupWhy(gr, res, mbti) {
    const sc = (id) => res.scores[TRAIT_INDEX[id]], nm = (id) => TRAITS[TRAIT_INDEX[id]].name;
    if (gr.id === 'people') {
      const wid = gr.items[0].weak;
      return [
        `어울리는 사람은 나의 강점이 아니라 빈 곳을 보고 골랐어요. 여섯 성향 중 ${nm(wid)}(${sc(wid)}점)이 가장 덜 드러나는 손금이라, 그 부분을 자연스럽게 채워 주는 사람이 곁에 있을 때 균형이 맞습니다.`,
        `MBTI는 손금 성향을 네 글자로 옮긴 ${mbti}를 기준으로, 서로 보완이 잘 된다고 알려진 조합을 골랐어요.`,
      ];
    }
    // 이 묶음 항목들이 근거로 삼은 성향 (많이 쓰인 순)
    const cnt = {};
    for (const it of gr.items) if (it.trait) cnt[it.trait] = (cnt[it.trait] || 0) + 1;
    const ids = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || sc(b) - sc(a)).slice(0, 2);
    if (!ids.length) return ['손금 전체의 성향을 고르게 보고 골랐어요.'];
    const t0 = TRAITS[TRAIT_INDEX[ids[0]]];
    const out = [
      `${GROUP_FLAVOR[gr.id]}, 이 묶음은 손금에서 두드러진 ${ids.map((id) => `${nm(id)}(${sc(id)}점)`).join('과 ')} 성향을 기준으로 골랐어요.`,
      ids.map((id) => `${nm(id)} 점수는 ${traitSource(res, id)}에서 나왔습니다.`).join(' '),
      `${t0.name}이 높은 사람은 ${t0.mean}이 있어, 그 기질을 살려 주고 오래 질리지 않을 것들로 맞췄어요.`,
    ];
    if (gr.items.some((it) => it.cat === 'pcolor')) out.push('퍼스널컬러만은 성향이 아니라 사진에 찍힌 손바닥 피부 톤으로 골랐어요.');
    if (gr.id === 'place') out.push('국내·해외·북한 후보를 모두 놓고 성향이 가장 잘 맞는 곳 하나를 뽑았어요.');
    return out;
  }

  /* ---------- 손금 풀이: 주요선 네 개가 뜻하는 것 ---------- */
  function lineMeaning(id, lines) {
    const l = lines[id], f = features(lines);
    if (id === 'life') {
      if (!l.found) return '선이 옅어 일부만 읽혔습니다. 수상학에서는 무리하게 달리기보다 쉬어 가며 힘을 모으는 손으로 풉니다.';
      return (f.lifeLen >= 0.6 ? '손목 쪽까지 길게 이어집니다. 기운이 오래가고, 지쳐도 금방 회복하는 손입니다. ' : '길지 않은 편입니다. 짧고 굵게 힘을 몰아 쓰는 손으로, 쉬는 시간을 꼭 챙겨야 능률이 납니다. ')
        + (f.lifeReach >= 0.55 ? '손바닥 가운데까지 크게 휘어 돌아, 활동 반경이 넓고 밖에서 기운을 얻는 타입입니다. ' : f.lifeReach <= 0.3 ? '엄지 쪽에 바짝 붙어 내려와, 익숙한 사람과 공간에서 힘을 얻는 신중한 타입입니다. ' : '휘는 정도가 알맞아, 나설 때와 쉴 때를 가릴 줄 아는 타입입니다. ')
        + (f.lifeDepth >= 0.6 ? '다른 선보다 깊은 편이라 의지와 생활력이 강합니다.' : '다른 선보다 가는 편이라 섬세하고 주변 분위기에 민감합니다.')
        + ' 생명선의 길이는 수명이 아니라 활력을 봅니다.';
    }
    if (id === 'head') {
      if (!l.found) return '선이 옅어 일부만 읽혔습니다. 깊이 따지기보다 느낌과 경험으로 정하는 손으로 풉니다.';
      return (f.headSlope >= 0.6 ? '손바닥 아래쪽으로 길게 처집니다. 상상력과 감수성이 풍부해 기획·창작에 강한 머리입니다. ' : f.headSlope <= 0.25 ? '옆으로 곧게 뻗습니다. 현실 감각과 셈이 빠르고, 근거를 확인해야 움직이는 머리입니다. ' : '완만하게 내려갑니다. 현실 감각과 상상력이 한쪽으로 치우치지 않은 머리입니다. ')
        + (f.headLen >= 0.6 ? '선이 길어 한 가지를 오래, 깊게 파고듭니다. ' : '선이 짧은 편이라 고민을 오래 끌지 않고 결정이 빠릅니다. ')
        + (l.gap != null && f.headGap >= 0.6 ? '생명선과 떨어져서 출발해 독립심이 강하고 결단이 대담합니다.' : '생명선과 붙어서 출발해 돌다리도 두드려 보는 신중함이 있습니다.');
    }
    if (id === 'heart') {
      if (!l.found) return '선이 옅어 일부만 읽혔습니다. 감정을 겉으로 잘 드러내지 않는 손으로 풉니다.';
      return (f.heartRise >= 0.55 ? '끝이 검지 쪽으로 휘어 오릅니다. 마음을 숨기지 않고 표현하며, 애정에 적극적입니다. ' : f.heartRise <= 0.15 ? '끝이 곧게 뻗습니다. 표현은 서툴러도 속정이 깊고, 감정에 휩쓸리지 않습니다. ' : '끝이 살짝 오릅니다. 다정하지만 선을 지킬 줄 아는 따뜻한 타입입니다. ')
        + (f.heartLen >= 0.6 ? '선이 길어 한번 맺은 인연을 오래 가져갑니다. ' : '선이 짧은 편이라 넓은 관계보다 가까운 몇 사람에게 마음을 씁니다. ')
        + (f.heartDepth >= 0.6 ? '다른 선보다 깊은 편이라 좋고 싫음이 분명합니다.' : '다른 선보다 가는 편이라 상대 기분을 잘 살피는 세심함이 있습니다.');
    }
    if (!l.found) return '또렷한 운명선이 없습니다. 정해진 길을 따르기보다 여러 일을 거치며 내 길을 직접 만드는 손으로 풉니다. 나쁜 뜻이 아니라 자유로운 손입니다.';
    return (l.len >= 0.6 ? '손목 가까이에서 중지 쪽으로 길게 오릅니다. 일찍 방향을 정하고 한 우물을 파는 손입니다. ' : '손바닥 중간쯤부터 오릅니다. 스스로 길을 찾아 뒤늦게 자리를 잡는 자수성가형으로 풉니다. ')
      + (l.depth >= 0.07 ? '선이 진해 맡은 일에 대한 책임감과 직업운이 강합니다.' : '선이 옅어 한 가지 직함에 묶이기보다 여러 역할을 오갑니다.');
  }

  /* ---------- 종합 풀이: 성격 · 연애운 · 재물운 · 일과 적성 ---------- */
  const TRAIT_SELF = {
    vital: '에너지가 넘쳐 가만히 있지 못하는', advent: '새로운 것을 보면 일단 해 보는', heart: '정이 많고 표현이 풍부한',
    logic: '따질 것은 따지고 넘어가는', dream: '남들과 다른 그림을 그리는', grit: '한번 정하면 끝까지 가는',
  };
  const TRAIT_JOB = {
    vital: '몸으로 뛰고 현장을 누비는 일', advent: '새 판을 벌이는 기획·영업·창업', heart: '사람을 상대하고 돌보는 일',
    logic: '숫자와 근거를 다루는 분석·관리', dream: '없던 것을 만들어 내는 창작·디자인', grit: '오래 쌓아야 빛나는 전문직·장인의 일',
  };
  function overall(res) {
    const L = res.lines || {}, M = res.marks || {}, S = res.special || {}, f = features(L);
    const order = TRAITS.map((t, i) => ({ id: t.id, name: t.name, s: res.scores[i] - TRAIT_BASE[i] })).sort((a, b) => b.s - a.s);
    const a = order[0], b = order[1], low = order[order.length - 1];
    const cnt = (k) => (M[k] ? M[k].count : 0), has = (k) => !!(L[k] && L[k].found);
    const rows = [];
    rows.push({ tag: '성격', text: `${TRAIT_SELF[a.id]} 사람입니다. 여기에 ${b.name}이 받쳐 주어 ${TRAIT_SELF[b.id]} 면도 함께 보입니다. 상대적으로 ${low.name} 쪽은 덜 쓰는 편이라, 그 부분을 채워 주는 사람과 잘 맞습니다.` });
    rows.push({ tag: '연애운', text:
      (f.heartRise >= 0.55 ? '좋아하면 먼저 다가가는 편이라 인연이 시작되기 쉽습니다. ' : f.heartRise <= 0.15 ? '마음을 여는 데 시간이 걸리지만, 한번 열면 오래갑니다. ' : '서두르지 않고 편안하게 가까워지는 연애를 합니다. ')
      + (cnt('marriage') >= 2 ? '결혼선이 여러 줄이라 인연의 기회가 여러 번 온다고 풉니다. ' : cnt('marriage') === 1 ? '결혼선이 한 줄로 또렷해 한 사람과 깊게 가는 운입니다. ' : '결혼선이 옅어 지금은 사람보다 내 일에 마음이 가 있는 때입니다. ')
      + (has('sun') ? '태양선이 있어 호감을 사는 매력도 따릅니다.' : '') });
    rows.push({ tag: '재물운', text:
      (S.m ? 'M자 손금이라 뒷심으로 재물을 모은다고 풉니다. ' : '')
      + (has('fate') ? '운명선이 서 있어 꾸준한 일에서 돈이 들어오는 운입니다. ' : '운명선이 옅어 한 곳의 월급보다 여러 갈래의 벌이가 어울립니다. ')
      + (cnt('money') >= 1 ? '재물선이 보여 들어온 돈을 지킬 줄 압니다. ' : '재물선은 옅어 모으기보다 쓰는 데서 보람을 찾는 편이니, 자동으로 모이는 장치를 두면 좋습니다. ')
      + (has('mercury') ? '수성선이 있어 장사 수완과 셈도 밝습니다.' : '') });
    rows.push({ tag: '일·적성', text:
      `${TRAIT_JOB[a.id]}에서 실력이 납니다. ` + (f.headSlope >= 0.6 ? '두뇌선이 처져 있어 정해진 절차보다 아이디어를 내는 자리에서 빛납니다. ' : f.headSlope <= 0.25 ? '두뇌선이 곧아 기준과 숫자가 분명한 자리에서 믿음을 얻습니다. ' : '')
      + (L.fate && L.fate.found && L.fate.len >= 0.6 ? '한 분야를 오래 파면 이름이 납니다.' : '한 가지에 묶이기보다 경험을 넓히다 보면 자리가 잡힙니다.') });
    return rows;
  }

  return { read, features, traitScores, pickCar, lineSummary, lineMeaning, overall, extras, personalColor, reading, bonus };
})();
