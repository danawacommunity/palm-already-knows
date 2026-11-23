'use strict';
/* ============================================================
 * 05. 그림: 자동차, 도사 캐릭터, 4컷 만화, 공유용 결과 이미지
 * 전부 캔버스에 직접 그립니다(그대로 PNG로 저장할 수 있도록).
 * ============================================================ */

const Draw = (function () {
  const INK = '#1A1410', RED = '#C3251C', RICE = '#FFF8E1', PAPER = '#F2C230', PAPER_HI = '#F8D968', JADE = '#0E6E66';
  const FALLBACK = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Noto Sans CJK KR", sans-serif';
  const F_DISPLAY = '"Yeon Sung", "Jua", ' + FALLBACK;
  const F_COMIC = '"Jua", ' + FALLBACK;
  const F_BODY = '"Gowun Dodum", ' + FALLBACK;
  const font = (px, fam, weight) => `${weight || 400} ${px}px ${fam}`;

  /* ---------- 글자 ---------- */
  function greedy(ctx, text, maxW) {
    const lines = [];
    let cur = '';
    for (const w of String(text).split(' ')) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width <= maxW) { cur = t; continue; }
      if (cur) lines.push(cur);
      if (ctx.measureText(w).width <= maxW) { cur = w; continue; }
      let part = '';
      for (const ch of w) {
        if (part && ctx.measureText(part + ch).width > maxW) { lines.push(part); part = ch; } else part += ch;
      }
      cur = part;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  /* 줄 수는 그대로 두고, 줄 길이가 고르게 되도록 폭을 좁혀 본다 */
  function wrap(ctx, text, maxW) {
    let lines = greedy(ctx, text, maxW);
    if (lines.length < 2) return lines;
    let lo = maxW * 0.45, hi = maxW;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2, t = greedy(ctx, text, mid);
      if (t.length <= lines.length) { hi = mid; lines = t; } else lo = mid;
    }
    return lines;
  }
  function fitFont(ctx, text, maxW, px, fam, minPx) {
    let s = px;
    ctx.font = font(s, fam);
    while (s > (minPx || 12) && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = font(s, fam); }
    return s;
  }
  function textBlock(ctx, lines, x, y, lh, align) {
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  }

  /* ---------- 기본 도형 ---------- */
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function polyRound(ctx, pts, r) {
    const n = pts.length;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      const rr = Math.min(r, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 2, Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2);
      if (i === 0) ctx.moveTo((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
      ctx.arcTo(p1[0], p1[1], (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, rr);
    }
    ctx.closePath();
  }
  function sunburst(ctx, cx, cy, R, n, a, b) {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? a : b;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    }
  }
  function dots(ctx, x, y, w, h, gap, r, color) {
    ctx.fillStyle = color;
    for (let j = 0, yy = y; yy < y + h; yy += gap, j++) {
      for (let xx = x + (j % 2 ? gap / 2 : 0); xx < x + w; xx += gap) {
        ctx.beginPath();
        ctx.arc(xx, yy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  function sparkle(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.28 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  /* 말풍선. box = {x, y, w}; 높이는 글에 맞춘다. tail = 꼬리 끝 좌표 */
  function bubble(ctx, text, box, tail, opt) {
    opt = opt || {};
    const size = opt.size || 34, pad = opt.pad || 22, lh = Math.round(size * 1.28);
    ctx.font = font(size, opt.font || F_COMIC);
    const lines = wrap(ctx, text, box.w - pad * 2);
    const h = lines.length * lh + pad * 2 - (lh - size) * 0.6;
    const { x, y, w } = box;
    const body = () => rrect(ctx, x, y, w, h, opt.radius || 30);
    const tip = () => {
      const below = tail.y > y + h / 2;
      const bx = Math.max(x + 44, Math.min(x + w - 44, tail.x + (tail.x > x + w / 2 ? -30 : 30)));
      const by = below ? y + h - 6 : y + 6;
      ctx.beginPath();
      ctx.moveTo(bx - 18, by);
      ctx.lineTo(tail.x, tail.y);
      ctx.lineTo(bx + 18, by);
      ctx.closePath();
    };
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 10;
    body(); ctx.stroke();
    if (tail) { tip(); ctx.stroke(); }
    ctx.fillStyle = opt.fill || '#FFFFFF';
    body(); ctx.fill();
    if (tail) { tip(); ctx.fill(); }
    ctx.fillStyle = opt.color || INK;
    textBlock(ctx, lines, x + w / 2, y + pad + size / 2, lh, 'center');
    ctx.restore();
    return h;
  }

  /* 붉은 도장 */
  function stamp(ctx, x, y, w, h, top, big, rot) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((rot || 0) * Math.PI / 180);
    rrect(ctx, -w / 2, -h / 2, w, h, 10);
    ctx.fillStyle = RED;
    ctx.fill();
    ctx.strokeStyle = RICE;
    ctx.lineWidth = 2.5;
    rrect(ctx, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 6);
    ctx.stroke();
    ctx.fillStyle = RICE;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (top) {
      ctx.font = font(h * 0.26, F_COMIC);
      ctx.fillText(top, 0, -h * 0.2);
      ctx.font = font(h * 0.44, F_DISPLAY);
      ctx.fillText(big, 0, h * 0.17);
    } else {
      ctx.font = font(h * 0.5, F_DISPLAY);
      ctx.fillText(big, 0, 2);
    }
    ctx.restore();
  }

  /* ---------- 자동차 (옆모습, 오른쪽을 봄. 차종을 나타내는 일반적인 만화체) ---------- */
  const BODIES = {
    sedan: {
      r: 15, wheels: [-58, 60],
      body: [[-97, -16], [-98, -38], [-88, -48], [-64, -50], [-38, -73], [20, -73], [52, -49], [88, -43], [98, -33], [98, -16]],
      windows: [[[-56, -52], [-36, -68], [-10, -68], [-10, -52]], [[-4, -52], [-4, -68], [17, -68], [42, -52]]],
    },
    luxury: {
      r: 15, wheels: [-64, 68],
      body: [[-106, -16], [-107, -38], [-97, -47], [-70, -49], [-44, -70], [16, -70], [48, -48], [96, -43], [107, -33], [107, -16]],
      windows: [[[-62, -51], [-42, -65], [-16, -65], [-16, -51]], [[-10, -51], [-10, -65], [13, -65], [38, -51]]],
      chrome: true,
    },
    sports: {
      r: 15, wheels: [-60, 62],
      body: [[-98, -14], [-99, -34], [-90, -45], [-56, -49], [-22, -62], [12, -61], [46, -43], [90, -34], [100, -24], [99, -14]],
      windows: [[[-46, -50], [-20, -58], [9, -57], [34, -45]]],
      wing: true,
    },
    muscle: {
      r: 16, wheels: [-62, 60],
      body: [[-99, -16], [-100, -38], [-92, -49], [-72, -51], [-48, -69], [-6, -69], [20, -50], [88, -46], [100, -36], [100, -16]],
      windows: [[[-64, -53], [-46, -65], [-9, -65], [12, -53]]],
      stripe: true, scoop: true,
    },
    offroad: {
      r: 20, wheels: [-56, 58],
      body: [[-88, -24], [-88, -84], [-82, -90], [24, -90], [34, -60], [84, -58], [92, -50], [92, -24]],
      windows: [[[-78, -83], [-34, -83], [-34, -61], [-78, -61]], [[-28, -83], [19, -83], [27, -61], [-28, -61]]],
      spare: true, rack: true,
    },
    pickup: {
      r: 18, wheels: [-60, 60],
      body: [[-98, -22], [-98, -55], [-16, -55], [-10, -85], [34, -85], [48, -57], [88, -53], [96, -44], [96, -22]],
      windows: [[[-5, -79], [30, -79], [41, -59], [-9, -59]]],
      cargo: true,
    },
    minivan: {
      r: 15, wheels: [-62, 60],
      body: [[-98, -16], [-99, -62], [-90, -79], [38, -79], [70, -53], [92, -47], [98, -37], [98, -16]],
      windows: [[[-88, -73], [-52, -73], [-52, -55], [-93, -55]], [[-46, -73], [-8, -73], [-8, -55], [-46, -55]], [[-2, -73], [34, -73], [59, -55], [-2, -55]]],
    },
    camper: {
      r: 15, wheels: [-62, 60],
      body: [[-98, -16], [-99, -62], [-90, -79], [38, -79], [70, -53], [92, -47], [98, -37], [98, -16]],
      windows: [[[-88, -73], [-52, -73], [-52, -55], [-93, -55]], [[-46, -73], [-8, -73], [-8, -55], [-46, -55]], [[-2, -73], [34, -73], [59, -55], [-2, -55]]],
      tent: true, twotone: true,
    },
    suv: {
      r: 17, wheels: [-60, 60],
      body: [[-96, -20], [-97, -58], [-88, -77], [24, -77], [50, -53], [88, -49], [96, -41], [96, -20]],
      windows: [[[-84, -71], [-40, -71], [-40, -55], [-91, -55]], [[-34, -71], [20, -71], [40, -55], [-34, -55]]],
      rails: true,
    },
    hatch: {
      r: 15, wheels: [-48, 50],
      body: [[-80, -16], [-82, -46], [-72, -71], [14, -73], [40, -49], [72, -45], [82, -35], [82, -16]],
      windows: [[[-68, -66], [-30, -67], [-30, -51], [-75, -51]], [[-24, -67], [11, -68], [31, -51], [-24, -51]]],
      roof: -66,
    },
    ev: {
      r: 17, wheels: [-58, 62],
      body: [[-94, -18], [-96, -46], [-76, -71], [18, -73], [50, -49], [90, -45], [96, -37], [96, -18]],
      windows: [[[-70, -66], [-28, -67], [-28, -52], [-85, -52]], [[-22, -67], [15, -68], [40, -52], [-22, -52]]],
      bolt: true,
    },
    kei: {
      r: 13, wheels: [-44, 46],
      body: [[-72, -14], [-73, -80], [-66, -89], [36, -89], [52, -57], [70, -53], [75, -44], [75, -14]],
      windows: [[[-64, -83], [-22, -83], [-22, -59], [-64, -59]], [[-16, -83], [32, -83], [43, -59], [-16, -59]]],
    },
  };

  function shade(hex, k) {   // k<0 어둡게, k>0 밝게
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  function drawCar(ctx, bodyId, cx, groundY, scale, color, opt) {
    opt = opt || {};
    const B = BODIES[bodyId] || BODIES.sedan, sil = !!opt.silhouette;
    const xs = B.body.map((p) => p[0]), front = Math.max(...xs), rear = Math.min(...xs);
    const bodyCol = sil ? '#3B332C' : color, lw = 4;
    ctx.save();
    ctx.translate(cx, groundY);
    ctx.scale(scale, scale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // 바닥 그림자
    if (!opt.noShadow) {
      ctx.fillStyle = 'rgba(26,20,16,0.18)';
      ctx.beginPath();
      ctx.ellipse((front + rear) / 2, 2, (front - rear) / 2 + 6, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // 차 뒤쪽 부속
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw;
    if (B.spare) {
      ctx.fillStyle = sil ? bodyCol : '#2A2420';
      ctx.beginPath(); ctx.arc(rear - 6, -54, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (B.wing) {
      ctx.fillStyle = bodyCol;
      polyRound(ctx, [[-100, -60], [-70, -60], [-72, -54], [-98, -54]], 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-90, -54); ctx.lineTo(-86, -46); ctx.moveTo(-78, -54); ctx.lineTo(-74, -47); ctx.stroke();
    }
    if (B.tent) {
      ctx.fillStyle = sil ? bodyCol : RICE;
      polyRound(ctx, [[-84, -80], [-78, -112], [30, -80]], 3); ctx.fill(); ctx.stroke();
      if (!sil) { ctx.beginPath(); ctx.moveTo(-60, -84); ctx.lineTo(-62, -100); ctx.moveTo(-36, -84); ctx.lineTo(-40, -94); ctx.stroke(); }
    }
    if (B.cargo && !sil) {
      ctx.fillStyle = '#D9A066';
      ctx.fillRect(-78, -72, 26, 18); ctx.strokeRect(-78, -72, 26, 18);
      ctx.fillStyle = '#B9814A';
      ctx.fillRect(-48, -66, 20, 12); ctx.strokeRect(-48, -66, 20, 12);
    }
    // 차체
    polyRound(ctx, B.body, 9);
    ctx.fillStyle = bodyCol;
    ctx.fill();
    if (!sil) {
      ctx.save();
      polyRound(ctx, B.body, 9);
      ctx.clip();
      if (B.twotone) { ctx.fillStyle = RICE; ctx.fillRect(rear - 4, -44, front - rear + 8, 40); }
      if (B.roof != null) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(rear - 4, -120, front - rear + 8, 120 + B.roof); }
      ctx.fillStyle = 'rgba(26,20,16,0.20)';           // 아래쪽 음영 띠
      ctx.fillRect(rear - 4, -25, front - rear + 8, 14);
      if (B.stripe) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(rear - 4, -36, front - rear + 8, 3.5); ctx.fillRect(rear - 4, -30, front - rear + 8, 2); }
      ctx.restore();
    }
    polyRound(ctx, B.body, 9);
    ctx.stroke();
    if (!sil) {
      // 창문
      for (const w of B.windows) {
        polyRound(ctx, w, 4);
        ctx.fillStyle = '#CFE9F0';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.stroke();
        const wx = w.reduce((s, p) => s + p[0], 0) / w.length, wy = w.reduce((s, p) => s + p[1], 0) / w.length;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(wx - 7, wy + 5); ctx.lineTo(wx + 1, wy - 5); ctx.stroke();
        ctx.strokeStyle = INK;
      }
      ctx.lineWidth = lw;
      // 등, 손잡이
      ctx.fillStyle = '#FFE27A';
      rrect(ctx, front - 13, -42 - (B.r > 16 ? 6 : 0), 10, 7, 3); ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#E5372B';
      rrect(ctx, rear + 2, -43 - (B.r > 16 ? 6 : 0), 7, 8, 3); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(4, -40); ctx.lineTo(13, -40); ctx.stroke();
      if (B.chrome) { ctx.strokeStyle = '#D9D9DE'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(rear + 14, -31); ctx.lineTo(front - 14, -31); ctx.stroke(); ctx.strokeStyle = INK; }
      if (B.scoop) { ctx.lineWidth = lw; ctx.fillStyle = shade(color, -0.25); polyRound(ctx, [[46, -48], [50, -55], [68, -55], [70, -48]], 2); ctx.fill(); ctx.stroke(); }
      if (B.rack) { ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-76, -97); ctx.lineTo(16, -97); ctx.moveTo(-66, -97); ctx.lineTo(-66, -90); ctx.moveTo(6, -97); ctx.lineTo(6, -90); ctx.stroke(); }
      if (B.rails) { ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-78, -82); ctx.lineTo(14, -82); ctx.stroke(); }
      if (B.bolt) {
        ctx.fillStyle = '#FFE27A'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-12, -46); ctx.lineTo(-22, -32); ctx.lineTo(-15, -32); ctx.lineTo(-19, -21); ctx.lineTo(-7, -36); ctx.lineTo(-14, -36); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else if (B.rack || B.rails) {
      ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-76, B.rack ? -97 : -82); ctx.lineTo(14, B.rack ? -97 : -82); ctx.stroke();
    }
    // 바퀴
    for (const wx of B.wheels) {
      ctx.fillStyle = sil ? '#2A241F' : '#221C18';
      ctx.strokeStyle = INK; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(wx, -B.r, B.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (!sil) {
        ctx.fillStyle = '#E9E4DA';
        ctx.beginPath(); ctx.arc(wx, -B.r, B.r * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#221C18';
        ctx.beginPath(); ctx.arc(wx, -B.r, B.r * 0.16, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ---------- 손바닥 도사 (갓 쓰고 돋보기 든 손금쟁이) ---------- */
  function drawSage(ctx, x, y, s, pose, facing) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * (facing || 1), s);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    const sleeve = (x1, y1, x2, y2) => {
      ctx.strokeStyle = INK; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 21; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.fillStyle = '#F6CFA9';
      ctx.beginPath(); ctx.arc(x2, y2, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    };
    // 뒤쪽 팔
    if (pose === 'cheer') sleeve(-24, -112, -58, -160);
    // 도포
    polyRound(ctx, [[-34, -124], [34, -124], [54, -2], [-54, -2]], 12);
    ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-16, -124); ctx.lineTo(4, -84); ctx.lineTo(18, -124); ctx.stroke();
    ctx.strokeStyle = RED; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(-41, -76); ctx.lineTo(41, -76); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -76); ctx.lineTo(4, -44); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    // 머리
    ctx.fillStyle = '#F6CFA9';
    ctx.beginPath(); ctx.arc(0, -152, 31, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 수염
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.moveTo(-24, -142); ctx.quadraticCurveTo(-18, -100, 2, -86); ctx.quadraticCurveTo(22, -100, 26, -142); ctx.quadraticCurveTo(2, -128, -24, -142); ctx.closePath(); ctx.fill(); ctx.stroke();
    // 안경과 눈
    ctx.lineWidth = 4;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(-3, -156, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(20, -156, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, -156); ctx.lineTo(10, -156); ctx.stroke();
    ctx.fillStyle = INK;
    if (pose === 'cheer') {
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(-3, -154, 5, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(20, -154, 5, Math.PI, 0); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(-1, -156, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(22, -156, 3.2, 0, Math.PI * 2); ctx.fill();
    }
    // 갓
    ctx.lineWidth = 5;
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(0, -178, 56, 10, 0, 0, Math.PI * 2); ctx.fill();
    polyRound(ctx, [[-22, -180], [-17, -216], [17, -216], [22, -180]], 4); ctx.fill();
    ctx.strokeStyle = RED; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-21, -184); ctx.lineTo(21, -184); ctx.stroke();
    ctx.strokeStyle = INK;
    // 앞쪽 팔
    if (pose === 'peer') {
      sleeve(26, -110, 62, -124);
      ctx.strokeStyle = '#7A4A21'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(66, -128); ctx.lineTo(78, -146); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 6;
      ctx.fillStyle = 'rgba(207,233,240,0.55)';
      ctx.beginPath(); ctx.arc(92, -166, 25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(92, -166, 16, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke();
    } else if (pose === 'explain') {
      sleeve(26, -110, 54, -150);
      ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(56, -158); ctx.lineTo(60, -180); ctx.stroke();
      ctx.strokeStyle = '#F6CFA9'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(56, -158); ctx.lineTo(60, -180); ctx.stroke();
    } else if (pose === 'point') {
      sleeve(26, -110, 84, -118);
      ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(90, -119); ctx.lineTo(110, -122); ctx.stroke();
      ctx.strokeStyle = '#F6CFA9'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(90, -119); ctx.lineTo(110, -122); ctx.stroke();
    } else if (pose === 'cheer') {
      sleeve(26, -112, 60, -160);
    }
    ctx.restore();
  }

  /* ---------- 손 그림 + 판독한 손금 ---------- */
  function drawPalmDiagram(ctx, x, y, scale, lines, highlight, opt) {
    opt = opt || {};
    drawHandFigure(ctx, x, y, scale, { outlineWidth: 5 });
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const path = (pts) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    };
    for (const id of ['fate', 'heart', 'head', 'life']) {
      const l = lines[id];
      if (!l || !l.found || l.pts.length < 2 || id === highlight) continue;
      ctx.strokeStyle = 'rgba(138,84,58,0.75)';
      ctx.lineWidth = 2.6 / Math.max(0.7, scale) * 1.2;
      path(l.pts); ctx.stroke();
    }
    const h = lines[highlight];
    if (h && h.found && h.pts.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 11 / scale;
      path(h.pts); ctx.stroke();
      ctx.strokeStyle = RED; ctx.lineWidth = 6 / scale;
      path(h.pts); ctx.stroke();
      if (opt.label !== false) {
        const mid = h.pts[Math.floor(h.pts.length * (highlight === 'life' ? 0.55 : 0.5))];
        ctx.restore();
        ctx.save();
        const lx = x + mid[0] * scale, ly = y + mid[1] * scale;
        const name = LINE_INFO[highlight].name;
        ctx.font = font(24, F_COMIC);
        const tw = ctx.measureText(name).width + 22;
        let bx = lx - tw - 14, by = ly - 46;
        if (highlight === 'fate') { bx = lx - tw - 16; by = ly - 16; }
        if (highlight === 'heart') { bx = lx - tw / 2; by = ly + 14; }
        bx = Math.max(x + 6, bx);
        rrect(ctx, bx, by, tw, 34, 8);
        ctx.fillStyle = RED; ctx.fill();
        ctx.fillStyle = RICE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(name, bx + tw / 2, by + 18);
      }
    }
    ctx.restore();
  }

  /* ---------- 4컷 만화 (칸 하나 = 540×540) ---------- */
  const P = 540;
  function frame(ctx, n) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, P - 12, P - 12);
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(46, P - 46, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.font = font(32, F_DISPLAY);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 46, P - 44);
  }

  function panel1(ctx, res) {
    ctx.fillStyle = RICE; ctx.fillRect(0, 0, P, P);
    dots(ctx, 0, 0, P, P, 26, 3, 'rgba(242,194,48,0.35)');
    const hl = res.reasons[0].line;
    drawPalmDiagram(ctx, 6, 128, 0.98, res.lines, hl);
    drawSage(ctx, 448, 530, 1.0, 'peer', -1);
    bubble(ctx, res.script.p1, { x: 236, y: 24, w: 284 }, { x: 430, y: 300 }, { size: 33 });
    frame(ctx, 1);
  }

  function panel2(ctx, res) {
    ctx.fillStyle = '#FBEFC4'; ctx.fillRect(0, 0, P, P);
    ctx.save();
    ctx.strokeStyle = 'rgba(195,37,28,0.10)'; ctx.lineWidth = 10;
    for (let i = -P; i < P * 2; i += 44) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - P, P); ctx.stroke(); }
    ctx.restore();
    const hl = res.reasons[1].line;
    drawPalmDiagram(ctx, 306, 150, 0.68, res.lines, hl);
    drawSage(ctx, 132, 530, 1.02, 'explain', 1);
    bubble(ctx, res.script.p2, { x: 24, y: 24, w: 492 }, { x: 150, y: 296 }, { size: 33 });
    const [a, b] = res.reasons;
    stamp(ctx, 300, 448, 104, 70, a.name, String(a.score), -5);
    stamp(ctx, 414, 452, 104, 70, b.name, String(b.score), 4);
    frame(ctx, 2);
  }

  function panel3(ctx, res, car) {
    ctx.fillStyle = INK; ctx.fillRect(0, 0, P, P);
    const g = ctx.createRadialGradient(330, 400, 20, 330, 400, 330);
    g.addColorStop(0, 'rgba(195,37,28,0.95)');
    g.addColorStop(0.6, 'rgba(195,37,28,0.35)');
    g.addColorStop(1, 'rgba(195,37,28,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, P, P);
    drawCar(ctx, car.body, 338, 452, 1.55, '#000', { silhouette: true });
    ctx.fillStyle = PAPER; ctx.font = font(110, F_DISPLAY); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', 338, 372);
    drawSage(ctx, 128, 524, 0.92, 'point', 1);
    bubble(ctx, res.script.p3, { x: 30, y: 30, w: 480 }, { x: 140, y: 296 }, { size: 32, fill: RICE });
    ctx.save();
    ctx.translate(410, 500); ctx.rotate(-0.09);
    ctx.font = font(46, F_DISPLAY); ctx.textAlign = 'center';
    ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    ctx.strokeText('두구두구', 0, 0);
    ctx.fillStyle = PAPER; ctx.fillText('두구두구', 0, 0);
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, P - 12, P - 12);
    ctx.strokeStyle = PAPER; ctx.lineWidth = 3;
    ctx.strokeRect(17, 17, P - 34, P - 34);
    ctx.fillStyle = PAPER;
    ctx.beginPath(); ctx.arc(52, P - 52, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK; ctx.font = font(32, F_DISPLAY); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('3', 52, P - 50);
  }

  /* 굿즈 이름을 컷 안에 들어갈 만큼 짧게: "제조사 · 브랜드 · 제품군" → "제조사 브랜드" */
  function shortName(it) {
    if (it.short) return it.short;
    const p = it.name.split(' · ');
    return p.length >= 3 ? `${p[0]} ${p[1]}` : p.join(' ');
  }
  function panel4(ctx, res, car, ex) {
    sunburst(ctx, 270, 300, 520, 24, PAPER, PAPER_HI);
    // 제목 띠
    ctx.save();
    ctx.translate(270, 56); ctx.rotate(-0.025);
    rrect(ctx, -170, -32, 340, 64, 14);
    ctx.fillStyle = RED; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = font(34, F_DISPLAY);
    ctx.fillText('당신의 최애는?', 0, 2);
    ctx.restore();
    if (ex) {
      // 자동차와 다른 굿즈를 같은 크기의 줄로 나란히
      const rows = [['자동차', car.name]].concat(['watch', 'brand', 'food', 'egear', 'tv', 'region'].map((k) => [ex.items[k].label.replace('어울리는 ', '').replace('전자기기 브랜드', '전자기기'), shortName(ex.items[k])]));
      rrect(ctx, 30, 104, 480, 352, 16);
      ctx.fillStyle = 'rgba(255,248,225,0.94)'; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
      drawCar(ctx, car.body, 440, 168, 0.5, car.color);
      const top = 132, gap = 45;
      rows.forEach(([k, v], i) => {
        const y = top + i * gap + 18;
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        rrect(ctx, 46, y - 16, 94, 32, 8);
        ctx.fillStyle = i === 0 ? RED : INK; ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = font(fitFont(ctx, k, 84, 20, F_COMIC, 14), F_COMIC);
        ctx.textAlign = 'center';
        ctx.fillText(k, 93, y + 1);
        ctx.textAlign = 'left';
        ctx.fillStyle = INK;
        const maxW = i === 0 ? 270 : 350;
        ctx.font = font(fitFont(ctx, v, maxW, 26, F_COMIC, 15), F_COMIC);
        ctx.fillText(v, 152, y + 1);
        if (i < rows.length - 1) {
          ctx.strokeStyle = 'rgba(26,20,16,0.18)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
          ctx.beginPath(); ctx.moveTo(46, y + gap / 2); ctx.lineTo(494, y + gap / 2); ctx.stroke();
          ctx.setLineDash([]);
        }
      });
      sparkle(ctx, 500, 96, 18, '#FFFFFF');
      frame(ctx, 4);
      return;
    }
    // 차
    ctx.fillStyle = 'rgba(255,248,225,0.85)';
    ctx.beginPath(); ctx.ellipse(270, 330, 250, 34, 0, 0, Math.PI * 2); ctx.fill();
    drawCar(ctx, car.body, 270, 336, 2.05, car.color);
    // 창밖으로 흔드는 손
    ctx.save();
    ctx.translate(86, 148); ctx.rotate(-0.3);
    drawHandFigure(ctx, 0, 0, 0.2, { outlineWidth: 4 });
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(104, 190, 60, Math.PI * 1.02, Math.PI * 1.22); ctx.stroke();
    ctx.beginPath(); ctx.arc(104, 190, 76, Math.PI * 1.04, Math.PI * 1.2); ctx.stroke();
    sparkle(ctx, 470, 170, 22, '#FFFFFF');
    sparkle(ctx, 440, 212, 11, '#FFFFFF');
    sparkle(ctx, 64, 300, 13, '#FFFFFF');
    bubble(ctx, res.script.p4, { x: 92, y: 384, w: 424 }, { x: 300, y: 348 }, { size: 32 });
    frame(ctx, 4);
  }

  function drawPanel(canvas, n, res, ex) {
    const car = CARS.find((c) => c.id === res.carId);
    canvas.width = P; canvas.height = P;
    const ctx = canvas.getContext('2d');
    [panel1, panel2, panel3, panel4][n - 1](ctx, res, car, ex);
  }

  /* ---------- 결과 화면 맨 위의 자동차 그림 ---------- */
  function drawHero(canvas, car) {
    canvas.width = 720; canvas.height = 400;
    const ctx = canvas.getContext('2d');
    sunburst(ctx, 360, 250, 520, 28, RICE, '#FFF1C2');
    ctx.fillStyle = 'rgba(242,194,48,0.55)';
    ctx.beginPath(); ctx.ellipse(360, 330, 330, 40, 0, 0, Math.PI * 2); ctx.fill();
    drawCar(ctx, car.body, 360, 334, 2.9, car.color);
    sparkle(ctx, 628, 86, 24, PAPER);
    sparkle(ctx, 86, 110, 16, PAPER);
  }

  /* ---------- 찍은 손바닥 위에 판독한 선을 덧그리기 ---------- */
  function drawTrace(canvas, photo, res, flip) {
    const W = 600, H = 840, s = 2;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const X = (gx) => (flip ? W - gx * s : gx * s);
    if (photo) {
      ctx.save();
      if (flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
      ctx.drawImage(photo, 0, 0, W, H);
      ctx.restore();
      ctx.fillStyle = 'rgba(26,20,16,0.28)';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#2A221C'; ctx.fillRect(0, 0, W, H);
      ctx.save();
      if (flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
      drawHandFigure(ctx, 0, 0, s, { outlineWidth: 0, skin: '#E9BE98' });
      ctx.restore();
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // 짧은 선(결혼선·여행선·재물선)은 위치만 작은 금색 눈금으로 표시
    const M = res.marks;
    if (M) {
      const tick = (x1, y1, x2, y2) => {
        ctx.strokeStyle = 'rgba(26,20,16,0.9)'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(X(x1), y1 * s); ctx.lineTo(X(x2), y2 * s); ctx.stroke();
        ctx.strokeStyle = '#F2C230'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(X(x1), y1 * s); ctx.lineTo(X(x2), y2 * s); ctx.stroke();
      };
      for (const y of (M.marriage && M.marriage.at) || []) tick(64, y, 86, y);
      for (const y of (M.travel && M.travel.at) || []) tick(62, y, 88, y);
      for (const x of (M.money && M.money.at) || []) tick(x, 220, x, 236);
    }
    const labels = [];
    for (const id of ['mars', 'mercury', 'sun', 'fate', 'heart', 'head', 'life']) {
      const l = res.lines[id];
      if (!l || !l.found || l.pts.length < 2) continue;
      const minor = id === 'mars' || id === 'mercury' || id === 'sun';
      const path = () => { ctx.beginPath(); l.pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), p[1] * s) : ctx.moveTo(X(p[0]), p[1] * s))); };
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = minor ? 8 : 11; path(); ctx.stroke();
      ctx.strokeStyle = LINE_INFO[id].color; ctx.lineWidth = minor ? 4 : 6; path(); ctx.stroke();
      const n = l.pts.length;
      const at = id === 'life' ? l.pts[Math.floor(n * 0.62)] : id === 'fate' ? l.pts[Math.floor(n * 0.3)]
        : id === 'mars' ? l.pts[Math.floor(n * 0.45)] : id === 'mercury' ? l.pts[0] : l.pts[n - 1];
      labels.push({ id, minor, x: X(at[0]), y: at[1] * s });
    }
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    for (const lb of labels) {
      ctx.font = font(lb.minor ? 24 : 30, F_COMIC);
      const name = LINE_INFO[lb.id].name, tw = ctx.measureText(name).width + (lb.minor ? 18 : 26), th = lb.minor ? 34 : 42;
      let bx = lb.x - tw / 2, by = lb.y - 54;
      if (lb.id === 'life') { bx = lb.x + (flip ? -tw - 14 : 14); by = lb.y - 20; }
      if (lb.id === 'fate') { bx = lb.x + (flip ? 14 : -tw - 14); by = lb.y - 20; }
      if (lb.id === 'head') { by = lb.y + 14; }
      if (lb.id === 'sun') { by = lb.y - th - 8; }
      if (lb.id === 'mercury') { by = lb.y + 8; }
      if (lb.id === 'mars') { bx = lb.x + (flip ? -tw - 10 : 10); by = lb.y - th / 2; }
      bx = Math.max(8, Math.min(W - tw - 8, bx));
      rrect(ctx, bx, by, tw, th, 10);
      ctx.fillStyle = LINE_INFO[lb.id].color; ctx.fill();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(name, bx + tw / 2, by + th / 2 + 1);
    }
  }

  /* ---------- 공유용 결과 이미지 (1080×1920) ---------- */
  function drawShareCard(res, linkText, ex) {
    const car = CARS.find((c) => c.id === res.carId);
    const tiles = ex ? ['watch', 'outfit', 'pcolor', 'food', 'shop', 'region'].map((k) => ex.items[k]).filter(Boolean) : [];
    const extraH = tiles.length ? 270 : 0;
    const W = 1080, H = 1920 + extraH;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    dots(ctx, 0, 0, W, H, 34, 3, 'rgba(255,255,255,0.16)');
    ctx.strokeStyle = RED; ctx.lineWidth = 10; ctx.strokeRect(22, 22, W - 44, H - 44);
    ctx.lineWidth = 3; ctx.strokeRect(40, 40, W - 80, H - 80);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = INK; ctx.font = font(50, F_DISPLAY);
    ctx.fillText(CONFIG.GAME_TITLE, W / 2, 104);
    ctx.fillStyle = RED;
    const ns = fitFont(ctx, car.name, 900, 124, F_DISPLAY, 60);
    ctx.font = font(ns, F_DISPLAY);
    ctx.fillText(car.name, W / 2, 208);
    ctx.fillStyle = INK;
    const ts = fitFont(ctx, car.tagline, 920, 36, F_COMIC, 24);
    ctx.font = font(ts, F_COMIC);
    ctx.fillText(car.tagline, W / 2, 294);
    // 자동차
    ctx.save();
    rrect(ctx, 82, 330, 916, 348, 28);
    ctx.clip();
    sunburst(ctx, 540, 560, 760, 28, RICE, '#FFF1C2');
    ctx.fillStyle = 'rgba(242,194,48,0.55)';
    ctx.beginPath(); ctx.ellipse(540, 626, 380, 36, 0, 0, Math.PI * 2); ctx.fill();
    drawCar(ctx, car.body, 520, 630, 3.0, car.color);
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 6; rrect(ctx, 82, 330, 916, 348, 28); ctx.stroke();
    // 싱크로율 도장
    ctx.save();
    ctx.translate(886, 420); ctx.rotate(0.2);
    ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(0, 0, 78, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = RICE; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 68, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = RICE; ctx.font = font(26, F_COMIC); ctx.fillText('싱크로율', 0, -30);
    ctx.font = font(60, F_DISPLAY); ctx.fillText(res.sync + '%', 0, 16);
    ctx.restore();
    ctx.fillStyle = INK; ctx.font = font(30, F_COMIC); ctx.textAlign = 'left';
    ctx.fillText(car.kind, 110, 366);
    // 이유 두 줄
    res.reasons.forEach((r, i) => {
      const y = 700 + i * 90;
      stamp(ctx, 82, y, 150, 76, r.name, String(r.score), i ? 2 : -2);
      ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const s = fitFont(ctx, r.short, 740, 38, F_COMIC, 26);
      ctx.font = font(s, F_COMIC);
      ctx.fillText(r.short, 254, y + 24);
      ctx.fillStyle = RED;
      const s2 = fitFont(ctx, '→ ' + r.fit, 740, 29, F_COMIC, 20);
      ctx.font = font(s2, F_COMIC);
      ctx.fillText('→ ' + r.fit, 254, y + 62);
    });
    // 자동차 말고 고른 최애 여섯 가지
    if (tiles.length) {
      ctx.textBaseline = 'middle';
      tiles.forEach((t, i) => {
        const col = i % 3, row = Math.floor(i / 3), tw = 296, th = 116, x = 82 + col * (tw + 14), y = 892 + row * (th + 14);
        rrect(ctx, x, y, tw, th, 16);
        ctx.fillStyle = RICE; ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
        ctx.textAlign = 'left';
        ctx.fillStyle = RED; ctx.font = font(22, F_COMIC);
        ctx.fillText(t.label, x + 16, y + 24);
        ctx.fillStyle = INK;
        let size = 28, lines;
        for (;;) {
          ctx.font = font(size, F_COMIC);
          lines = wrap(ctx, t.short || t.name, tw - 32);
          if (lines.length <= 2 || size <= 18) break;
          size -= 2;
        }
        lines = lines.slice(0, 2);
        const lh = size * 1.22, y0 = y + 74 - ((lines.length - 1) * lh) / 2;
        lines.forEach((l, k) => ctx.fillText(l, x + 16, y0 + k * lh));
      });
    }
    // 만화 2×2
    const pc = document.createElement('canvas');
    const ps = 450, gx = 82, gy = 890 + extraH, gap = 16;
    for (let n = 1; n <= 4; n++) {
      drawPanel(pc, n, res);
      const col = (n - 1) % 2, row = Math.floor((n - 1) / 2);
      ctx.drawImage(pc, gx + col * (ps + gap), gy + row * (ps + gap), ps, ps);
    }
    // 바닥글
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = INK; ctx.font = font(34, F_COMIC);
    ctx.fillText(linkText ? '나도 손금 찍고 최애 찾기 → ' + linkText : '나도 손금 찍고 최애 찾기', W / 2, 1846 + extraH);
    return c;
  }

  /* 촬영 화면의 손바닥 가이드 */
  /* kind: 'palm'(손바닥만) | 'nail'(손톱 한 개) | 그 밖(손 전체). box 는 palm·손 전체일 때 손 도형 상자, nail 일 때 손톱 상자 */
  function nailShape(g, grow) {
    const x = -grow, y = -grow, w = 100 + grow * 2, h = 125 + grow * 2, rt = 44 + grow, rb = 30 + grow;
    g.beginPath();
    g.moveTo(x + rt, y); g.lineTo(x + w - rt, y); g.quadraticCurveTo(x + w, y, x + w, y + rt);
    g.lineTo(x + w, y + h - rb); g.quadraticCurveTo(x + w, y + h, x + w - rb, y + h);
    g.lineTo(x + rb, y + h); g.quadraticCurveTo(x, y + h, x, y + h - rb);
    g.lineTo(x, y + rt); g.quadraticCurveTo(x, y, x + rt, y);
    g.closePath(); g.fill();
  }
  function drawGuide(canvas, box, state, flip, kind) {
    const nail = kind === 'nail';
    const UW = nail ? 100 : HAND.W, UH = nail ? 125 : HAND.H;
    const shape = nail ? nailShape : kind === 'palm' ? fillPalmShape : fillHandShape;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(16,12,9,0.62)';
    ctx.fillRect(0, 0, W, H);
    const place = () => {
      ctx.translate(box.x, box.y);
      ctx.scale(box.w / UW, box.h / UH);
      if (flip) { ctx.translate(UW, 0); ctx.scale(-1, 1); }
    };
    // 손 모양만큼 구멍을 낸다
    ctx.save(); place();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    shape(ctx, 0);
    ctx.restore();
    // 윤곽선 (손 모양 바깥 테두리만 남긴다)
    const o = document.createElement('canvas');
    o.width = W; o.height = H;
    const g = o.getContext('2d');
    g.save();
    g.translate(box.x, box.y); g.scale(box.w / UW, box.h / UH);
    if (flip) { g.translate(UW, 0); g.scale(-1, 1); }
    g.fillStyle = state === 'ok' ? '#5BE49B' : state === 'warn' ? '#FFD23F' : '#FFFFFF';
    shape(g, nail ? 4 : 3);
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    shape(g, 0);
    g.restore();
    ctx.drawImage(o, 0, 0);
  }

  /* 첫 화면 그림: 손금이 차례로 그려지고, 작은 자동차가 생명선을 따라 달린다. t = 0~1 */
  const INTRO_LINES = {
    heart: [[58, 246], [120, 250], [188, 214]],
    head: [[224, 250], [165, 262], [82, 302]],
    life: [[224, 250], [138, 268], [170, 404]],
    fate: [[150, 402], [146, 330], [150, 236]],
  };
  const bez = (b, t) => {
    const m = 1 - t;
    return [m * m * b[0][0] + 2 * m * t * b[1][0] + t * t * b[2][0], m * m * b[0][1] + 2 * m * t * b[1][1] + t * t * b[2][1]];
  };
  function drawIntro(canvas, t) {
    const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.arc(W / 2, H / 2 + 6, H / 2 - 8, 0, Math.PI * 2); ctx.clip();
    sunburst(ctx, W / 2, H / 2 + 6, H, 24, PAPER_HI, '#FBE38A');
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(W / 2, H / 2 + 6, H / 2 - 8, 0, Math.PI * 2); ctx.stroke();
    const s = 1.2, ox = W / 2 - 150 * s - 6, oy = 24;
    drawHandFigure(ctx, ox, oy, s, { outlineWidth: 5, skin: RICE });
    const seg = { heart: [0, 0.28], head: [0.22, 0.5], life: [0.45, 0.86], fate: [0.8, 1] };
    ctx.save();
    ctx.translate(ox, oy); ctx.scale(s, s);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = RED; ctx.lineWidth = 4.2;
    let carAt = null;
    for (const id of ['heart', 'head', 'life', 'fate']) {
      const [a, b] = seg[id], k = Math.max(0, Math.min(1, (t - a) / (b - a)));
      if (k <= 0) continue;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const p = bez(INTRO_LINES[id], (i / 40) * k);
        if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      }
      ctx.stroke();
      if (id === 'life') {
        const p = bez(INTRO_LINES.life, k), q = bez(INTRO_LINES.life, Math.max(0, k - 0.03));
        carAt = { x: p[0], y: p[1], a: Math.atan2(p[1] - q[1], p[0] - q[0]) };
      }
    }
    ctx.restore();
    if (carAt) {
      ctx.save();
      ctx.translate(ox + carAt.x * s, oy + carAt.y * s);
      let a = carAt.a, mirror = false;
      if (Math.cos(a) < 0) { mirror = true; a = a - Math.PI; }
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      ctx.rotate(Math.max(-0.5, Math.min(0.5, a)));       // 너무 기울어 뒤집혀 보이지 않게
      if (mirror) ctx.scale(-1, 1);
      drawCar(ctx, 'hatch', 0, 14, 0.42, '#D7263D', { noShadow: true });
      ctx.restore();
    }
  }

  return { drawCar, drawSage, drawPanel, drawHero, drawTrace, drawShareCard, drawGuide, drawIntro, fonts: { F_DISPLAY, F_COMIC, F_BODY } };
})();
