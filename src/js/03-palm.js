'use strict';
/* ============================================================
 * 03. 손금 판독 엔진 (기기 안에서만 동작, 사진은 어디로도 전송하지 않음)
 *
 * 입력: 가이드 상자를 그대로 잘라낸 600×840 캔버스 (엄지가 오른쪽인 기준 방향)
 * 과정:
 *   1) 손바닥 한가운데에서 피부색 표본을 뜨고, 밝기를 확인한다.
 *   2) 가이드 안쪽이 피부로 채워졌는지, 가이드 바깥이 배경인지 확인한다.
 *   3) 손바닥 영역의 조명을 고르게 편 뒤, 어두운 골(주름)에 반응하는 필터(헤시안)를 건다.
 *   4) 수상학의 4대 주요선(생명선·감정선·두뇌선·운명선)이 지나는 구역마다
 *      가장 또렷하게 이어지는 길을 동적계획법으로 찾는다.
 *   5) 선마다 길이·깊이·휘어짐·끊김을 잰다. 주요선이 2개 이상 또렷하지 않으면 다시 찍게 한다.
 *   6) 보조선(태양선·수성선·이중 생명선·결혼선·여행선·재물선), 특별한 손금(M자·막쥔손금),
 *      구(丘)의 혈색, 손 모양(손가락 길이·엄지 각도·검지와 약지)도 함께 읽는다.
 * ============================================================ */

const PalmReader = (function () {
  const S = 2;                                  // 가이드 1단위 = 2픽셀
  const W = HAND.W * S, H = HAND.H * S;         // 600 × 840
  const PB = {
    x: HAND.palmBox.x * S, y: HAND.palmBox.y * S,
    w: HAND.palmBox.w * S, h: HAND.palmBox.h * S,
  };
  const PW = PB.w, PH = PB.h;                   // 356 × 444
  const DEG = Math.PI / 180;

  /* ---------- 작은 도구들 ---------- */
  function median(arr) {
    const a = Float32Array.from(arr).sort();
    return a.length ? a[a.length >> 1] : 0;
  }
  function quantile(arr, q) {
    const a = Float32Array.from(arr).sort();
    return a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))] : 0;
  }
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  function integral(m, w, h) {
    const I = new Int32Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      const o = (y + 1) * (w + 1), p = y * (w + 1);
      for (let x = 0; x < w; x++) {
        row += m[y * w + x];
        I[o + x + 1] = I[p + x + 1] + row;
      }
    }
    return I;
  }
  function boxCount(I, w, h, x, y, r) {
    const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r);
    const x1 = Math.min(w, x + r + 1), y1 = Math.min(h, y + r + 1);
    const W1 = w + 1;
    return I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
  }
  function erode(m, w, h, r) {
    const I = integral(m, w, h), out = new Uint8Array(w * h), full = (2 * r + 1) * (2 * r + 1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (m[y * w + x] && boxCount(I, w, h, x, y, r) === full) out[y * w + x] = 1;
    }
    return out;
  }
  function dilate(m, w, h, r) {
    const I = integral(m, w, h), out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (boxCount(I, w, h, x, y, r) > 0) out[y * w + x] = 1;
    }
    return out;
  }

  /* 상자 흐림 (가로·세로 분리, 가장자리는 가까운 값으로 채움) */
  function boxBlur(src, w, h, r) {
    const tmp = new Float32Array(w * h), dst = new Float32Array(w * h);
    const n = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let s = 0;
      for (let k = -r; k <= r; k++) s += src[o + Math.min(w - 1, Math.max(0, k))];
      for (let x = 0; x < w; x++) {
        tmp[o + x] = s / n;
        s += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (let y = 0; y < h; y++) {
        dst[y * w + x] = s / n;
        s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    return dst;
  }

  function gaussBlur(src, w, h, sigma) {
    const r = Math.ceil(sigma * 3), k = new Float32Array(2 * r + 1);
    let sum = 0;
    for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); sum += k[i + r]; }
    for (let i = 0; i < k.length; i++) k[i] /= sum;
    const tmp = new Float32Array(w * h), dst = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let i = -r; i <= r; i++) s += k[i + r] * src[o + Math.min(w - 1, Math.max(0, x + i))];
        tmp[o + x] = s;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let i = -r; i <= r; i++) s += k[i + r] * tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x];
        dst[y * w + x] = s;
      }
    }
    return dst;
  }

  /* ---------- 가이드 도형 마스크 (한 번만 만든다) ---------- */
  let _shape = null;
  function shapeMasks() {
    if (_shape) return _shape;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.scale(S, S);
    g.fillStyle = '#fff';
    fillHandShape(g, 0);
    const d = g.getImageData(0, 0, W, H).data;
    const m = new Uint8Array(W * H);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    _shape = {
      m,
      inner: erode(m, W, H, 5 * S),     // 가이드보다 5단위 안쪽
      outer: dilate(m, W, H, 18 * S),   // 가이드보다 18단위 바깥까지
    };
    return _shape;
  }

  /* ---------- 가장 또렷한 길 찾기 (동적계획법) ---------- */
  // val[i*M+j] : i번째 걸음에서 j번째 자리를 지날 때의 선명도. 한 걸음에 maxJump 칸까지 옮겨갈 수 있다.
  function dpTrace(N, M, val, maxJump, penalty, startOk) {
    const NEG = -1e9;
    const score = new Float32Array(N * M), back = new Int16Array(N * M);
    for (let j = 0; j < M; j++) score[j] = (!startOk || startOk(j)) ? val[j] : NEG;
    for (let i = 1; i < N; i++) {
      const o = i * M, p = (i - 1) * M;
      for (let j = 0; j < M; j++) {
        let best = NEG, bj = j;
        const lo = Math.max(0, j - maxJump), hi = Math.min(M - 1, j + maxJump);
        for (let k = lo; k <= hi; k++) {
          const s = score[p + k] - penalty * Math.abs(k - j);
          if (s > best) { best = s; bj = k; }
        }
        score[o + j] = best + val[o + j];
        back[o + j] = bj;
      }
    }
    let bj = 0, best = NEG;
    for (let j = 0; j < M; j++) if (score[(N - 1) * M + j] > best) { best = score[(N - 1) * M + j]; bj = j; }
    const js = new Int16Array(N), vs = new Float32Array(N);
    for (let i = N - 1; i >= 0; i--) {
      js[i] = bj;
      vs[i] = val[i * M + bj];
      bj = back[i * M + bj];
    }
    return { js, vs };
  }

  /* 길 위에서 "선이 실제로 보이는 구간"을 고른다 */
  function extent(vs, thr, maxGapFrac) {
    const N = vs.length, sm = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let s = 0, c = 0;
      for (let k = -3; k <= 3; k++) { const t = i + k; if (t >= 0 && t < N) { s += Math.max(0, vs[t]); c++; } }
      sm[i] = s / c;
    }
    const maxGap = Math.max(2, Math.round(N * maxGapFrac));
    const runs = [];
    let st = -1;
    for (let i = 0; i <= N; i++) {
      const on = i < N && sm[i] >= thr;
      if (on && st < 0) st = i;
      if (!on && st >= 0) { runs.push([st, i - 1]); st = -1; }
    }
    if (!runs.length) return { i0: 0, i1: 0, len: 0, mean: 0, breaks: 0, sm };
    const merged = [];
    let cur = { i0: runs[0][0], i1: runs[0][1], breaks: 0 };
    for (let k = 1; k < runs.length; k++) {
      const gap = runs[k][0] - cur.i1 - 1;
      if (gap <= maxGap) { cur.i1 = runs[k][1]; if (gap >= 3) cur.breaks++; }
      else { merged.push(cur); cur = { i0: runs[k][0], i1: runs[k][1], breaks: 0 }; }
    }
    merged.push(cur);
    let best = null, bestSum = -1;
    for (const m of merged) {
      let s = 0;
      for (let i = m.i0; i <= m.i1; i++) s += sm[i];
      if (s > bestSum) { bestSum = s; best = m; }
    }
    const n = best.i1 - best.i0 + 1;
    return { i0: best.i0, i1: best.i1, len: n / N, mean: bestSum / n, breaks: best.breaks, sm };
  }

  /* ---------- 본 분석 ---------- */
  /* opt.palmOnly: 손바닥만 틀에 맞춰 찍은 사진. 손가락·엄지가 화면 밖일 수 있으므로 손바닥 부분만으로 정렬을 본다. */
  function analyze(srcCanvas, opt) {
    const palmOnly = !!(opt && opt.palmOnly);
    // relax: 실제 사진은 피부 결(잔주름·모공) 때문에 잡음 바닥이 높아 선이 묻히기 쉽다. 엄격한 기준으로 못 읽으면 기준을 낮춰 한 번 더 본다.
    const relax = !!(opt && opt.relax);
    const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, W, H).data;
    const shape = shapeMasks();
    const q = {};
    const fail = (reason) => ({ ok: false, reason, quality: q });

    /* 1) 피부색 표본 + 밝기 */
    const cx = HAND.center.x * S, cy = HAND.center.y * S, cr = HAND.center.r * S;
    const Ys = [], Cbs = [], Crs = [];
    for (let y = cy - cr; y <= cy + cr; y += 2) for (let x = cx - cr; x <= cx + cr; x += 2) {
      const i = (y * W + x) * 4, r = img[i], g = img[i + 1], b = img[i + 2];
      Ys.push(0.299 * r + 0.587 * g + 0.114 * b);
      Cbs.push(128 - 0.168736 * r - 0.331264 * g + 0.5 * b);
      Crs.push(128 + 0.5 * r - 0.418688 * g - 0.081312 * b);
    }
    const Y0 = median(Ys), Cb0 = median(Cbs), Cr0 = median(Crs);
    q.brightness = Math.round(Y0);
    q.skin = [Y0 + 1.402 * (Cr0 - 128), Y0 - 0.344136 * (Cb0 - 128) - 0.714136 * (Cr0 - 128), Y0 + 1.772 * (Cb0 - 128)]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))));        // 손바닥 한가운데의 피부색 (퍼스널컬러용)
    if (Y0 < 48) return fail('too_dark');
    if (Y0 > 242) return fail('too_bright');
    const skinLike = (Cr0 - Cb0 >= 10) && Cr0 >= 128 && Cr0 <= 194 && Cb0 >= 60 && Cb0 <= 134;

    /* 2) 가이드와 손이 맞았는지 */
    const skin = new Uint8Array(W * H);
    const tC = palmOnly ? 21 : 17, yMin = 0.35 * Y0;
    for (let p = 0, i = 0; p < W * H; p++, i += 4) {
      const r = img[i], g = img[i + 1], b = img[i + 2];
      const Y = 0.299 * r + 0.587 * g + 0.114 * b;
      if (Y < yMin) continue;
      const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      if (Math.abs(Cb - Cb0) <= tC && Math.abs(Cr - Cr0) <= tC) skin[p] = 1;
    }
    let inN = 0, inS = 0, fN = 0, fS = 0, oN = 0, oS = 0, tN = 0, tS = 0;
    const fingerLimit = 196 * S, thumbLimit = 240 * S;      // 엄지는 손바닥 오른쪽 바깥으로 나온 부분
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (shape.inner[p]) {
        if (!palmOnly || (y >= fingerLimit && x < thumbLimit)) { inN++; inS += skin[p]; }
        if (y < fingerLimit) { fN++; fS += skin[p]; }
        if (x >= thumbLimit) { tN++; tS += skin[p]; }
      } else if (!shape.outer[p]) { oN++; oS += skin[p]; }
    }
    q.inside = +(inS / inN).toFixed(3);
    q.fingers = +(fS / fN).toFixed(3);
    q.thumb = +(tS / Math.max(1, tN)).toFixed(3);
    q.outside = +(oS / Math.max(1, oN)).toFixed(3);
    q.palmOnly = palmOnly;
    if (!skinLike || q.inside < (palmOnly ? 0.6 : 0.55)) return fail('no_hand');
    if (!palmOnly) {
      if (q.thumb < 0.25) return fail('thumb');
      if (q.fingers < 0.3) return fail('misaligned');
      if (q.outside > 0.72) return fail('background');
    }

    /* 3) 손바닥 영역: 조명 고르기 + 골(주름) 필터 */
    const n = PW * PH;
    const gray = new Float32Array(n), mask = new Uint8Array(n), red = new Float32Array(n);
    const skinI = integral(skin, W, H);
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const X = PB.x + x, Yy = PB.y + y, p = Yy * W + X, i = p * 4;
      gray[y * PW + x] = 0.25 * img[i] + 0.65 * img[i + 1] + 0.10 * img[i + 2];
      red[y * PW + x] = 0.668736 * img[i] - 0.087424 * img[i + 1] - 0.581312 * img[i + 2];     // 붉은 기 (Cr - Cb)
      if (shape.inner[p]) {
        const dense = boxCount(skinI, W, H, X, Yy, 8) / 289;
        if (dense >= 0.55) mask[y * PW + x] = 1;
      }
    }
    const maskE = erode(mask, PW, PH, 3);
    const mf = new Float32Array(n), gm = new Float32Array(n);
    for (let i = 0; i < n; i++) { mf[i] = mask[i]; gm[i] = gray[i] * mask[i]; }
    let bgN = boxBlur(boxBlur(gm, PW, PH, 16), PW, PH, 16);
    let bgD = boxBlur(boxBlur(mf, PW, PH, 16), PW, PH, 16);
    const gn = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      gn[i] = mask[i] && bgD[i] > 0.05 ? 128 * gray[i] / Math.max(1, bgN[i] / bgD[i]) : 128;
    }
    bgN = bgD = null;

    const lam = new Float32Array(n), th = new Float32Array(n);
    for (const sigma of [1.5, 2.6, 3.8]) {      // 큰 척도까지 보면 굵은 손금은 살고 잔주름은 묻힌다
      const b = gaussBlur(gn, PW, PH, sigma), s2 = sigma * sigma;
      for (let y = 1; y < PH - 1; y++) for (let x = 1; x < PW - 1; x++) {
        const i = y * PW + x;
        if (!maskE[i]) continue;
        const a = (b[i + 1] - 2 * b[i] + b[i - 1]) * s2;
        const d = (b[i + PW] - 2 * b[i] + b[i - PW]) * s2;
        const c = (b[i + PW + 1] - b[i + PW - 1] - b[i - PW + 1] + b[i - PW - 1]) * 0.25 * s2;
        const l1 = (a + d) / 2 + Math.sqrt(((a - d) / 2) * ((a - d) / 2) + c * c);
        if (l1 > lam[i]) { lam[i] = l1; th[i] = 0.5 * Math.atan2(2 * c, a - d); }
      }
    }
    // 잡음 바닥과 "선이 보인다"의 기준
    const sample = [];
    for (let i = 0; i < n; i += 7) if (maskE[i]) sample.push(lam[i]);
    if (sample.length < 400) return fail('no_hand');
    const p50 = quantile(sample, 0.5), p85 = quantile(sample, 0.85);
    const thr = relax ? Math.min(2.6, Math.max(0.75, 1.12 * p85)) : Math.min(3.2, Math.max(0.9, 1.5 * p85));
    q.relaxed = relax;
    q.noise = +p85.toFixed(2);
    q.thr = +thr.toFixed(2);

    const R = (x, y, nu) => {
      if (x < 1 || y < 1 || x >= PW - 1 || y >= PH - 1) return 0;
      const i = y * PW + x, l = lam[i];
      if (l <= 0) return 0;
      const g = Math.cos(2 * (th[i] - nu));
      return g > 0 ? l * g : 0;
    };
    const pen = 0.12 * thr;
    const toGuide = (x, y) => [+(HAND.palmBox.x + x / S).toFixed(1), +(HAND.palmBox.y + y / S).toFixed(1)];
    const contrast = (mean) => mean / 0.354 / 128;      // 골 깊이를 주변 대비 어두운 비율로 환산

    /* 4-1) 생명선: 엄지 두덩(금성구)을 감싸는 호.
     * 나란한 호가 두 줄이면 바깥쪽이 생명선, 안쪽이 이중 생명선(화성선)이다. */
    const ARC = { Cx: (214 - HAND.palmBox.x) * S, Cy: (332 - HAND.palmBox.y) * S, r0: 30, M: 176, N: 240, phi0: -10 * DEG, dphi: (180 * DEG) / 240 };
    const traceArc = (allow, gapFrac) => {       // allow(i, r): 그 각도에서 그 반지름을 지나도 되는지
      const { Cx, Cy, r0, M, N, phi0, dphi } = ARC;
      const val = new Float32Array(N * M), xs = new Int16Array(N * M), ys = new Int16Array(N * M);
      for (let i = 0; i < N; i++) {
        const phi = phi0 + i * dphi, sn = Math.sin(phi), cs = Math.cos(phi), nu = Math.atan2(-cs, -sn);
        for (let j = 0; j < M; j++) {
          const r = r0 + j, x = Math.round(Cx - r * sn), y = Math.round(Cy - r * cs);
          xs[i * M + j] = x; ys[i * M + j] = y;
          val[i * M + j] = allow(i, r) ? R(x, y, nu) : -4 * thr;
        }
      }
      const tr = dpTrace(N, M, val, 2, pen), ex = extent(tr.vs, thr, gapFrac), pts = [], rs = new Int16Array(N).fill(-1);
      let minX = PW;
      for (let i = ex.i0; i <= ex.i1; i++) {
        const x = xs[i * M + tr.js[i]], y = ys[i * M + tr.js[i]];
        pts.push([x, y]);
        rs[i] = r0 + tr.js[i];
        if (x < minX) minX = x;
      }
      return { len: ex.len, mean: ex.mean, breaks: ex.breaks, reach: 1 - minX / PW, raw: pts, rs };
    };
    const strongArc = (a) => a.len >= 0.3 && a.mean >= 1.8 * thr && a.breaks <= 1;
    let life = traceArc((i, r) => r >= 56, 0.07), mars = { found: false, len: 0, mean: 0, breaks: 0, raw: [] };
    life.found = life.len >= 0.3 && life.mean >= 1.2 * thr;
    if (life.found) {
      const first = life;
      const mid = (i) => i * ARC.dphi + ARC.phi0 > 15 * DEG && i * ARC.dphi + ARC.phi0 < 150 * DEG;
      const outer = traceArc((i, r) => first.rs[i] >= 0 && mid(i) && r >= first.rs[i] + 11, 0.05);
      if (strongArc(outer) && outer.mean >= 0.6 * first.mean) {
        // 바깥에도 또렷한 호가 있으면 그쪽이 생명선이고, 처음 찾은 안쪽 호가 이중 생명선
        life = traceArc((i, r) => r >= 56 && (first.rs[i] < 0 || r >= first.rs[i] + 6), 0.07);
        life.found = life.len >= 0.3 && life.mean >= 1.2 * thr;
        if (life.found) mars = Object.assign({}, first, { found: true }); else life = first;
      } else {
        const inner = traceArc((i, r) => first.rs[i] >= 0 && mid(i) && r <= first.rs[i] - 11, 0.05);
        mars = Object.assign(inner, { found: strongArc(inner) });
      }
    }

    // 다른 선이 생명선을 따라가지 않도록 생명선 주변을 표시
    const nearLife = new Uint8Array(n), lifeMinX = new Int16Array(PH).fill(-1);
    if (life.found) {
      for (const [x, y] of life.raw) {
        for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
          const X = x + dx, Yy = y + dy;
          if (X >= 0 && Yy >= 0 && X < PW && Yy < PH) nearLife[Yy * PW + X] = 1;
        }
        if (y >= 0 && y < PH && (lifeMinX[y] < 0 || x < lifeMinX[y])) lifeMinX[y] = x;
      }
    }

    /* 4-2) 감정선: 새끼손가락 아래에서 검지 쪽으로 */
    const heart = (() => {
      const x0 = 8, step = 2, N = Math.floor((0.80 * PW - x0) / step), y0 = Math.round(0.04 * PH), M = Math.round(0.38 * PH);
      const nu = 82 * DEG;
      const val = new Float32Array(N * M);
      for (let i = 0; i < N; i++) {
        const x = x0 + i * step, u = x / PW, vmax = 0.42 - 0.14 * u;
        for (let j = 0; j < M; j++) {
          const y = y0 + j;
          val[i * M + j] = y / PH <= vmax ? R(x, y, nu) : -4 * thr;
        }
      }
      // 감정선은 손날 쪽이 가장 낮고 검지 쪽으로 갈수록 올라간다. 시작 부분이 더 위에 있다가 내려와 합쳐지면
      // 그 앞부분은 결혼선을 따라간 것이다. 그 자리를 지우고 한 번 더 찾아 진짜 시작점을 잡는다.
      let tr, ex, pts;
      for (let pass = 0; pass < 4; pass++) {
        tr = dpTrace(N, M, val, 2, pen);
        ex = extent(tr.vs, thr, 0.07);
        pts = [];
        for (let i = ex.i0; i <= ex.i1; i++) pts.push([x0 + i * step, y0 + tr.js[i]]);
        let iLow = 0;
        for (let i = 1; i < pts.length && pts[i][0] < 0.3 * PW; i++) if (pts[i][1] > pts[iLow][1]) iLow = i;
        if (!(iLow > 2 && pts.length - iLow > 10 && pts[iLow][1] - pts[0][1] >= 0.025 * PH)) break;
        if (pass === 3) { pts.splice(0, iLow); break; }
        for (let t = 0; t < iLow; t++) {
          const i = ex.i0 + t, j = tr.js[i];
          for (let d = -5; d <= 5; d++) if (j + d >= 0 && j + d < M && val[i * M + j + d] > 0) val[i * M + j + d] = 0;
        }
      }
      const k = Math.max(1, Math.round(pts.length * 0.15));
      const avgY = (a) => a.reduce((s, p) => s + p[1], 0) / a.length;
      const yS = pts.length ? avgY(pts.slice(0, k)) : 0, yE = pts.length ? avgY(pts.slice(-k)) : 0;
      return {
        found: ex.len >= 0.3 && ex.mean >= 1.2 * thr,
        len: pts.length ? (pts[pts.length - 1][0] - pts[0][0]) / PW : 0,
        endU: pts.length ? pts[pts.length - 1][0] / PW : 0,
        rise: (yS - yE) / PH,              // 끝이 손가락 쪽으로 얼마나 올라가는지
        mean: ex.mean, breaks: ex.breaks, raw: pts,
      };
    })();
    const heartY = new Int16Array(PW).fill(-1);
    if (heart.found) {
      for (const [x, y] of heart.raw) { heartY[x] = y; if (x + 1 < PW) heartY[x + 1] = y; }
    }

    /* 4-3) 두뇌선: 엄지와 검지 사이에서 손날 쪽으로 */
    const head = (() => {
      const x0 = Math.round(0.97 * PW), step = 2, N = Math.floor((x0 - 0.06 * PW) / step);
      const y0 = Math.round(0.20 * PH), M = Math.round(0.64 * PH), nu = 68 * DEG;
      const margin = Math.round(0.055 * PH), lifeCut = 0.82 * PW;
      const val = new Float32Array(N * M);
      for (let i = 0; i < N; i++) {
        const x = x0 - i * step, u = x / PW, vmax = 0.47 + 0.40 * (1 - u);
        for (let j = 0; j < M; j++) {
          const y = y0 + j;
          let v;
          if (y / PH > vmax) v = -4 * thr;
          else if (heartY[x] >= 0 && y < heartY[x] + margin) v = -4 * thr;
          else if (x < lifeCut && nearLife[y * PW + x]) v = 0;
          else v = R(x, y, nu);
          val[i * M + j] = v;
        }
      }
      const startMax = Math.round(0.44 * PH) - y0;
      const tr = dpTrace(N, M, val, 2, pen, (j) => j <= startMax);
      const ex = extent(tr.vs, thr, 0.07);
      const pts = [];
      for (let i = ex.i0; i <= ex.i1; i++) pts.push([x0 - i * step, y0 + tr.js[i]]);
      let len = 0, drop = 0, slopeDeg = 0, bend = 0, gap = null;
      if (pts.length > 4) {
        const a = pts[0], b = pts[pts.length - 1];
        // 시작점이 생명선에서 갈라져 나오는지(붙어 있음), 따로 출발하는지
        let startX = a[0];
        if (life.found) {
          let dmin = 1e9;
          for (const p of life.raw) { const dd = Math.hypot(p[0] - a[0], p[1] - a[1]); if (dd < dmin) dmin = dd; }
          gap = dmin / PH;
          if (dmin <= 16) startX = Math.max(a[0], life.raw[0][0]);   // 붙어 있으면 공통 출발점부터 잰다
        }
        len = (startX - b[0]) / PW;
        drop = (b[1] - a[1]) / PH;
        slopeDeg = Math.atan2(b[1] - a[1], a[0] - b[0]) / DEG;
        // 곧은 정도: 시작-끝을 이은 직선에서 벗어난 평균 거리
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        let s = 0;
        for (const p of pts) s += Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / L;
        bend = s / pts.length / L;
      }
      return {
        found: ex.len >= 0.26 && ex.mean >= 1.2 * thr,
        len, drop, slopeDeg, bend, gap, mean: ex.mean, breaks: ex.breaks, raw: pts,
      };
    })();

    /* 4-4) 운명선: 손목에서 중지 쪽으로 오르는 세로선 (없는 사람도 많다) */
    const fate = (() => {
      const yStart = Math.round(0.96 * PH), step = 2, N = Math.floor((yStart - 0.22 * PH) / step);
      const x0 = Math.round(0.30 * PW), M = Math.round(0.38 * PW), nu = 0;
      const val = new Float32Array(N * M);
      for (let i = 0; i < N; i++) {
        const y = yStart - i * step;
        for (let j = 0; j < M; j++) {
          const x = x0 + j;
          let v;
          if (nearLife[y * PW + x] || (lifeMinX[y] >= 0 && x > lifeMinX[y] - 10)) v = -4 * thr;
          else v = R(x, y, nu);
          val[i * M + j] = v;
        }
      }
      const tr = dpTrace(N, M, val, 1, pen);
      const ex = extent(tr.vs, thr, 0.06);
      const pts = [];
      for (let i = ex.i0; i <= ex.i1; i++) pts.push([x0 + tr.js[i], yStart - i * step]);
      return {
        found: ex.len >= 0.3 && ex.mean >= 1.25 * thr,
        len: ex.len, mean: ex.mean, breaks: ex.breaks, raw: pts,
      };
    })();

    /* ---------- 보조선 ---------- */
    const stamp = (pts, r) => {
      const m = new Uint8Array(n);
      for (const [x, y] of pts) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const X = x + dx, Yy = y + dy;
        if (X >= 0 && Yy >= 0 && X < PW && Yy < PH) m[Yy * PW + X] = 1;
      }
      return m;
    };
    const none = { found: false, len: 0, mean: 0, breaks: 0, raw: [] };
    const nearFate = fate.found ? stamp(fate.raw, 7) : new Uint8Array(n);

    /* 4-6) 태양선: 약지 아래로 오르는 세로선 */
    const sun = (() => {
      const yStart = Math.round(0.64 * PH), step = 2, N = Math.floor((yStart - 0.10 * PH) / step);
      const x0 = Math.round(0.14 * PW), M = Math.round(0.27 * PW);
      const val = new Float32Array(N * M);
      for (let i = 0; i < N; i++) {
        const y = yStart - i * step;
        for (let j = 0; j < M; j++) {
          const x = x0 + j, p = y * PW + x;
          val[i * M + j] = nearLife[p] || nearFate[p] ? -4 * thr : R(x, y, 0);
        }
      }
      const tr = dpTrace(N, M, val, 1, pen), ex = extent(tr.vs, thr, 0.06), pts = [];
      for (let i = ex.i0; i <= ex.i1; i++) pts.push([x0 + tr.js[i], yStart - i * step]);
      const span = pts.length ? (pts[0][1] - pts[pts.length - 1][1]) / PH : 0;
      // 태양선은 거의 수직이어야 한다(비스듬하면 수성선을 따라간 것)
      const lean = pts.length > 4 ? Math.abs(pts[0][0] - pts[pts.length - 1][0]) / Math.max(1, pts[0][1] - pts[pts.length - 1][1]) : 9;
      return { found: ex.len >= 0.28 && ex.mean >= 1.4 * thr && lean <= 0.22, len: span, mean: ex.mean, breaks: ex.breaks, raw: pts };
    })();
    const nearSun = sun.found ? stamp(sun.raw, 7) : new Uint8Array(n);

    /* 4-7) 수성선(사업선·건강선): 손바닥 아래에서 새끼손가락 쪽으로 비스듬히 오르는 선 */
    const mercury = (() => {
      const yStart = Math.round(0.88 * PH), yEnd = 0.22 * PH, step = 2, N = Math.floor((yStart - yEnd) / step);
      const half = Math.round(0.085 * PW), M = 2 * half + 1, nu = 158.7 * DEG;
      const val = new Float32Array(N * M), cx = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const y = yStart - i * step;
        cx[i] = (0.46 + (0.14 - 0.46) * (i / (N - 1))) * PW;
        for (let j = 0; j < M; j++) {
          const x = Math.round(cx[i] - half + j), p = y * PW + x;
          val[i * M + j] = x < 1 || x >= PW - 1 || nearLife[p] || nearFate[p] || nearSun[p] ? -4 * thr : R(x, y, nu);
        }
      }
      const tr = dpTrace(N, M, val, 1, pen), ex = extent(tr.vs, thr, 0.06), pts = [];
      for (let i = ex.i0; i <= ex.i1; i++) pts.push([Math.round(cx[i] - half + tr.js[i]), yStart - i * step]);
      const span = pts.length ? (pts[0][1] - pts[pts.length - 1][1]) / PH : 0;
      // 수성선은 위로 갈수록 새끼손가락 쪽으로 기울어야 한다(수직이면 태양선·운명선을 따라간 것)
      const lean = pts.length > 4 ? (pts[0][0] - pts[pts.length - 1][0]) / Math.max(1, pts[0][1] - pts[pts.length - 1][1]) : 0;
      return { found: ex.len >= 0.3 && ex.mean >= 1.4 * thr && lean >= 0.2 && lean <= 0.75, len: span, mean: ex.mean, breaks: ex.breaks, raw: pts };
    })();

    /* 4-8) 짧은 선 세기: 결혼선·여행선(손날 쪽 가로선), 재물선(새끼손가락 아래 세로선) */
    const countShort = (u0, u1, v0, v1, horizontal, minRun) => {
      const xa = Math.round(u0 * PW), xb = Math.round(u1 * PW), ya = Math.round(v0 * PH), yb = Math.round(v1 * PH);
      const nu = horizontal ? 90 * DEG : 0, hits = [];
      const probe = (a, b) => {          // a = 선과 나란한 방향의 좌표, b = 선을 가로지르는 방향의 좌표
        let best = 0;
        for (let d = -1; d <= 1; d++) best = Math.max(best, horizontal ? R(a, b + d, nu) : R(b + d, a, nu));
        return best;
      };
      const [a0, a1, b0, b1] = horizontal ? [xa, xb, ya, yb] : [ya, yb, xa, xb];
      for (let b = b0; b <= b1; b++) {
        let run = 0, gap = 0, longest = 0;
        for (let a = a0; a <= a1; a++) {
          if (probe(a, b) >= 1.5 * thr) { run += gap + 1; gap = 0; if (run > longest) longest = run; }
          else if (run && gap < 2) gap++;
          else { run = 0; gap = 0; }
        }
        if (longest >= minRun) hits.push(b);
      }
      const where = [];
      let last = -99;
      for (const b of hits) { if (b - last > 5) where.push(b); last = b; }
      return { count: where.length, where };
    };
    const heartTop = (() => {         // 손날 쪽에서 감정선이 지나는 높이
      if (!heart.found || !heart.raw.length) return 0.25;
      const ys = heart.raw.filter((p) => p[0] <= 0.3 * PW).map((p) => p[1]);
      return (ys.length ? median(ys) : heart.raw[0][1]) / PH;
    })();
    const marriage = heartTop - 0.03 > 0.15 ? countShort(0.07, 0.26, 0.15, heartTop - 0.03, true, Math.round(0.07 * PW)) : { count: 0, where: [] };
    const travel = countShort(0.05, 0.26, 0.58, 0.90, true, Math.round(0.08 * PW));
    const money = heartTop - 0.02 > 0.14 ? countShort(0.07, 0.24, 0.14, heartTop - 0.02, false, Math.round(0.055 * PH)) : { count: 0, where: [] };

    /* 4-9) 특별한 손금 */
    const special = { m: false, simian: false };
    if (life.found && head.found && heart.found && fate.found && fate.len >= 0.45 && fate.raw.length && head.raw.length) {
      const top = fate.raw[fate.raw.length - 1];         // 운명선이 가장 높이 올라간 지점
      let hy = -1, dmin = 1e9;
      for (const p of head.raw) { const d = Math.abs(p[0] - top[0]); if (d < dmin) { dmin = d; hy = p[1]; } }
      if (dmin <= 12 && top[1] < hy - 0.04 * PH) special.m = true;      // 운명선이 두뇌선을 뚫고 올라가면 M자
    }
    if (heart.found && heart.len >= 0.72 && heart.raw.length) {
      const meanV = heart.raw.reduce((a, p) => a + p[1], 0) / heart.raw.length / PH;
      if (meanV >= 0.27 && Math.abs(heart.rise) < 0.08 && (!head.found || (head.len < 0.4 && head.mean < 0.6 * heart.mean))) special.simian = true;
    }

    /* 4-10) 구(丘): 볼록함은 사진으로 잴 수 없어, 주변보다 붉은 기가 도는 정도(혈색)로 가늠한다 */
    const mounts = (() => {
      let sum = 0, sq = 0, cnt = 0;
      for (let i = 0; i < n; i += 3) if (maskE[i]) { sum += red[i]; sq += red[i] * red[i]; cnt++; }
      const mean = sum / Math.max(1, cnt), sd = Math.sqrt(Math.max(1e-6, sq / Math.max(1, cnt) - mean * mean));
      const box = {
        jupiter: [0.66, 0.92, 0.10, 0.24], saturn: [0.44, 0.64, 0.08, 0.20], apollo: [0.24, 0.44, 0.08, 0.20],
        mercury: [0.07, 0.24, 0.10, 0.22], venus: [0.62, 0.92, 0.50, 0.84], luna: [0.07, 0.32, 0.58, 0.90],
      };
      const z = {};
      for (const id of Object.keys(box)) {
        const [u0, u1, v0, v1] = box[id];
        let s2 = 0, c2 = 0;
        for (let y = Math.round(v0 * PH); y < v1 * PH; y += 2) for (let x = Math.round(u0 * PW); x < u1 * PW; x += 2) {
          const i = y * PW + x;
          if (maskE[i]) { s2 += red[i]; c2++; }
        }
        z[id] = c2 > 60 ? +((s2 / c2 - mean) / sd).toFixed(2) : null;
      }
      const order = Object.keys(z).filter((k) => z[k] != null).sort((a, b) => z[b] - z[a]);
      return { z, order };
    })();

    /* 5) 판독 가능 여부 */
    const majors = [life, heart, head].filter((l) => l.found).length;
    q.majors = majors;
    const pack = (l, extra) => Object.assign({
      found: l.found,
      depth: +contrast(l.mean).toFixed(3),
      breaks: l.breaks,
      pts: l.found ? l.raw.filter((_, i) => i % 3 === 0 || i === l.raw.length - 1).map((p) => toGuide(p[0], p[1])) : [],
    }, extra);
    const lines = {
      life: pack(life, { len: +life.len.toFixed(3), reach: +life.reach.toFixed(3) }),
      heart: pack(heart, { len: +heart.len.toFixed(3), endU: +heart.endU.toFixed(3), rise: +heart.rise.toFixed(3) }),
      head: pack(head, {
        len: +head.len.toFixed(3), drop: +head.drop.toFixed(3), slopeDeg: +head.slopeDeg.toFixed(1),
        bend: +head.bend.toFixed(4), gap: head.gap == null ? null : +head.gap.toFixed(3),
      }),
      fate: pack(fate, { len: +fate.len.toFixed(3) }),
      sun: pack(sun, { len: +sun.len.toFixed(3) }),
      mercury: pack(mercury, { len: +mercury.len.toFixed(3) }),
      mars: pack(mars, { len: +mars.len.toFixed(3) }),
    };
    if (majors < 2) return { ok: false, reason: 'faint', quality: q, lines };
    const gy = (y) => +(HAND.palmBox.y + y / S).toFixed(1), gx = (x) => +(HAND.palmBox.x + x / S).toFixed(1);
    const marks = {
      marriage: { count: marriage.count, at: marriage.where.map(gy) },
      travel: { count: travel.count, at: travel.where.map(gy) },
      money: { count: money.count, at: money.where.map(gx) },
    };

    const found = [life, heart, head, fate].filter((l) => l.found);
    q.clarity = Math.round(100 * clamp01((found.reduce((s, l) => s + contrast(l.mean), 0) / found.length - 0.02) / 0.12));
    return { ok: true, quality: q, lines, marks, special, mounts, shape: null };      // 손가락은 읽지 않는다(손바닥만)
  }

  /* 손 모양: 손가락 끝 네 곳과 엄지 끝을 찾아 손가락 길이, 검지·약지 차이, 엄지 각도를 잰다.
   * 손가락이 붙어 있어 끝을 못 찾으면 null */
  function handShape(skin) {
    const x0 = 30 * S, x1 = 236 * S, yMax = 200 * S, nx = x1 - x0;
    const top = new Float32Array(nx);
    for (let x = x0; x < x1; x++) {
      let t = yMax;
      for (let y = 2; y < yMax; y++) if (skin[y * W + x] && skin[(y + 2) * W + x] && skin[(y + 4) * W + x]) { t = y; break; }
      top[x - x0] = t;
    }
    const sm = new Float32Array(nx);
    for (let i = 0; i < nx; i++) {
      let s = 0, c = 0;
      for (let k = -4; k <= 4; k++) { const t = i + k; if (t >= 0 && t < nx) { s += top[t]; c++; } }
      sm[i] = s / c;
    }
    const cand = [];
    for (let i = 6; i < nx - 6; i++) {
      if (sm[i] >= yMax - 20 * S) continue;
      let isMin = true;
      for (let k = -12; k <= 12 && isMin; k++) { const t = i + k; if (t >= 0 && t < nx && sm[t] < sm[i]) isMin = false; }
      if (isMin) cand.push({ x: i + x0, y: sm[i] });
    }
    cand.sort((a, b) => a.y - b.y);
    const tips = [];
    for (const c of cand) if (tips.every((t) => Math.abs(t.x - c.x) >= 22 * S)) tips.push(c);
    if (tips.length < 4) return null;
    const four = tips.slice(0, 4).sort((a, b) => a.x - b.x), ring = four[1], middle = four[2], index = four[3];
    const web = (a, b) => {
      const xm = Math.round((a.x + b.x) / 2);
      for (let y = Math.round(Math.min(a.y, b.y)); y < 260 * S; y++) if (skin[y * W + xm] && skin[(y + 2) * W + xm] && skin[(y + 4) * W + xm]) return y;
      return null;
    };
    const w1 = web(ring, middle), w2 = web(middle, index), pw = 2 * guideCircle().r * S;
    const out = { fingerRatio: null, idxRing: +((ring.y - index.y) / pw).toFixed(3), thumbDeg: null };
    if (w1 != null && w2 != null) {
      const fr = ((w1 + w2) / 2 - middle.y) / pw;
      if (fr > 0.55 && fr < 1.5) out.fingerRatio = +fr.toFixed(3);
    }
    const bx = 212 * S, by = 312 * S;
    let best = 0, tx = 0, ty = 0;
    for (let y = 110 * S; y < by; y += 2) for (let x = 238 * S; x < W; x += 2) {
      if (!skin[y * W + x]) continue;
      const d = (x - bx) * (x - bx) + (by - y) * (by - y);
      if (d > best) { best = d; tx = x; ty = y; }
    }
    if (best > 0) out.thumbDeg = Math.round(Math.atan2(tx - bx, by - ty) / DEG);
    return out;
  }

  /* autoFit 이 찾은 위치대로 사진에서 손을 잘라 600×840 기준 그림(엄지가 오른쪽)으로 만든다 */
  function cropByFit(img, iw, ih, fit) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    if (fit.flip) { g.translate(W, 0); g.scale(-1, 1); }
    g.scale(S / fit.s, S / fit.s);
    g.translate(-fit.ox, -fit.oy);
    g.drawImage(img, 0, 0, iw, ih);
    return c;
  }

  /* 촬영 전 실시간 안내용: 작은 화면에서 정렬 상태만 빠르게 본다 (0~1) */
  let _mini = null;
  function quickAlign(canvas, palmOnly) {
    const w = canvas.width, h = canvas.height;
    palmOnly = !!palmOnly;
    if (!_mini || _mini.w !== w || _mini.palm !== palmOnly) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.scale(w / HAND.W, h / HAND.H);
      g.fillStyle = '#fff';
      if (palmOnly) fillPalmShape(g, -9); else fillHandShape(g, -5);
      const d = g.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h);
      for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 127 ? 1 : 0;
      _mini = { w, m, palm: palmOnly };
    }
    const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const cx = Math.round(HAND.center.x * w / HAND.W), cy = Math.round(HAND.center.y * h / HAND.H), cr = Math.round(HAND.center.r * w / HAND.W);
    const Ys = [], Cbs = [], Crs = [];
    for (let y = cy - cr; y <= cy + cr; y++) for (let x = cx - cr; x <= cx + cr; x++) {
      const i = (y * w + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      Ys.push(0.299 * r + 0.587 * g + 0.114 * b);
      Cbs.push(128 - 0.168736 * r - 0.331264 * g + 0.5 * b);
      Crs.push(128 + 0.5 * r - 0.418688 * g - 0.081312 * b);
    }
    const Y0 = median(Ys), Cb0 = median(Cbs), Cr0 = median(Crs);
    if (Y0 < 48) return { score: 0, hint: 'dark' };
    const skinLike = (Cr0 - Cb0 >= 10) && Cr0 >= 128 && Cr0 <= 194 && Cb0 >= 60 && Cb0 <= 134;
    if (!skinLike) return { score: 0, hint: 'none' };
    let inN = 0, inS = 0, oN = 0, oS = 0, tN = 0, tS = 0;
    const thumbX = Math.round(240 * w / HAND.W);
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const s = Math.abs(Cb - Cb0) <= 17 && Math.abs(Cr - Cr0) <= 17 && (0.299 * r + 0.587 * g + 0.114 * b) >= 0.35 * Y0 ? 1 : 0;
      if (_mini.m[p]) { inN++; inS += s; if (p % w >= thumbX) { tN++; tS += s; } } else { oN++; oS += s; }
    }
    const inside = inS / inN, outside = oS / oN;
    if (palmOnly) return { score: inside, hint: inside >= 0.86 ? 'ok' : 'none' };
    if (inside < 0.6) return { score: inside, hint: 'none' };
    if (tS / Math.max(1, tN) < 0.35) return { score: 0.5, hint: 'thumb' };
    if (outside > 0.65) return { score: 0.5, hint: 'far' };
    return { score: inside, hint: 'ok' };
  }

  /* ============================================================
   * 가이드 없이 찍은 사진에서 손을 찾아 가이드에 맞추기
   *   1) 피부색 덩어리 중 가장 큰 것을 손으로 본다.
   *   2) 그 안에 들어가는 가장 큰 원의 중심 = 손바닥 한가운데, 반지름 = 손 크기.
   *   3) 그 근처에서 가이드 도형과 가장 잘 겹치는 크기·위치·좌우 방향을 찾는다.
   *   4) 잘 안 맞으면 사진이 옆으로 누운 경우(90°씩)도 시도해 본다.
   * 돌려줌: { ok, score, s, ox, oy, flip, rot }
   *   가이드 좌표 (gx, gy) → 사진 좌표 ((flip ? 300 - gx : gx) * s + ox, gy * s + oy)
   *   rot 가 0 이 아니면 사진을 시계 방향으로 rot×90° 돌린 뒤 다시 불러야 한다.
   * ============================================================ */
  function chamfer(mask, w, h) {
    const d = new Uint16Array(w * h);
    for (let i = 0; i < w * h; i++) d[i] = mask[i] ? 60000 : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      v = Math.min(v, x > 0 ? d[i - 1] + 3 : 3, y > 0 ? d[i - w] + 3 : 3);
      if (y > 0 && x > 0) v = Math.min(v, d[i - w - 1] + 4);
      if (y > 0 && x < w - 1) v = Math.min(v, d[i - w + 1] + 4);
      d[i] = v;
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      let v = d[i];
      v = Math.min(v, x < w - 1 ? d[i + 1] + 3 : 3, y < h - 1 ? d[i + w] + 3 : 3);
      if (y < h - 1 && x < w - 1) v = Math.min(v, d[i + w + 1] + 4);
      if (y < h - 1 && x > 0) v = Math.min(v, d[i + w - 1] + 4);
      d[i] = v;
    }
    return d;
  }
  function peak(d, w, h) {
    let m = 0, mi = 0;
    for (let i = 0; i < w * h; i++) if (d[i] > m) { m = d[i]; mi = i; }
    return { x: mi % w, y: Math.floor(mi / w), r: m / 3 };
  }
  function rasterGuide(s, flip) {
    const w = Math.ceil(HAND.W * s) + 2, h = Math.ceil(HAND.H * s) + 2;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.scale(s, s);
    if (flip) { g.translate(HAND.W, 0); g.scale(-1, 1); }
    g.fillStyle = '#fff';
    fillHandShape(g, 0);
    const d = g.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h);
    let n = 0;
    for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 127) { m[i] = 1; n++; }
    return { w, h, m, n };
  }
  let _gc = null;
  function guideCircle() {
    if (_gc) return _gc;
    const k = 0.5, r = rasterGuide(k, false), p = peak(chamfer(r.m, r.w, r.h), r.w, r.h);
    _gc = { x: p.x / k, y: p.y / k, r: p.r / k };
    return _gc;
  }
  function fitMask(comp, w, h, preferFlip) {
    const pk = peak(chamfer(comp, w, h), w, h);
    if (pk.r < 5) return null;
    const G = guideCircle(), s0 = pk.r / G.r;
    const rowCum = new Int32Array(h + 1);
    for (let y = 0; y < h; y++) {
      let c = 0;
      for (let x = 0; x < w; x++) c += comp[y * w + x];
      rowCum[y + 1] = rowCum[y] + c;
    }
    const score = (sil, s, ox, oy) => {
      let inter = 0;
      for (let y = 0; y < sil.h; y++) {
        const Y = y + oy;
        if (Y < 0 || Y >= h) continue;
        const so = y * sil.w, co = Y * w + ox;
        for (let x = 0; x < sil.w; x++) {
          if (!sil.m[so + x]) continue;
          const X = x + ox;
          if (X >= 0 && X < w && comp[co + x]) inter++;
        }
      }
      // 손목 아래(팔뚝)는 겹침 계산에서 뺀다
      const bottom = Math.max(0, Math.min(h, Math.floor(oy + 416 * s) + 1));
      return inter / (sil.n + rowCum[bottom] - inter);
    };
    const best = { false: null, true: null };
    for (const flip of [false, true]) {
      const gx = flip ? HAND.W - G.x : G.x;
      const scan = (scales, offs, centre) => {
        for (const ks of scales) {
          const s = (centre ? centre.s : s0) * ks, sil = rasterGuide(s, flip);
          const bx = centre ? centre.ox + (centre.s - s) * gx : pk.x - gx * s;
          const by = centre ? centre.oy + (centre.s - s) * G.y : pk.y - G.y * s;
          for (const dy of offs) for (const dx of offs) {
            const ox = Math.round(bx + dx * pk.r), oy = Math.round(by + dy * pk.r);
            const v = score(sil, s, ox, oy);
            if (!best[flip] || v > best[flip].score) best[flip] = { score: v, s, ox, oy, flip };
          }
        }
      };
      scan([0.78, 0.86, 0.94, 1.02, 1.1, 1.2], [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3], null);
      scan([0.96, 1, 1.04], [-0.08, -0.04, 0, 0.04, 0.08], Object.assign({}, best[flip]));
    }
    const a = best[!!preferFlip], b = best[!preferFlip];
    return b.score > a.score + 0.03 ? b : a;      // 고른 손과 반대 방향이 확실히 더 잘 맞을 때만 뒤집는다
  }
  /* 찾은 위치를 더 큰 그림(긴 변 480픽셀)에서 한 번 더 다듬는다. 손금은 가늘어서 1~2% 어긋나도 차이가 난다 */
  function refineFit(img, iw, ih, col, c) {
    const k = Math.min(1, 480 / Math.max(iw, ih));
    const w = Math.max(16, Math.round(iw * k)), h = Math.max(16, Math.round(ih * k));
    if (Math.max(w, h) < 220) return c;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, mask = new Uint8Array(w * h);
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      const Y = 0.299 * r + 0.587 * gg + 0.114 * b;
      if (Y < 0.35 * col.Y0) continue;
      const Cb = 128 - 0.168736 * r - 0.331264 * gg + 0.5 * b, Cr = 128 + 0.5 * r - 0.418688 * gg - 0.081312 * b;
      if (Math.abs(Cb - col.Cb0) <= 17 && Math.abs(Cr - col.Cr0) <= 17) mask[p] = 1;
    }
    const I = integral(mask, w, h), W1 = w + 1;
    const G = guideCircle(), gx = c.flip ? HAND.W - G.x : G.x;
    const s0 = c.s * k, px = c.ox * k + gx * s0, py = c.oy * k + G.y * s0;       // 손바닥 한가운데는 그대로 두고
    let best = null;
    for (const ks of [0.965, 0.9825, 1, 1.0175, 1.035]) {
      const s = s0 * ks, sil = rasterGuide(s, c.flip), idx = [];
      for (let y = 0; y < sil.h; y++) for (let x = 0; x < sil.w; x++) if (sil.m[y * sil.w + x]) idx.push(x, y);
      const bx = px - gx * s, by = py - G.y * s;
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
        const ox = Math.round(bx + dx), oy = Math.round(by + dy);
        let inter = 0;
        for (let t = 0; t < idx.length; t += 2) {
          const X = idx[t] + ox, Y = idx[t + 1] + oy;
          if (X >= 0 && Y >= 0 && X < w && Y < h && mask[Y * w + X]) inter++;
        }
        const x0 = Math.max(0, ox - 6), x1 = Math.min(w, ox + sil.w + 6), y0 = Math.max(0, oy - 6);
        const y1 = Math.max(y0, Math.min(h, Math.floor(oy + 416 * s) + 1));       // 손목 아래는 뺀다
        const box = I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
        const v = inter / (sil.n + box - inter);
        if (!best || v > best.v) best = { v, s, ox, oy };
      }
    }
    return best ? Object.assign({}, c, { s: best.s / k, ox: best.ox / k, oy: best.oy / k }) : c;
  }
  function rot90(m, w, h) {       // 시계 방향 90°
    const o = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[x * h + (h - 1 - y)] = m[y * w + x];
    return o;
  }
  function autoFit(img, iw, ih, preferFlip, allowRotate) {
    const k = 150 / Math.max(iw, ih);
    const w = Math.max(16, Math.round(iw * k)), h = Math.max(16, Math.round(ih * k));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, n = w * h;
    const Yv = new Float32Array(n), Cb = new Float32Array(n), Cr = new Float32Array(n), cand = new Uint8Array(n);
    let cnt = 0;
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      Yv[p] = 0.299 * r + 0.587 * gg + 0.114 * b;
      Cb[p] = 128 - 0.168736 * r - 0.331264 * gg + 0.5 * b;
      Cr[p] = 128 + 0.5 * r - 0.418688 * gg - 0.081312 * b;
      if (Yv[p] > 45 && Cr[p] - Cb[p] >= 8 && Cr[p] >= 128 && Cr[p] <= 194 && Cb[p] >= 60 && Cb[p] <= 134) { cand[p] = 1; cnt++; }
    }
    if (cnt < n * 0.04) return { ok: false, score: 0, rot: 0 };
    // 피부색 후보 가운데 화면 중앙 쪽의 색을 손 색으로 본다
    let cbs = [], crs = [], ys = [];
    for (let y = Math.floor(h * 0.2); y < h * 0.8; y++) for (let x = Math.floor(w * 0.2); x < w * 0.8; x++) {
      const p = y * w + x;
      if (cand[p]) { cbs.push(Cb[p]); crs.push(Cr[p]); ys.push(Yv[p]); }
    }
    if (cbs.length < 150) { cbs = []; crs = []; ys = []; for (let p = 0; p < n; p++) if (cand[p]) { cbs.push(Cb[p]); crs.push(Cr[p]); ys.push(Yv[p]); } }
    const Cb0 = median(cbs), Cr0 = median(crs), Y0 = median(ys);
    const mask = new Uint8Array(n);
    for (let p = 0; p < n; p++) if (Math.abs(Cb[p] - Cb0) <= 17 && Math.abs(Cr[p] - Cr0) <= 17 && Yv[p] >= 0.35 * Y0) mask[p] = 1;
    // 가장 큰 덩어리
    const label = new Int32Array(n), queue = new Int32Array(n);
    let bestLabel = 0, bestSize = 0, cur = 0;
    for (let p0 = 0; p0 < n; p0++) {
      if (!mask[p0] || label[p0]) continue;
      cur++;
      let qh = 0, qt = 0, size = 0;
      queue[qt++] = p0; label[p0] = cur;
      while (qh < qt) {
        const p = queue[qh++], x = p % w;
        size++;
        if (x > 0 && mask[p - 1] && !label[p - 1]) { label[p - 1] = cur; queue[qt++] = p - 1; }
        if (x < w - 1 && mask[p + 1] && !label[p + 1]) { label[p + 1] = cur; queue[qt++] = p + 1; }
        if (p >= w && mask[p - w] && !label[p - w]) { label[p - w] = cur; queue[qt++] = p - w; }
        if (p < n - w && mask[p + w] && !label[p + w]) { label[p + w] = cur; queue[qt++] = p + w; }
      }
      if (size > bestSize) { bestSize = size; bestLabel = cur; }
    }
    if (bestSize < n * 0.03) return { ok: false, score: 0, rot: 0 };
    let comp = new Uint8Array(n);
    for (let p = 0; p < n; p++) if (label[p] === bestLabel) comp[p] = 1;

    let best = fitMask(comp, w, h, preferFlip), rot = 0;
    if (allowRotate && (!best || best.score < 0.5)) {
      let m = comp, mw = w, mh = h;
      for (let r = 1; r <= 3; r++) {
        m = rot90(m, mw, mh);
        const t = mw; mw = mh; mh = t;
        const f = fitMask(m, mw, mh, preferFlip);
        if (f && f.score > 0.5 && (!best || f.score > best.score + 0.08)) { best = f; rot = r; }
      }
    }
    if (!best) return { ok: false, score: 0, rot: 0 };
    if (rot) return { ok: false, score: best.score, rot };
    let fit = { ok: best.score >= 0.42, score: +best.score.toFixed(3), rot: 0, flip: best.flip, s: best.s / k, ox: best.ox / k, oy: best.oy / k };
    if (fit.ok) { try { fit = refineFit(img, iw, ih, { Cb0, Cr0, Y0 }, fit); } catch (e) { /* 다듬기에 실패하면 처음 찾은 위치를 쓴다 */ } }
    return fit;
  }

  /* ============================================================
   * 손톱 판독 (엄지 손톱 한 개를 틀에 맞춰 찍은 작은 사진)
   *   가운데 색을 손톱 색으로 보고, 거기서부터 색이 비슷하고 경계(큰 밝기 변화)를 넘지 않는 범위를 손톱으로 본다.
   *   → 세로/가로 비율(모양), 붉은 기(빛깔), 뿌리 쪽의 밝은 반달 유무
   * ============================================================ */
  function analyzeNail(canvas) {
    const w = canvas.width, h = canvas.height;
    const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const n = w * h, Y = new Float32Array(n), Cb = new Float32Array(n), Cr = new Float32Array(n);
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      Y[p] = 0.299 * r + 0.587 * g + 0.114 * b;
      Cb[p] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      Cr[p] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    }
    const cx = w >> 1, cy = h >> 1, rr = Math.round(w * 0.1), ys = [], bs = [], rs = [];
    for (let y = cy - rr; y <= cy + rr; y++) for (let x = cx - rr; x <= cx + rr; x++) { const p = y * w + x; ys.push(Y[p]); bs.push(Cb[p]); rs.push(Cr[p]); }
    const Y0 = median(ys), Cb0 = median(bs), Cr0 = median(rs);
    if (Y0 < 45) return { ok: false, reason: 'dark' };
    if (!(Cr0 - Cb0 >= 4 && Cr0 >= 124 && Cr0 <= 205 && Cb0 >= 70 && Cb0 <= 142)) return { ok: false, reason: 'none' };
    // 가운데에서 번져 나가며 손톱 영역 찾기
    const mask = new Uint8Array(n), stack = [cy * w + cx];
    mask[cy * w + cx] = 1;
    let cnt = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    const okPix = (p, q) => Math.abs(Cb[p] - Cb0) <= 8 && Math.abs(Cr[p] - Cr0) <= 8 && Y[p] >= 0.72 * Y0 && Math.abs(Y[p] - Y[q]) <= 9;
    while (stack.length) {
      const p = stack.pop(), x = p % w, y = (p / w) | 0;
      cnt++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && !mask[p - 1] && okPix(p - 1, p)) { mask[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && !mask[p + 1] && okPix(p + 1, p)) { mask[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && !mask[p - w] && okPix(p - w, p)) { mask[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && !mask[p + w] && okPix(p + w, p)) { mask[p + w] = 1; stack.push(p + w); }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, frac = cnt / n;
    const edges = (x0 <= 1) + (x1 >= w - 2) + (y0 <= 1) + (y1 >= h - 2);
    // 영역이 너무 작거나 틀 밖으로 번졌으면 모양은 읽지 못한 것으로 둔다
    const ratio = frac >= 0.05 && frac <= 0.8 && edges <= 1 && cnt / (bw * bh) >= 0.55 ? +(bh / bw).toFixed(2) : null;
    // 반달: 손톱 영역의 위·아래 끝 30% 중 한쪽에, 더 밝고 덜 붉은 부분이 뭉쳐 있는가
    let moon = false, moonSide = null;
    if (ratio != null) {
      const band = (ya, yb) => {
        let t = 0, m = 0;
        // 반달은 색이 달라 손톱 영역에서 빠지므로, 손톱 상자 안 전체에서 센다
        for (let y = Math.max(0, ya); y <= Math.min(h - 1, yb); y++) for (let x = x0; x <= x1; x++) { const p = y * w + x; t++; if (Y[p] > Y0 + 9 && (Cr[p] - Cb[p]) < (Cr0 - Cb0) - 2 && Cr[p] >= Cb[p]) m++; }
        return t ? m / t : 0;
      };
      const k = Math.round(bh * 0.3);
      const top = band(y0, y0 + k), bottom = band(y1 - k, y1);
      moon = Math.max(top, bottom) >= 0.14;
      if (moon) moonSide = top > bottom ? 'top' : 'bottom';
    }
    return { ok: true, ratio, pink: Math.round(Cr0 - Cb0), bright: Math.round(Y0), moon, moonSide, area: +frac.toFixed(3),
      box: ratio != null ? [x0, y0, x1, y1] : null, size: [w, h] };
  }

  return { analyze, analyzeNail, quickAlign, autoFit, cropByFit, SIZE: { W, H, S } };
})();
