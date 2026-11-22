'use strict';
/* ============================================================
 * 06. 기회 관리 (다시 하기 규칙)
 *
 *   · 첫 판독은 무료.
 *   · 그다음부터는 내 공유 링크로 "다른 사람이 실제로 접속"해야 기회가 1회 생긴다.
 *   · 이렇게 얻은 기회는 하루(한국 시간)에 CONFIG.DAILY_BONUS_LIMIT 번만 쓸 수 있다.
 *
 * 친구의 접속은 서버(server.js)만 확인할 수 있습니다.
 *   server 모드  : 같은 주소에서 server.js 가 응답하면 자동으로 켜짐. 서버가 기회를 관리.
 *   local 모드   : 서버가 없을 때(파일로 직접 열었거나 미리보기). 기회는 이 브라우저에만 기록되고,
 *                  친구 접속은 확인할 수 없어 "미리보기용 가정" 버튼으로만 흐름을 확인할 수 있음.
 * ============================================================ */

const Store = (function () {
  const mem = {};
  let ok = true;
  try { localStorage.setItem('palmcar:t', '1'); localStorage.removeItem('palmcar:t'); } catch (e) { ok = false; }
  return {
    get(k, d) {
      try {
        const v = k in mem ? mem[k] : ok ? localStorage.getItem('palmcar:' + k) : null;
        return v == null ? d : JSON.parse(v);
      } catch (e) { return d; }
    },
    set(k, v) {
      const s = JSON.stringify(v);
      try { if (ok) { localStorage.setItem('palmcar:' + k, s); delete mem[k]; return; } } catch (e) { /* 저장 공간 부족 등 */ }
      mem[k] = s;
    },
  };
})();

const Chances = (function () {
  const S = { mode: 'local', uid: null, code: null, st: null, ref: null, visit: null, sandbox: false };
  const today = () => new Date(Date.now() + CONFIG.TZ_OFFSET_MIN * 60000).toISOString().slice(0, 10);

  function rid(n) {
    const a = 'abcdefghjkmnpqrstuvwxyz23456789';
    const r = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(r);
    let s = '';
    for (let i = 0; i < n; i++) s += a[r[i] % a.length];
    return s;
  }
  function localData() {
    const d = Store.get('chances', { freeUsed: false, credits: 0, day: '', used: 0 });
    if (d.day !== today()) { d.day = today(); d.used = 0; }
    return d;
  }
  function view(d) {
    const free = CONFIG.FIRST_PLAY_FREE && !d.freeUsed;
    const bonus = d.credits > 0 && d.used < CONFIG.DAILY_BONUS_LIMIT;
    return {
      freeUsed: !!d.freeUsed, credits: d.credits, usedToday: d.used, limit: CONFIG.DAILY_BONUS_LIMIT,
      canPlay: free || bonus,
      why: free ? 'free' : bonus ? 'bonus' : d.credits > 0 ? 'daily_limit' : 'need_visit',
    };
  }
  async function api(path, body) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 4000);
    try {
      const r = await fetch(CONFIG.API_BASE + '/' + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: ctl.signal,
      });
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json();
      if (!j || j.game !== 'palmcar') throw new Error('unexpected response');
      return j;
    } finally { clearTimeout(timer); }
  }

  const OPEN = { freeUsed: false, credits: 0, usedToday: 0, limit: 0, canPlay: true, why: 'open' };
  async function init() {
    S.sandbox = !!(window.claude && typeof window.claude.use === 'function');
    if (!CONFIG.GATE_ENABLED) { S.mode = 'open'; S.st = OPEN; return S; }      // 제한 없음: 서버도 초대 코드도 쓰지 않는다
    S.uid = Store.get('uid', null);
    if (!S.uid) { S.uid = rid(20); Store.set('uid', S.uid); }
    // 공유 링크로 들어왔는지: ?r=코드 (또는 #r-코드)
    let ref = null;
    try { ref = new URLSearchParams(location.search).get('r'); } catch (e) { /* 무시 */ }
    if (!ref) { const m = /^#r-([a-z0-9]{4,16})$/.exec(location.hash || ''); if (m) ref = m[1]; }
    if (ref && !/^[a-z0-9]{4,16}$/.test(ref)) ref = null;
    S.ref = ref;
    if (/^https?:$/.test(location.protocol) && !S.sandbox) {
      try {
        const j = await api('hello', { uid: S.uid, ref: ref });
        S.mode = 'server'; S.st = j.state; S.code = j.state.code; S.visit = j.visit || null;
      } catch (e) { S.mode = 'local'; }
    }
    if (S.mode === 'local') {
      S.code = Store.get('code', null);
      if (!S.code) { S.code = rid(8); Store.set('code', S.code); }
      S.st = view(localData());
      S.visit = ref && ref !== S.code ? 'unverified' : null;
    }
    return S;
  }

  /* 판독 1회를 쓴다 (또렷한 결과가 나왔을 때만 호출) */
  async function consume() {
    if (S.mode === 'open') return true;
    if (S.mode === 'server') {
      try { const j = await api('play', { uid: S.uid }); S.st = j.state; return j.ok; } catch (e) { return true; }
    }
    const d = localData();
    if (CONFIG.FIRST_PLAY_FREE && !d.freeUsed) d.freeUsed = true;
    else if (d.credits > 0 && d.used < CONFIG.DAILY_BONUS_LIMIT) { d.credits--; d.used++; }
    Store.set('chances', d);
    S.st = view(d);
    return true;
  }
  async function refresh() {
    if (S.mode === 'open') return S.st;
    if (S.mode === 'server') {
      try { const j = await api('state', { uid: S.uid }); S.st = j.state; } catch (e) { /* 다음에 다시 */ }
    } else S.st = view(localData());
    return S.st;
  }
  /* 미리보기 전용: 친구가 접속했다고 가정 */
  function simulateVisit() {
    if (S.mode !== 'local') return S.st;
    const d = localData();
    d.credits++;
    Store.set('chances', d);
    S.st = view(d);
    return S.st;
  }
  function shareLink() {
    if (S.sandbox || !/^https?:$/.test(location.protocol)) return null;
    if (S.mode === 'open') return location.origin + location.pathname;
    return location.origin + location.pathname + '?r=' + S.code;
  }

  return { S, init, consume, refresh, simulateVisit, shareLink };
})();
