#!/usr/bin/env node
'use strict';
/* ============================================================
 * 손금은 이미 알고 있다. — 게임 서버 (설치할 패키지 없음, Node.js 18 이상)
 *
 *   실행:  node server.js          →  http://localhost:8787
 *   포트:  PORT=3000 node server.js
 *
 * 하는 일
 *   1) index.html 을 내려준다.
 *   2) "다시 하기" 기회를 관리한다.
 *        · 첫 판독은 무료
 *        · 그다음부터는 내 공유 링크(?r=코드)로 다른 사람이 실제로 접속해야 기회 +1
 *        · 그렇게 얻은 기회는 하루(한국 시간)에 DAILY_BONUS_LIMIT 번만 쓸 수 있다
 *
 * 손바닥 사진은 서버로 오지 않는다. 서버가 받는 것은 브라우저가 만든 임의의 ID뿐이다.
 * 기록은 data.json 한 파일에 저장된다(이용자가 아주 많아지면 DB로 바꾸는 것을 권장).
 * ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CFG = {
  PORT: Number(process.env.PORT) || 8787,
  DATA_FILE: process.env.DATA_FILE || path.join(__dirname, 'data.json'),
  INDEX_FILE: process.env.INDEX_FILE || path.join(__dirname, 'index.html'),
  FIRST_PLAY_FREE: true,
  DAILY_BONUS_LIMIT: 1,          // 공유로 얻은 기회를 하루에 몇 번 쓸 수 있는지 (index.html 의 CONFIG 와 같게)
  TZ_OFFSET_MIN: 540,            // 하루의 기준: 한국 시간
  MAX_CREDITS: 30,               // 모아둘 수 있는 기회의 상한
  MAX_VISITS_PER_IP: 5,          // 같은 링크에 대해 같은 IP에서 하루에 인정하는 접속 수 (혼자 여러 번 접속하는 것 방지)
  RATE_PER_MIN: 120,             // IP당 분당 요청 수 제한
  TRUST_PROXY: process.env.TRUST_PROXY === '1',   // 프록시(nginx 등) 뒤에 둘 때 1
};

/* ---------- 저장소 ---------- */
let db = { users: {}, codes: {}, seen: {} };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(CFG.DATA_FILE, 'utf8'))); } catch (e) { /* 첫 실행 */ }
let saveTimer = null;
function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const tmp = CFG.DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, CFG.DATA_FILE);
}
function save() { if (!saveTimer) saveTimer = setTimeout(saveNow, 400); }
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { saveNow(); } catch (e) { /* 무시 */ } process.exit(0); });

/* ---------- 규칙 ---------- */
const today = () => new Date(Date.now() + CFG.TZ_OFFSET_MIN * 60000).toISOString().slice(0, 10);
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
function newCode() {
  for (;;) {
    const b = crypto.randomBytes(8);
    let s = '';
    for (let i = 0; i < 8; i++) s += ALPHA[b[i] % ALPHA.length];
    if (!db.codes[s]) return s;
  }
}
function user(uid) {
  let u = db.users[uid];
  if (!u) {
    u = db.users[uid] = { code: newCode(), freeUsed: false, credits: 0, day: '', used: 0, visits: 0, created: Date.now() };
    db.codes[u.code] = uid;
    save();
  }
  if (u.day !== today()) { u.day = today(); u.used = 0; }
  return u;
}
function view(u) {
  const free = CFG.FIRST_PLAY_FREE && !u.freeUsed;
  const bonus = u.credits > 0 && u.used < CFG.DAILY_BONUS_LIMIT;
  return {
    code: u.code, freeUsed: u.freeUsed, credits: u.credits, usedToday: u.used, limit: CFG.DAILY_BONUS_LIMIT, visits: u.visits,
    canPlay: free || bonus,
    why: free ? 'free' : bonus ? 'bonus' : u.credits > 0 ? 'daily_limit' : 'need_visit',
  };
}
const ipDay = new Map();      // "날짜|코드|IP" → 인정한 접속 수
function recordVisit(code, visitorUid, ip) {
  const ownerUid = db.codes[code];
  if (!ownerUid) return 'unknown';
  if (ownerUid === visitorUid) return 'self';
  const seen = db.seen[code] || (db.seen[code] = {});
  if (seen[visitorUid]) return 'dup';
  const key = today() + '|' + code + '|' + ip;
  const n = ipDay.get(key) || 0;
  if (n >= CFG.MAX_VISITS_PER_IP) return 'limited';
  ipDay.set(key, n + 1);
  seen[visitorUid] = Date.now();
  const owner = user(ownerUid);
  owner.visits++;
  owner.credits = Math.min(CFG.MAX_CREDITS, owner.credits + 1);
  save();
  return 'counted';
}
setInterval(() => { const t = today(); for (const k of ipDay.keys()) if (!k.startsWith(t)) ipDay.delete(k); }, 3600e3).unref();

/* ---------- HTTP ---------- */
const hits = new Map();
setInterval(() => hits.clear(), 60e3).unref();
function clientIp(req) {
  if (CFG.TRUST_PROXY && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  return req.socket.remoteAddress || '';
}
function send(res, status, obj) {
  const body = JSON.stringify(Object.assign({ game: 'palmcar' }, obj));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 2048) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
const UID = /^[a-z0-9]{12,40}$/, CODE = /^[a-z0-9]{4,16}$/;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = clientIp(req);
  try {
    if (url.pathname.startsWith('/api/')) {
      const n = (hits.get(ip) || 0) + 1;
      hits.set(ip, n);
      if (n > CFG.RATE_PER_MIN) return send(res, 429, { ok: false, error: 'rate_limited' });
      if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' });
      const body = await readJson(req);
      const uid = String(body.uid || '');
      if (!UID.test(uid)) return send(res, 400, { ok: false, error: 'bad_uid' });
      const u = user(uid);
      if (url.pathname === '/api/hello') {
        const ref = body.ref == null ? null : String(body.ref);
        const visit = ref && CODE.test(ref) ? recordVisit(ref, uid, ip) : null;
        return send(res, 200, { ok: true, state: view(u), visit });
      }
      if (url.pathname === '/api/state') return send(res, 200, { ok: true, state: view(u) });
      if (url.pathname === '/api/play') {
        let used = null;
        if (CFG.FIRST_PLAY_FREE && !u.freeUsed) { u.freeUsed = true; used = 'free'; }
        else if (u.credits > 0 && u.used < CFG.DAILY_BONUS_LIMIT) { u.credits--; u.used++; used = 'bonus'; }
        if (used) save();
        return send(res, 200, { ok: !!used, used, error: used ? undefined : 'no_chance', state: view(u) });
      }
      return send(res, 404, { ok: false, error: 'not_found' });
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const html = fs.readFileSync(CFG.INDEX_FILE);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(html);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  } catch (e) {
    send(res, 400, { ok: false, error: 'bad_request' });
  }
});

server.listen(CFG.PORT, () => {
  console.log(`손금은 이미 알고 있다. → http://localhost:${CFG.PORT}`);
  console.log('카메라는 https 주소(또는 localhost)에서만 열립니다. 실제 서비스는 https 뒤에 두세요.');
});
