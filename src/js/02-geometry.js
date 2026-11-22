'use strict';
/* ============================================================
 * 02. 손 가이드 도형
 * 가로 300 × 세로 420 단위의 상자 안에 그린 "펼친 손바닥".
 * 기준 방향: 손가락이 위, 엄지가 오른쪽(= 오른손 손바닥을 마주 본 모습).
 * 화면 가이드, 정렬 검사용 마스크, 만화 속 손 그림이 모두 이 도형 하나를 씁니다.
 * ============================================================ */

const HAND = {
  W: 300,
  H: 420,
  // 손가락: 뿌리(bx,by) → 끝(tx,ty), 굵기 w
  fingers: [
    { id: 'pinky',  bx: 72,  by: 218, tx: 50,  ty: 116, w: 30 },
    { id: 'ring',   bx: 108, by: 204, tx: 97,  ty: 60,  w: 32 },
    { id: 'middle', bx: 146, by: 198, tx: 146, ty: 36,  w: 34 },
    { id: 'index',  bx: 185, by: 204, tx: 197, ty: 62,  w: 32 },
    { id: 'thumb',  bx: 212, by: 312, tx: 276, ty: 216, w: 38 },
  ],
  // 손바닥 다각형 (모서리는 둥글게 처리)
  palm: [[57, 226], [72, 198], [204, 190], [222, 216], [232, 264], [226, 332], [204, 408], [96, 408], [62, 342]],
  // 손금을 읽는 영역 (손가락 뿌리 ~ 손목)
  palmBox: { x: 55, y: 188, w: 178, h: 222 },
  // 피부색 표본을 뜨는 손바닥 한가운데
  center: { x: 142, y: 306, r: 22 },
};

/* 손 도형을 현재 좌표계에 채워 그린다. grow > 0 이면 그만큼 바깥으로 부풀린다(윤곽선·여유 영역용). */
function fillHandShape(ctx, grow) {
  grow = grow || 0;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle;
  for (const f of HAND.fingers) {
    ctx.lineWidth = f.w + grow * 2;
    ctx.beginPath();
    ctx.moveTo(f.bx, f.by);
    ctx.lineTo(f.tx, f.ty);
    ctx.stroke();
  }
  const p = HAND.palm;
  ctx.beginPath();
  const n = p.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m = mid(p[n - 1], p[0]);
  ctx.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n];
    m = mid(a, b);
    ctx.quadraticCurveTo(a[0], a[1], m[0], m[1]);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 14 + grow * 2; // 손바닥 모서리를 살짝 통통하게
  ctx.stroke();
  ctx.restore();
}

/* 손 그림(살색 + 먹선 윤곽). 만화와 결과 카드에서 사용 */
function drawHandFigure(ctx, x, y, scale, opts) {
  opts = opts || {};
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (opts.flip) { ctx.translate(HAND.W, 0); ctx.scale(-1, 1); }
  ctx.fillStyle = opts.outline || '#1A1410';
  fillHandShape(ctx, (opts.outlineWidth || 4) / scale);
  ctx.fillStyle = opts.skin || '#F6CFA9';
  fillHandShape(ctx, 0);
  ctx.restore();
}
