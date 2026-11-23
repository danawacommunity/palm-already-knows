'use strict';
/* ============================================================
 * 07. 화면 흐름: 시작 → 촬영 → 판독 → 결과 (→ 공유 → 다시 하기)
 * ============================================================ */

const App = (function () {
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  const el = {};
  const ST = {
    screen: 'intro',
    mode: 'choose',          // choose(두 버튼) | live(PC 웹캠) | adjust(직접 맞추기)
    stream: null, facing: 'environment', mirrored: false,
    guideFlip: false,        // 가이드의 엄지가 왼쪽이면 true
    flipManual: false,       // "가이드 좌우 뒤집기"를 눌렀는지
    photoFlip: null,         // 사진에서 자동으로 찾은 손의 방향
    profile: { hand: 'right', gender: null, age: null },
    guideState: 'idle',
    step: 'palm',            // palm(손바닥) → nail(엄지 손톱)
    nail: undefined,         // undefined: 아직 안 찍음 · null: 건너뜀 · 객체: 판독 결과
    palmOnly: false,         // 손바닥만 틀에 맞춘 사진인가
    box: null,               // 가이드 상자 (촬영 화면 기준 CSS px)
    photo: { url: null, iw: 0, ih: 0, tx: 0, ty: 0, z: 1, zMin: 0.1, zMax: 5 },
    hand: null, captureFlip: false, fromPhoto: false,
    result: null, lastPhoto: null, cardBlob: null,
    pollTimer: null, busy: false, toastTimer: null, gateFrom: null,
  };

  /* ---------- 공통 ---------- */
  function show(name) {
    if (ST.screen === 'capture' && name !== 'capture') stopCamera();
    ST.screen = name;
    for (const s of ['intro', 'setup', 'capture', 'scan', 'result']) $('s-' + s).hidden = s !== name;
    window.scrollTo(0, 0);
  }
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(ST.toastTimer);
    ST.toastTimer = setTimeout(() => { el.toast.hidden = true; }, 3200);
  }
  function fontsReady(text) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const t = (text || '') + ' 0123456789%?!…·→~';
    const jobs = ['32px "Jua"', '48px "Yeon Sung"'].map((f) => document.fonts.load(f, t).catch(() => {}));
    return Promise.race([Promise.all(jobs), wait(2500)]);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* 아래 방법으로 */ }
    try {
      const i = el.gateLink;
      const was = i.value;
      i.value = text; i.select();
      const ok = document.execCommand('copy');
      i.value = was;
      return ok;
    } catch (e) { return false; }
  }

  /* ---------- 시작 화면 ---------- */
  function animateIntro() {
    if (reduceMotion) { Draw.drawIntro(el.introArt, 1); return; }
    const t0 = performance.now(), dur = 3600;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      Draw.drawIntro(el.introArt, k);
      if (k < 1 && ST.screen === 'intro') requestAnimationFrame(tick);
      else Draw.drawIntro(el.introArt, 1);
    };
    Draw.drawIntro(el.introArt, 1);     // 움직임이 시작되기 전에도 완성된 그림이 보이도록
    setTimeout(() => requestAnimationFrame(tick), 500);
  }
  function chanceText(st) {
    if (st.why === 'open') return '몇 번이든 무료로 볼 수 있어요.';
    if (st.why === 'free') return '첫 판독은 무료예요.';
    if (st.why === 'bonus') return '친구가 접속해서 다시 보기 기회가 생겼어요!';
    if (st.why === 'daily_limit') return '오늘의 다시 보기는 이미 썼어요. 내일 또 볼 수 있어요.';
    return '다시 보려면 결과를 공유하고, 친구가 실제로 접속해야 해요.';
  }
  function updateIntro() {
    const S = Chances.S, st = S.st;
    el.btnStart.textContent = st.canPlay ? '손금 찍으러 가기' : '다시 보기 기회 얻기';
    el.chanceLine.textContent = chanceText(st);
    const msg = {
      counted: '친구의 초대로 오셨네요! 접속이 확인되어 친구에게 다시 보기 기회가 전달됐어요.',
      dup: '이미 확인된 접속이에요. 손금 한번 보고 가세요.',
      limited: '초대 링크로 오셨네요. 손금 한번 보고 가세요.',
      self: '내 링크로는 기회가 생기지 않아요. 친구에게 보내주세요.',
      unverified: '친구의 초대로 오셨네요! 지금은 미리보기 모드라 접속이 집계되지는 않아요.',
    }[S.visit];
    el.refBanner.hidden = !msg;
    if (msg) el.refBanner.textContent = msg;
    el.modeLine.hidden = S.mode !== 'local';
    if (S.mode === 'local') el.modeLine.textContent = '미리보기 모드 · 친구 접속 확인 서버가 연결되어 있지 않습니다.';
    const last = Store.get('last', null);
    el.btnLast.hidden = !(last && last.res && last.res.v >= 1);
  }
  async function onStart() {
    await Chances.refresh();
    if (Chances.S.st.canPlay) goSetup(); else openGate(el.btnStart);
  }

  /* ---------- 찍기 전 선택: 손 · 성별 · 나잇대 ---------- */
  function profileText(p) {
    return [PROFILE_LABEL.hand[p.hand], PROFILE_LABEL.gender[p.gender], PROFILE_LABEL.age[p.age]].filter(Boolean).join(' · ');
  }
  function syncSetup() {
    const p = ST.profile;
    for (const r of document.querySelectorAll('input[name="hand"]')) r.checked = r.value === p.hand;
    for (const r of document.querySelectorAll('input[name="gender"]')) r.checked = r.value === p.gender;
    for (const r of document.querySelectorAll('input[name="age"]')) r.checked = Number(r.value) === p.age;
    const ready = !!p.gender && !!p.age;
    el.btnSetupGo.disabled = !ready;
    el.setupNote.textContent = ready ? `${profileText(p)} 기준으로 봐 드릴게요.` : '성별과 나잇대를 골라주세요.';
  }
  function setProfile(key, value) {
    ST.profile[key] = value;
    Store.set('profile', ST.profile);
    syncSetup();
    if (key !== 'hand') return;
    ST.flipManual = false;
    refreshFlip();
  }
  function goSetup() {
    syncSetup();
    show('setup');
  }

  /* ---------- 촬영 화면 ----------
   * 촬영 화면에 들어오면 곧바로 화면 안 카메라를 켜고, 그 위에 손 모양 틀(가이드)을 겹쳐 보여 준다.
   *   live   : 화면 안 카메라 + 손 모양 틀 (휴대폰·PC 공통, https 에서만)
   *   choose : 화면 안 카메라를 쓸 수 없을 때의 두 버튼(기본 카메라로 찍기 / 앨범에서 고르기)
   *   adjust : 자동으로 손을 못 찾았을 때 여는 "직접 맞추기"(사진 위에 손 모양 틀)
   */
  function layoutStage() {
    const w = el.stage.clientWidth, h = el.stage.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.guide.width = Math.round(w * dpr);
    el.guide.height = Math.round(h * dpr);
    if (ST.step === 'nail') {
      // 손톱 한 개가 들어갈 작은 틀
      const bw = w * 0.5, bh = bw * 1.25;
      ST.box = { x: (w - bw) / 2, y: (h - bh) / 2 + h * 0.02, w: bw, h: bh };
    } else {
      // 손바닥만 화면에 크게: 손 도형 상자는 화면보다 크게 잡고, 그중 손바닥 부분이 가운데에 오게 한다(손가락은 화면 밖이어도 된다)
      const PBX = HAND.palmBox;
      let bw = w * 0.8 * HAND.W / PBX.w, bh = bw * HAND.H / HAND.W;
      const maxH = h * 0.74 * HAND.H / PBX.h;
      if (bh > maxH) { bh = maxH; bw = bh * HAND.W / HAND.H; }
      ST.box = { x: w / 2 - bw / 2, y: h * 0.53 - (PBX.y + PBX.h / 2) / HAND.H * bh, w: bw, h: bh };
    }
    paintGuide();
  }
  function paintGuide() {
    if (ST.mode === 'choose' || !ST.box || !el.guide.width) return;
    const k = el.guide.width / el.stage.clientWidth, b = ST.box;
    // 카메라 화면이 거울처럼 보일 때는 틀도 좌우를 바꿔 그린다
    const nail = ST.step === 'nail';
    const flip = nail ? false : ST.mode === 'live' ? (ST.profile.hand === 'left') !== ST.mirrored : ST.guideFlip;
    Draw.drawGuide(el.guide, { x: b.x * k, y: b.y * k, w: b.w * k, h: b.h * k }, ST.guideState, flip, nail ? 'nail' : 'palm');
  }
  /* 틀의 엄지 방향: 사진에서 찾은 방향이 있으면 그대로, 없으면 고른 손대로 */
  function refreshFlip() {
    const base = ST.photoFlip != null ? ST.photoFlip : ST.profile.hand === 'left';
    ST.guideFlip = ST.flipManual ? !base : base;
    paintGuide();
  }
  function setHint(text, ok) {
    el.hint.textContent = text;
    el.hint.hidden = !text;
    el.hint.classList.toggle('ok', !!ok);
  }
  function setMode(mode) {
    ST.mode = mode;
    el.chooseBox.hidden = mode !== 'choose';
    el.stageBox.hidden = mode === 'choose';
    el.video.hidden = mode !== 'live';
    el.photo.hidden = mode !== 'adjust';
    el.guide.hidden = mode === 'choose';
    el.liveControls.hidden = mode !== 'live';
    el.photoControls.hidden = mode !== 'adjust';
    el.stage.classList.toggle('photo', mode === 'adjust');
    const nail = ST.step === 'nail';
    el.capTitle.textContent = nail ? (mode === 'live' ? '이번엔 엄지 손톱을 틀에 맞춰주세요' : '이번엔 엄지 손톱을 찍어주세요')
      : mode === 'choose' ? '손바닥을 쫙 펴서 찍어주세요' : '손바닥을 쫙 펴서 틀에 맞춰주세요';
    el.tipsPalm.hidden = nail; el.tipsNail.hidden = !nail;
    el.chooseNote.textContent = nail ? '엄지 손톱이 사진 한가운데에 크게 오도록 찍어주세요.' : '이 화면에서는 틀을 띄울 수 없어, 사진에서 손바닥을 알아서 찾아 읽습니다.';
    el.btnSkipNail.hidden = !nail;
    if (mode === 'live') { ST.guideState = 'idle'; setHint(liveHint('none')); }
    if (mode !== 'live') stopAlign();
    if (mode === 'adjust') setHint('사진을 끌고 크기를 맞춰 틀 안에 넣어주세요');
  }
  const handName = () => (ST.profile.hand === 'left' ? '왼손' : '오른손');
  function liveHint(h) {
    return h === 'ok' ? '좋아요! 지금 찍으세요' : h === 'dark' ? '너무 어두워요. 밝은 곳에서'
      : h === 'thumb' ? `엄지 방향이 달라요. ${handName()} 손바닥이 맞나요?` : h === 'far' ? '손이 틀보다 커요. 조금 멀리'
      : `${handName()} 손바닥을 쫙 펴서 틀에 채워주세요`;
  }
  /* 틀 안의 영상을 원본(거울 반전 전) 좌표로 옮긴다 */
  function liveBox() {
    const v = el.video, b = ST.box, sw = el.stage.clientWidth, sh = el.stage.clientHeight;
    if (!b || !v.videoWidth || !sw) return null;
    const k = Math.max(sw / v.videoWidth, sh / v.videoHeight), dx = (sw - v.videoWidth * k) / 2, dy = (sh - v.videoHeight * k) / 2;
    const x = ST.mirrored ? v.videoWidth - (b.x + b.w - dx) / k : (b.x - dx) / k;
    return { x, y: (b.y - dy) / k, w: b.w / k, h: b.h / k };
  }
  /* 찍기 전: 틀에 잘 맞았는지 수시로 보고 틀 색과 안내를 바꾼다 */
  let alignTimer = 0, alignCanvas = null;
  function stopAlign() { if (alignTimer) { clearInterval(alignTimer); alignTimer = 0; } }
  function startAlign() {
    stopAlign();
    if (ST.step === 'nail') { ST.guideState = 'idle'; setHint('엄지 손톱 한 개를 틀 안에 크게'); paintGuide(); return; }
    alignTimer = setInterval(() => {
      if (ST.mode !== 'live' || ST.screen !== 'capture') { stopAlign(); return; }
      const g = liveBox();
      if (!g) return;
      if (!alignCanvas) { alignCanvas = document.createElement('canvas'); alignCanvas.width = 75; alignCanvas.height = 105; }
      const c = alignCanvas.getContext('2d', { willReadFrequently: true });
      c.save();
      if (ST.profile.hand === 'left') { c.translate(75, 0); c.scale(-1, 1); }       // 엄지가 오른쪽인 기준 방향으로
      c.drawImage(el.video, g.x, g.y, g.w, g.h, 0, 0, 75, 105);
      c.restore();
      let q = null;
      try { q = PalmReader.quickAlign(alignCanvas, true); } catch (e) { q = null; }
      if (!q) return;
      const state = q.hint === 'ok' ? 'ok' : q.hint === 'none' ? 'idle' : 'warn';
      setHint(liveHint(q.hint), q.hint === 'ok');
      if (state !== ST.guideState) { ST.guideState = state; paintGuide(); }
    }, 350);
  }
  function stopCamera() {
    stopAlign();
    if (ST.stream) { ST.stream.getTracks().forEach((t) => t.stop()); ST.stream = null; }
    try { el.video.srcObject = null; } catch (e) { /* 무시 */ }
  }
  /* 화면 안 카메라를 쓸 수 있는가 (미리보기 화면·http·권한 거절 뒤에는 쓸 수 없다) */
  function canLive() {
    return !ST.camBlocked && !Chances.S.sandbox && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
  /* "카메라로 찍기": 화면 안 카메라(틀 있음)를 먼저, 안 되면 기기의 기본 카메라로 */
  function onCamButton() {
    if (!canLive()) { el.fileShoot.click(); return; }
    startCamera();
  }
  async function startCamera() {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: ST.facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (ST.screen !== 'capture') { stream.getTracks().forEach((t) => t.stop()); return; }
      ST.stream = stream;
      el.video.srcObject = stream;
      setMode('live');
      await el.video.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      const set = track && track.getSettings ? track.getSettings() : {};
      ST.mirrored = set.facingMode ? set.facingMode === 'user' : true;      // 웹캠은 거울처럼 보여 준다
      el.video.classList.toggle('mirror', ST.mirrored);
      layoutStage();
      startAlign();
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        el.btnSwitch.style.visibility = devs.filter((d) => d.kind === 'videoinput').length > 1 ? 'visible' : 'hidden';
      } catch (e) { el.btnSwitch.style.visibility = 'hidden'; }
    } catch (e) {
      ST.camBlocked = true;
      setMode('choose');
      toast('화면 안 카메라를 켤 수 없어요. 아래 버튼으로 찍거나 골라주세요.');
    }
  }
  function shootLive() {
    const v = el.video;
    if (ST.busy) return;
    if (!v.videoWidth) { toast('카메라가 아직 준비되지 않았어요. 잠시 후 다시 눌러주세요.'); return; }
    if (ST.step === 'nail') {
      const g = liveBox(), nc = document.createElement('canvas');
      nc.width = 200; nc.height = 250;
      if (!g) return;
      nc.getContext('2d', { willReadFrequently: true }).drawImage(v, g.x, g.y, g.w, g.h, 0, 0, 200, 250);
      readNail(nc);
      return;
    }
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);        // 저장은 거울 반전 없이, 실제 모습 그대로
    const gb = liveBox();                         // 찍는 순간 틀이 놓여 있던 자리
    // 카메라는 끄지 않는다: 손바닥을 바로 판별한 뒤 같은 카메라로 손톱까지 찍는다(권한을 다시 묻지 않게)
    ST.shotLive = true;
    ST.busy = true;
    setHint('손바닥을 확인하는 중…');
    c.toBlob((blob) => { if (blob) setPhoto(URL.createObjectURL(blob), { guide: gb }); else ST.busy = false; }, 'image/jpeg', 0.95);
  }

  /* 사진 받기 → 손바닥을 자동으로 찾아 바로 판독 */
  function setPhoto(url, opt) {
    const img = el.photo;
    img.onload = () => {
      const p = ST.photo;
      if (p.url && p.url !== url) URL.revokeObjectURL(p.url);
      p.url = url; p.iw = img.naturalWidth; p.ih = img.naturalHeight;
      img.style.width = p.iw + 'px';
      img.style.height = p.ih + 'px';
      ST.flipManual = false;
      ST.photoFlip = null;
      if (opt && opt.adjust) enterAdjust(); else autoRead(!opt || opt.allowRotate !== false, opt && opt.guide);
    };
    img.onerror = () => { ST.busy = false; URL.revokeObjectURL(url); toast('사진을 열 수 없어요. 다른 사진을 골라주세요.'); };
    img.src = url;
  }
  function loadPhoto(file) {
    if (!file) return;
    if (ST.step === 'nail') { loadNail(file); return; }
    ST.shotLive = false;
    setPhoto(URL.createObjectURL(file));
  }

  /* ---------- 손톱 ---------- */
  /* 손바닥 사진을 받은 다음: 손톱을 아직 안 찍었으면 손톱 단계로, 찍었거나 건너뛰었으면 판독으로 */
  /* 손바닥 사진을 받으면 그 자리에서 판별한다.
   *   잘 찍혔으면 "잘 찍혔어요"라고 알리고 손톱 단계로, 아니면 이유를 알리고 손바닥을 다시 찍게 한다. */
  function afterPalm(preFail) {
    ST.busy = false;
    let a = null;
    if (!preFail) { try { a = PalmReader.analyze(ST.hand, { palmOnly: ST.palmOnly }); } catch (e) { a = { ok: false, reason: 'faint', quality: {} }; } }
    ST.analysis = a;
    const live = !!ST.stream && ST.screen === 'capture';
    if (preFail || !a.ok) {
      if (live && ST.shotLive && ST.mode === 'live') {      // 카메라 화면에 그대로 머물며 다시 찍기
        const r = RETAKE[preFail || a.reason] || RETAKE.faint;
        stopAlign();
        ST.guideState = 'warn'; paintGuide();
        setHint('다시 찍어주세요 · ' + r.title);
        toast(r.tip);
        setTimeout(() => { if (ST.screen === 'capture' && ST.mode === 'live' && ST.step === 'palm' && ST.stream) startAlign(); }, 3000);
        return;
      }
      runScan(preFail || null);
      return;
    }
    if (ST.nail !== undefined) { runScan(null); return; }
    if (live) {
      if (ST.mode !== 'live') setMode('live');
      stopAlign();
      ST.guideState = 'ok'; paintGuide();
      setHint('손바닥이 잘 찍혔어요! 다음은 손톱이에요', true);
      ST.busy = true;
      setTimeout(() => {
        ST.busy = false;
        if (ST.screen !== 'capture') return;
        ST.step = 'nail';
        setMode('live');
        layoutStage();
        startAlign();
      }, 1500);
      return;
    }
    ST.step = 'nail';
    if (ST.screen !== 'capture') show('capture');
    setMode('choose');
    toast('손바닥이 잘 찍혔어요! 이번엔 엄지 손톱을 찍어주세요.');
    if (canLive()) startCamera();
  }
  function readNail(canvas) {
    let r = null;
    try { r = PalmReader.analyzeNail(canvas); } catch (e) { r = null; }
    if (!r || !r.ok) {
      toast(r && r.reason === 'dark' ? '너무 어두워요. 밝은 곳에서 다시 찍어주세요.' : '손톱이 잘 보이지 않아요. 손톱 한 개를 크게 맞춰 다시 찍어주세요.');
      return;
    }
    ST.nail = r;
    stopCamera();
    runScan(null);
  }
  /* 틀 없이 받은 손톱 사진: 한가운데를 손톱으로 본다 */
  function loadNail(file) {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth, ih = img.naturalHeight, s = 0.5 * Math.min(iw, ih * 0.8), c = document.createElement('canvas');
      c.width = 200; c.height = 250;
      c.getContext('2d', { willReadFrequently: true }).drawImage(img, (iw - s) / 2, (ih - s * 1.25) / 2, s, s * 1.25, 0, 0, 200, 250);
      URL.revokeObjectURL(url);
      readNail(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('사진을 열 수 없어요. 다른 사진을 골라주세요.'); };
    img.src = url;
  }
  function skipNail() {
    ST.nail = null;
    stopCamera();
    runScan(null);
  }
  function autoRead(allowRotate, guide) {
    const p = ST.photo, left = ST.profile.hand === 'left';
    let f = null;
    try { f = PalmReader.autoFit(el.photo, p.iw, p.ih, left, guide ? false : allowRotate); } catch (e) { f = null; }
    if (guide) {
      // 틀에 맞춰 찍은 사진: 자동으로 찾은 자리가 틀 근처일 때만 그 자리로 다듬고, 아니면 틀 자리를 그대로 쓴다
      const gs = guide.w / HAND.W;
      const near = f && f.ok && f.s > gs * 0.6 && f.s < gs * 1.6
        && Math.abs((f.ox + HAND.W * f.s / 2) - (guide.x + guide.w / 2)) < guide.w * 0.4
        && Math.abs((f.oy + HAND.H * f.s / 2) - (guide.y + guide.h / 2)) < guide.h * 0.4;
      if (!near) f = { ok: true, flip: left, s: gs, ox: guide.x, oy: guide.y };
    }
    ST.palmOnly = !!guide;
    if (f && f.rot) { rotatePhoto(f.rot, false); return; }       // 옆으로 누운 사진은 세운 뒤 다시 찾는다
    ST.fromPhoto = true;
    if (f && f.ok) {
      ST.hand = PalmReader.cropByFit(el.photo, p.iw, p.ih, f);
      ST.captureFlip = !!f.flip;
      afterPalm(null);
    } else {
      ST.hand = null;
      ST.captureFlip = false;
      afterPalm('no_palm');
    }
  }
  function rotatePhoto(quarter, adjust) {
    const p = ST.photo;
    if (!p.url) return;
    const k = Math.min(1, 2000 / Math.max(p.iw, p.ih)), w = Math.round(p.iw * k), h = Math.round(p.ih * k);
    const c = document.createElement('canvas'), odd = quarter % 2 === 1;
    c.width = odd ? h : w; c.height = odd ? w : h;
    const g = c.getContext('2d');
    g.translate(c.width / 2, c.height / 2);
    g.rotate(quarter * Math.PI / 2);
    g.drawImage(el.photo, -w / 2, -h / 2, w, h);
    c.toBlob((blob) => { if (blob) setPhoto(URL.createObjectURL(blob), adjust ? { adjust: true } : { allowRotate: false }); }, 'image/jpeg', 0.92);
  }

  /* 직접 맞추기: 자동으로 손을 못 찾았을 때만 */
  function enterAdjust() {
    ST.step = 'palm';
    if (ST.screen !== 'capture') show('capture');
    setMode('adjust');
    layoutStage();
    const p = ST.photo, b = ST.box, sw = el.stage.clientWidth, sh = el.stage.clientHeight, cover = Math.max(sw / p.iw, sh / p.ih);
    p.zMin = cover * 0.4; p.zMax = cover * 6; p.z = cover;
    p.tx = (sw - p.iw * p.z) / 2; p.ty = (sh - p.ih * p.z) / 2;
    let f = null;
    try { f = PalmReader.autoFit(el.photo, p.iw, p.ih, ST.profile.hand === 'left', false); } catch (e) { f = null; }
    if (f && f.s && f.score > 0.3 && b) {             // 어느 정도 찾았으면 그 자리에서 시작
      const z = (b.w / HAND.W) / f.s;
      p.zMin = Math.min(p.zMin, z * 0.6); p.zMax = Math.max(p.zMax, z * 2.5);
      p.z = z; p.tx = b.x - f.ox * z; p.ty = b.y - f.oy * z;
      ST.photoFlip = f.flip;
    }
    applyPhoto();
    ST.guideState = 'idle';
    refreshFlip();
  }
  function applyPhoto() {
    const p = ST.photo;
    el.photo.style.transform = `translate(${p.tx}px, ${p.ty}px) scale(${p.z})`;
    el.zoom.value = String(Math.max(0, Math.min(100, Math.round(100 * Math.log(p.z / p.zMin) / Math.log(p.zMax / p.zMin)))));
  }
  function zoomAt(cx, cy, z) {
    const p = ST.photo;
    z = Math.max(p.zMin, Math.min(p.zMax, z));
    p.tx = cx - (cx - p.tx) * (z / p.z);
    p.ty = cy - (cy - p.ty) * (z / p.z);
    p.z = z;
    applyPhoto();
  }
  /* 틀 아래의 사진을 그대로 잘라 "엄지가 오른쪽"인 기준 방향으로 dst 에 그린다 */
  function grabHand(dst) {
    const W = dst.width, H = dst.height, b = ST.box, p = ST.photo;
    if (ST.mode !== 'adjust' || !b || !p.url) return false;
    const ctx = dst.getContext('2d', { willReadFrequently: true });
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (ST.guideFlip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.scale(W / b.w, H / b.h);
    ctx.translate(p.tx - b.x, p.ty - b.y);
    ctx.scale(p.z, p.z);
    ctx.drawImage(el.photo, 0, 0, p.iw, p.ih);
    ctx.restore();
    return true;
  }
  function bindPhotoGestures() {
    const pts = new Map();
    let lastDist = 0, lastMid = null;
    const local = (e) => { const r = el.stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    el.stage.addEventListener('pointerdown', (e) => {
      if (ST.mode !== 'adjust') return;
      try { el.stage.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      pts.set(e.pointerId, local(e));
      lastDist = 0; lastMid = null;
    });
    el.stage.addEventListener('pointermove', (e) => {
      if (ST.mode !== 'adjust' || !pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId), cur = local(e);
      pts.set(e.pointerId, cur);
      const p = ST.photo;
      if (pts.size === 1) {
        p.tx += cur.x - prev.x; p.ty += cur.y - prev.y;
        applyPhoto();
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (lastDist && lastMid) {
          p.tx += mid.x - lastMid.x; p.ty += mid.y - lastMid.y;
          zoomAt(mid.x, mid.y, p.z * (dist / lastDist));
        }
        lastDist = dist; lastMid = mid;
      }
    });
    const end = (e) => { pts.delete(e.pointerId); lastDist = 0; lastMid = null; };
    el.stage.addEventListener('pointerup', end);
    el.stage.addEventListener('pointercancel', end);
    el.stage.addEventListener('wheel', (e) => {
      if (ST.mode !== 'adjust') return;
      e.preventDefault();
      const c = local(e);
      zoomAt(c.x, c.y, ST.photo.z * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
    }, { passive: false });
    el.zoom.addEventListener('input', () => {
      const p = ST.photo, z = p.zMin * Math.pow(p.zMax / p.zMin, Number(el.zoom.value) / 100);
      zoomAt(el.stage.clientWidth / 2, el.stage.clientHeight / 2, z);
    });
  }

  function goCapture(fresh) {
    ST.step = 'palm';
    if (fresh) ST.nail = undefined;      // 새 판: 손톱도 다시 찍는다 (손바닥만 다시 찍을 때는 손톱을 그대로 둔다)
    show('capture');
    setMode('choose');
    if (canLive()) startCamera();      // 틀이 있는 화면 안 카메라를 곧바로 연다
  }
  function doCapture() {           // 직접 맞추기에서 "이대로 판독"
    if (ST.busy) return;
    const c = document.createElement('canvas');
    c.width = 600; c.height = 840;
    if (!grabHand(c)) return;
    ST.hand = c;
    ST.captureFlip = ST.guideFlip;
    ST.fromPhoto = true;
    ST.palmOnly = true;
    afterPalm(null);
  }

  /* ---------- 판독 ---------- */
  async function runScan(preFail) {
    ST.busy = true;
    show('scan');
    const steps = [...el.scanSteps.children];
    steps.forEach((li) => li.classList.remove('on', 'fail'));
    el.retake.hidden = true;
    el.scanSteps.hidden = false;
    el.scanTitle.textContent = '손금을 읽는 중…';
    el.scanStage.classList.remove('done');
    const sc = el.scanCanvas.getContext('2d');
    sc.save();
    sc.fillStyle = '#14100C';
    sc.fillRect(0, 0, 600, 840);
    if (ST.hand) {
      if (ST.captureFlip) { sc.translate(600, 0); sc.scale(-1, 1); }
      sc.drawImage(ST.hand, 0, 0);
    } else if (ST.photo.url) {       // 손을 못 찾았을 때는 받은 사진을 그대로 보여 준다
      const p = ST.photo, k = Math.min(600 / p.iw, 840 / p.ih);
      sc.drawImage(el.photo, (600 - p.iw * k) / 2, (840 - p.ih * k) / 2, p.iw * k, p.ih * k);
    }
    sc.restore();
    await wait(90);
    let a;
    if (preFail) a = { ok: false, reason: preFail, quality: {} };
    else if (ST.analysis) a = ST.analysis;      // 찍은 직후에 이미 판별해 둔 결과
    else { try { a = PalmReader.analyze(ST.hand, { palmOnly: ST.palmOnly }); } catch (e) { a = { ok: false, reason: 'faint', quality: {} }; } }
    if (a.ok) a.nail = ST.nail || null;
    const failAt = a.ok ? -1 : ({ no_palm: 0, no_hand: 0, misaligned: 0, thumb: 0, background: 0, too_dark: 1, too_bright: 1, faint: 2 })[a.reason];
    const stepMs = reduceMotion ? 40 : 430;
    for (let i = 0; i < steps.length; i++) {
      await wait(stepMs);
      if (i === failAt) { steps[i].classList.add('fail'); break; }
      steps[i].classList.add('on');
    }
    el.scanStage.classList.add('done');
    if (!a.ok) {
      const r = RETAKE[a.reason] || RETAKE.faint;
      el.scanTitle.textContent = '판독하지 못했어요';
      el.scanSteps.hidden = true;
      el.retakeTitle.textContent = r.title;
      el.retakeTip.textContent = r.tip;
      el.btnAdjust.hidden = !(ST.photo.url && failAt === 0);     // 손을 못 찾은 경우에만 직접 맞추기를 권한다
      el.retake.hidden = false;
      ST.busy = false;
      el.btnRetake.focus();
      return;
    }
    const res = Fortune.read(a, ST.profile);
    res.flip = ST.captureFlip;
    await Chances.consume();
    ST.result = res;
    ST.lastPhoto = ST.hand;
    try {
      const t = document.createElement('canvas');
      t.width = 300; t.height = 420;
      t.getContext('2d').drawImage(ST.hand, 0, 0, 300, 420);
      Store.set('last', { res, thumb: t.toDataURL('image/jpeg', 0.72) });
    } catch (e) { Store.set('last', { res, thumb: null }); }
    await renderResult();
    show('result');
    ST.busy = false;
  }

  /* ---------- 결과 ---------- */
  function node(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  async function renderResult() {
    const res = ST.result, car = CARS.find((c) => c.id === res.carId);
    el.carName.textContent = car.name;
    el.carName.className = 'pick-name';
    el.carKind.textContent = car.kind;
    el.carSync.textContent = `싱크로율 ${res.sync}%`;
    el.carTag.textContent = car.tagline;
    el.carLink.textContent = '';
    el.carLink.append(danawaBtn(DANAWA.car(car.name), '다나와자동차 가격·견적 보기', '트림별 가격 · 견적 확인'));
    const ex = Fortune.extras(res);
    ST.extras = ex;
    el.profileLine.textContent = `${profileText(ex.profile)} 기준 · ${ex.profile.hand === 'left' ? '왼손은 타고난 기질을 봅니다.' : '오른손은 살아오며 만든 기질을 봅니다.'}`;
    renderPicks(ex);
    const hl = ['watch', 'outfit', 'pcolor', 'food', 'shop', 'region'].map((k) => ex.items[k].label + (ex.items[k].short || ex.items[k].name)).join(' ');
    const allText = [car.name, car.tagline, car.kind, CONFIG.GAME_TITLE, hl, '당신의 최애는 두구두구 싱크로율 나도 손금 찍고 최애 자동차 찾기 생명선 두뇌선 감정선 운명선 자동차 말고도']
      .concat(Object.values(res.script), res.reasons.map((r) => r.name + r.short + r.fit)).join(' ');
    await fontsReady(allText);
    Draw.drawHero(el.heroCanvas, car);
    el.heroCanvas.setAttribute('aria-label', `${car.kind} 그림: ${car.name}`);
    const alt = [
      `1컷: 도사가 돋보기로 손바닥을 보며 말한다. "${res.script.p1}"`,
      `2컷: 도사가 손가락을 세우며 말한다. "${res.script.p2}"`,
      `3컷: 도사가 천에 가려진 자동차를 가리키며 말한다. "${res.script.p3}"`,
      `4컷: 당신의 최애는? ${car.name}, ${['watch', 'brand', 'food', 'tv', 'region'].map((k) => ex.items[k].label + ' ' + (ex.items[k].short || ex.items[k].name)).join(', ')}`,
    ];
    for (let n = 1; n <= 4; n++) {
      Draw.drawPanel(el['panel' + n], n, res, ex);
      el['panel' + n].setAttribute('aria-label', alt[n - 1]);
    }
    Draw.drawTrace(el.traceCanvas, ST.lastPhoto, res, !!res.flip);
    // 선별 판독 요약
    el.lineList.textContent = '';
    for (const id of ['life', 'head', 'heart', 'fate']) {
      const li = node('li');
      const tag = node('span', 'tag', LINE_INFO[id].name);
      tag.style.background = LINE_INFO[id].color;
      const body = node('div');
      body.append(node('p', 'line-mean', Fortune.lineMeaning(id, res.lines)), node('p', 'line-measure', Fortune.lineSummary(id, res.lines[id])));
      li.append(tag, body);
      el.lineList.append(li);
    }
    // 종합 풀이
    el.overall.textContent = '';
    for (const r of Fortune.overall(res)) {
      const li = node('li');
      li.append(node('span', 'tag', r.tag), node('span', null, r.text));
      el.overall.append(li);
    }
    renderReading(res);
    // 이유
    el.reasons.textContent = '';
    for (const r of res.reasons) {
      const card = node('div', 'card reason');
      const stamp = node('div', 'stamp', r.name);
      stamp.append(node('b', null, String(r.score)));
      card.append(stamp, node('h3', null, r.short), node('p', null, r.detail), node('p', null, r.plus ? `${r.meaning} ${r.plus}` : r.meaning), node('p', 'fit', `→ ${car.name}: ${r.fit}`));
      el.reasons.append(card);
    }
    if (res.balanced) {
      el.reasons.prepend(node('p', 'note', '여섯 성향의 점수가 서로 비슷한 "육각형 손금"이에요. 그래서 뭐든 두루 잘하는 차를 골랐습니다.'));
    }
    // 성향 막대
    el.bars.textContent = '';
    TRAITS.forEach((t, i) => {
      const row = node('div', 'bar-row');
      const track = node('div', 'track');
      const me = node('i'), carMark = node('u');
      me.style.width = res.scores[i] + '%';
      carMark.style.left = car.profile[i] + '%';
      carMark.title = `${car.name}: ${car.profile[i]}`;
      track.append(me, carMark);
      row.append(node('span', null, t.name), track, node('span', 'num', String(res.scores[i])));
      el.bars.append(row);
    });
    updateAgain();
    // 공유 이미지는 미리 만들어 둔다 (공유 창은 버튼을 누른 직후에만 열 수 있어서)
    ST.cardBlob = null;
    makeCard();
  }
  /* 자동차 말고 함께 추천하는 것들: 묶음마다 제목을 달아 한 번에 모두 보여 준다 */
  /* 다나와로 가는 버튼 (새 창) */
  function danawaBtn(href, main, sub, big) {
    const a = node('a', 'dnw' + (big ? ' dnw-big' : ''));
    a.href = href; a.target = '_blank'; a.rel = 'noopener';
    a.append(node('span', 'dnw-logo', 'danawa'), node('b', null, main), node('span', 'dnw-sub', sub), node('span', 'dnw-arrow', '→'));
    return a;
  }
  function renderPicks(ex) {
    el.pickNav.textContent = '';
    el.pickPanels.textContent = '';
    const carJump = node('button', 'tab', '자동차');
    carJump.type = 'button';
    carJump.addEventListener('click', () => $('grp-car').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }));
    el.pickNav.append(carJump);
    for (const g of ex.groups) {
      const sec = node('section', 'pickgroup'), card = node('div', 'card picks');
      sec.id = 'grp-' + g.id;
      sec.append(node('h3', 'pick-head', g.tab), card);
      const whyBox = node('div', 'whybox card');
      whyBox.append(node('h4', 'why-head', g.whyTitle));
      for (const t of g.whyText) whyBox.append(node('p', null, t));
      sec.append(whyBox);
      for (const it of g.items) {
        const row = node('div', 'pick'), body = node('div');
        const why = node('p', 'pick-why', it.why + ' ');
        if (it.chip) why.append(node('span', 'why-chip', it.chip));
        body.append(node('p', 'pick-name', it.name), why);
        if (it.swatches) {
          const ul = node('ul', 'swatches');
          for (const [hex, name] of it.swatches) {
            const li = node('li'), dot = node('i');
            dot.style.background = hex;
            li.append(dot, node('span', null, name));
            ul.append(li);
          }
          body.append(ul);
        }
        if (it.bars) {
          const box = node('div', 'minibars');
          for (const b of it.bars) {
            const line = node('div'), track = node('b'), fill = node('i');
            fill.style.width = b.pct + '%';
            track.append(fill);
            line.append(node('span', null, b.label), track, node('span', null, String(b.pct)));
            box.append(line);
          }
          body.append(box);
        }
        row.append(node('div', 'pick-cat', it.label), body);
        if (DANAWA.has(it.cat)) {
          const food = it.cat === 'food', brand = it.cat === 'brand' || it.cat === 'egear';
          row.append(danawaBtn(DANAWA.product(it.cat, it.name),
            food ? '다나와에서 장보기' : brand ? '다나와에서 상품 보기' : '다나와 최저가 보기',
            food ? '간편식·재료 최저가' : brand ? '상품정보 확인' : '가격비교 · 상품정보 확인'));
        }
        card.append(row);
      }
      el.pickPanels.append(sec);
      // 긴 목록이라 묶음으로 바로 내려가는 버튼을 둔다
      const jump = node('button', 'tab', g.tab);
      jump.type = 'button';
      jump.addEventListener('click', () => sec.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }));
      el.pickNav.append(jump);
    }
  }
  /* 주요선 말고 더 읽은 것들 */
  function renderReading(res) {
    el.moreRead.textContent = '';
    const all = Fortune.reading(res), nailSec = all.find((s) => s.title === '손톱'), secs = all.filter((s) => s !== nailSec);
    // 손톱 풀이는 따로 한 장으로
    el.nailList.textContent = '';
    for (const r of (nailSec ? nailSec.rows : [{ tag: '손톱', color: '#1A1410', text: '손톱 사진을 찍지 않아 풀이가 없습니다. "다시 하기"에서 엄지 손톱까지 찍으면 모양·빛깔·반달을 풀어 드립니다.' }])) {
      const li = node('li'), tag = node('span', 'tag', r.tag), txt = node('span', null, r.text + ' ');
      tag.style.background = r.color;
      for (const t of r.plus || []) txt.append(node('span', 'plus-chip', '+' + t));
      li.append(tag, txt);
      el.nailList.append(li);
    }
    el.nailNote.textContent = nailSec ? nailSec.note : '';
    el.nailNote.hidden = !nailSec;
    el.moreRead.hidden = !secs.length;
    for (const sec of secs) {
      el.moreRead.append(node('h3', 'read-head', sec.title));
      const ul = node('ul', 'linelist');
      for (const r of sec.rows) {
        const li = node('li'), tag = node('span', 'tag', r.tag), txt = node('span', null, r.text + ' ');
        tag.style.background = r.color;
        for (const t of r.plus || []) txt.append(node('span', 'plus-chip', '+' + t));
        li.append(tag, txt);
        ul.append(li);
      }
      el.moreRead.append(ul);
      if (sec.note) el.moreRead.append(node('p', 'fine left', sec.note));
    }
  }
  function updateAgain() {
    const st = Chances.S.st;
    el.againLine.hidden = st.why === 'open';
    el.againLine.textContent = st.canPlay ? '다시 보기 기회가 있어요.' : '친구가 내 링크로 실제 접속하면 다시 볼 수 있어요. (하루 1번)';
  }
  function makeCard() {
    return new Promise((resolve) => {
      if (ST.cardBlob) { resolve(ST.cardBlob); return; }
      try {
        const link = Chances.shareLink();
        const c = Draw.drawShareCard(ST.result, link ? location.host + (location.pathname.length > 1 ? location.pathname : '') : '', ST.extras || Fortune.extras(ST.result));
        c.toBlob((b) => { ST.cardBlob = b; resolve(b); }, 'image/png');
      } catch (e) { resolve(null); }
    });
  }
  async function saveBlob(blob) {
    const name = 'palm-car-result.png';
    if (Chances.S.sandbox) {
      try {
        const d = await window.claude.use('downloads');
        if (!d) return false;
        await d.save({ filename: name, data: blob });
        return true;
      } catch (e) { return false; }
    }
    try {
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    } catch (e) { return false; }
  }
  async function shareImage() {
    if (!ST.result) return;
    const blob = ST.cardBlob || await makeCard();
    if (!blob) { toast('이미지를 만들지 못했어요. 잠시 후 다시 시도해주세요.'); return; }
    const car = CARS.find((c) => c.id === ST.result.carId), link = Chances.shareLink();
    const text = `내 손금이 고른 최애 자동차는 ${car.name}! 너도 손금 찍어봐.` + (link ? ' ' + link : '');
    if (!Chances.S.sandbox) {
      try {
        const file = new File([blob], 'palm-car-result.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: CONFIG.GAME_TITLE, text });
          return;
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return;      // 사용자가 공유 창을 닫음
      }
    }
    // 공유 창을 쓸 수 없는 환경: 이미지를 저장하고 링크를 복사해 준다
    const saved = await saveBlob(blob);
    const copied = link ? await copyText(link) : false;
    if (saved && copied) toast('이미지를 저장하고 링크를 복사했어요. 친구에게 함께 보내주세요.');
    else if (saved) toast('이미지를 저장했어요. 친구에게 보내주세요.');
    else if (copied) toast('링크를 복사했어요. 친구에게 보내주세요.');
    else toast('이 화면에서는 저장할 수 없어요.');
  }
  async function saveImage() {
    const blob = ST.cardBlob || await makeCard();
    if (!blob) return;
    toast((await saveBlob(blob)) ? '이미지를 저장했어요.' : '저장하지 못했어요.');
  }
  async function copyLink() {
    const link = Chances.shareLink();
    if (!link) { toast('공유 링크는 웹 서버에 올린 뒤에 만들어져요.'); return; }
    toast((await copyText(link)) ? '링크를 복사했어요.' : '복사하지 못했어요. 링크를 길게 눌러 복사해주세요.');
  }
  function openLast() {
    const last = Store.get('last', null);
    if (!last || !last.res) return;
    ST.result = last.res;
    const go = async () => { await renderResult(); show('result'); };
    if (last.thumb) {
      const img = new Image();
      img.onload = () => { ST.lastPhoto = img; go(); };
      img.onerror = () => { ST.lastPhoto = null; go(); };
      img.src = last.thumb;
    } else { ST.lastPhoto = null; go(); }
  }

  /* ---------- 다시 하기 안내 창 ---------- */
  function gateStatus() {
    const S = Chances.S, st = S.st;
    el.gateGo.hidden = !st.canPlay;
    if (st.canPlay) el.gateStatus.textContent = '친구가 접속했어요! 다시 보기 기회가 도착했습니다.';
    else if (st.why === 'daily_limit') el.gateStatus.textContent = `오늘의 다시 보기는 이미 썼어요. 내일 다시 쓸 수 있어요. (모아둔 기회 ${st.credits}회)`;
    else el.gateStatus.textContent = S.mode === 'server' ? '친구의 접속을 기다리는 중…' : '아직 확인된 친구 접속이 없어요.';
  }
  function openGate(from) {
    ST.gateFrom = from || null;
    const S = Chances.S, link = Chances.shareLink();
    el.gateLinkBox.hidden = !link;
    if (link) el.gateLink.value = link;
    el.gateShare.hidden = ST.noSave || (!ST.result && !Store.get('last', null));
    el.gatePreview.hidden = S.mode !== 'local';
    gateStatus();
    el.gate.hidden = false;
    el.gateCard.focus();
    clearInterval(ST.pollTimer);
    if (S.mode === 'server') {
      ST.pollTimer = setInterval(async () => {
        const before = S.st.canPlay;
        await Chances.refresh();
        gateStatus();
        if (!before && S.st.canPlay) toast('친구가 접속했어요! 기회가 도착했습니다.');
      }, CONFIG.POLL_MS);
    }
  }
  function closeGate() {
    clearInterval(ST.pollTimer);
    el.gate.hidden = true;
    updateIntro();
    updateAgain();
    if (ST.gateFrom) ST.gateFrom.focus();
  }
  async function gateShare() {
    if (!ST.result) {
      const last = Store.get('last', null);
      if (!last || !last.res) return;
      ST.result = last.res;
      ST.extras = Fortune.extras(ST.result);
      await fontsReady(CONFIG.GAME_TITLE);
    }
    shareImage();
  }

  /* ---------- 시작 ---------- */
  async function init() {
    for (const id of ['introArt', 'refBanner', 'btnStart', 'chanceLine', 'btnLast', 'modeLine', 'btnBack', 'capTitle', 'chooseBox', 'stageBox', 'btnCam', 'btnCancelCam', 'tipsPalm', 'tipsNail', 'chooseNote', 'btnSkipNail',
      'stage', 'video', 'photo', 'guide', 'hint',
      'liveControls', 'photoControls', 'btnShoot', 'btnSwitch', 'zoom', 'btnUsePhoto', 'btnRotate', 'btnFlipHand', 'filePick', 'fileShoot', 'btnSetupBack', 'btnSetupGo', 'setupNote',
      'scanTitle', 'scanCanvas', 'scanSteps', 'retake', 'retakeTitle', 'retakeTip', 'btnRetake', 'btnAdjust',
      'carName', 'carKind', 'carSync', 'carTag', 'carLink', 'heroCanvas', 'profileLine', 'pickNav', 'pickPanels', 'panel1', 'panel2', 'panel3', 'panel4', 'traceCanvas', 'lineList', 'overall', 'nailList', 'nailNote', 'moreRead', 'reasons', 'bars',
      'btnShare', 'btnSave', 'btnCopy', 'btnAgain', 'againLine',
      'gate', 'gateClose', 'gateLinkBox', 'gateLink', 'gateCopy', 'gateShare', 'gateStatus', 'gateGo', 'gatePreview', 'gateSim', 'toast']) el[id] = $(id);
    el.scanStage = el.scanCanvas.parentElement;
    el.gateCard = el.gate.querySelector('.gatecard');

    el.btnStart.addEventListener('click', onStart);
    el.btnLast.addEventListener('click', openLast);
    el.btnBack.addEventListener('click', goSetup);
    el.btnCam.addEventListener('click', onCamButton);
    el.btnShoot.addEventListener('click', shootLive);
    el.btnCancelCam.addEventListener('click', () => el.filePick.click());      // 카메라 화면의 "앨범" 버튼
    el.btnUsePhoto.addEventListener('click', doCapture);
    el.btnSwitch.addEventListener('click', () => { ST.facing = ST.facing === 'environment' ? 'user' : 'environment'; startCamera(); });
    el.btnFlipHand.addEventListener('click', () => { ST.flipManual = !ST.flipManual; refreshFlip(); });
    el.btnRotate.addEventListener('click', () => rotatePhoto(1, true));
    el.btnSetupBack.addEventListener('click', () => { show('intro'); updateIntro(); });
    el.btnSetupGo.addEventListener('click', () => goCapture(true));
    el.btnSkipNail.addEventListener('click', skipNail);
    document.addEventListener('change', (e) => {
      const t = e.target;
      if (!t || t.type !== 'radio') return;
      if (t.name === 'hand') setProfile('hand', t.value);
      else if (t.name === 'gender') setProfile('gender', t.value);
      else if (t.name === 'age') setProfile('age', Number(t.value));
    });
    ST.profile = Object.assign(ST.profile, Store.get('profile', {}));
    syncSetup();
    for (const input of [el.filePick, el.fileShoot]) {
      input.addEventListener('change', () => { loadPhoto(input.files && input.files[0]); input.value = ''; });
    }
    el.btnRetake.addEventListener('click', () => goCapture(false));
    el.btnAdjust.addEventListener('click', () => { if (ST.photo.url) { show('capture'); enterAdjust(); } });
    el.btnShare.addEventListener('click', shareImage);
    el.btnSave.addEventListener('click', saveImage);
    el.btnCopy.addEventListener('click', copyLink);
    el.btnAgain.addEventListener('click', async () => {
      await Chances.refresh();
      if (Chances.S.st.canPlay) goSetup(); else openGate(el.btnAgain);
    });
    el.gateClose.addEventListener('click', closeGate);
    el.gate.addEventListener('click', (e) => { if (e.target === el.gate) closeGate(); });
    el.gateCopy.addEventListener('click', copyLink);
    el.gateShare.addEventListener('click', gateShare);
    el.gateGo.addEventListener('click', () => { closeGate(); goSetup(); });
    el.gateSim.addEventListener('click', () => { Chances.simulateVisit(); gateStatus(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.gate.hidden) closeGate(); });
    document.addEventListener('visibilitychange', () => {
      if (ST.screen !== 'capture') return;
      if (document.hidden) { if (ST.mode === 'live') stopCamera(); }
      else if (ST.mode === 'live' && !ST.stream) startCamera();
    });
    window.addEventListener('resize', () => { if (ST.screen === 'capture' && ST.mode !== 'choose') layoutStage(); });
    bindPhotoGestures();
    animateIntro();

    await Chances.init();
    if (Chances.S.sandbox) {
      // 미리보기 화면(샌드박스)에서는 기기의 공유 창과 링크를 쓸 수 없어, 이미지 저장만 제공한다
      el.btnShare.textContent = '결과 이미지 저장하기';
      el.gateShare.textContent = '결과 이미지 저장하기';
      el.btnSave.parentElement.hidden = true;
      window.claude.use('downloads').then((d) => { if (!d) { ST.noSave = true; el.btnShare.hidden = true; el.gateShare.hidden = true; } }).catch(() => {});
    } else if (!Chances.shareLink()) {
      el.btnCopy.hidden = true;
      el.btnSave.parentElement.style.gridTemplateColumns = '1fr';
    }
    updateIntro();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  return { ST, show, goCapture, goSetup, runScan, openGate };
})();
