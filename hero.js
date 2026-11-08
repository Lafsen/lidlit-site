// Hero: a MacBook Pro, closed and glowing, turns to face you and opens; a pointer clicks Lidlit in the
// menu bar and the real panel (#panel, driven by the script in index.html) drops down from it.
// One timeline, apply(t), drives every frame, so skipping or replaying is just choosing t.
(() => {
  const $ = id => document.getElementById(id);
  const stage = $('stage'); if (!stage) return;
  const scene = $('scene'), rig = $('rig'), scr = $('scr'), drop = $('drop'), panel = $('panel'),
    cur = $('cursor'), spill = $('spill'), icon = $('mbicon'), replayBtn = $('replay');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Geometry, in design px (scene is 1100 × 780 at scale 1). 16" MacBook Pro proportions.
  const SW = 1100, W = 1000, D = 697, HB = 26, HL = 13, R = 30;
  const LID_TOP = 24, HINGE = LID_TOP + D;                  // where the open lid's glass ends up
  const DISP = { x: 62, y: 36, w: 976, h: 631 };             // the display inside the bezel (matches .scr)
  const MB_H = 25;
  const rad = Math.PI / 180;

  // ---- Build the rig: base slab + lid slab, walls as segments around their rounded corners.
  const faces = [];
  const mk = (parent, cls, w, h, tf, n, g) => {
    const e = document.createElement('div');
    e.className = 'f ' + cls;
    e.style.cssText = `width:${w}px;height:${h}px;left:${-w / 2}px;top:${-h / 2}px;transform:${tf}`;
    parent.appendChild(e);
    if (n) faces.push({ e, n, g, k: /bezel/.test(cls) ? 0 : 1 });
    return e;
  };
  const group = (parent, cls) => { const e = document.createElement('div'); e.className = 'g ' + cls; parent.appendChild(e); return e; };
  // Rounded-rect walls centred on (0, cy), from z0 up h; outward normals.
  function walls(g, gname, cy, h, z0, cls, tag) {
    const out = [];
    const seg = (x1, y1, x2, y2, ang, name) => {
      const len = Math.hypot(x2 - x1, y2 - y1) + .9, beta = ang / rad - 90;
      out.push([name, mk(g, `wall ${cls} ${name || ''}`, len, h,
        `translate3d(${(x1 + x2) / 2}px,${(y1 + y2) / 2}px,${z0 + h / 2}px) rotateZ(${beta}deg) rotateX(-90deg)`,
        [Math.cos(ang), Math.sin(ang), 0], gname)]);
    };
    const hw = W / 2, hd = D / 2, N = 10;
    seg(-hw + R, cy + hd, hw - R, cy + hd, 90 * rad, tag + 'front');
    seg(hw, cy - hd + R, hw, cy + hd - R, 0, tag + 'right');
    seg(hw - R, cy - hd, -hw + R, cy - hd, -90 * rad, tag + 'back');
    seg(-hw, cy + hd - R, -hw, cy - hd + R, 180 * rad, tag + 'left');
    [[hw - R, cy + hd - R, 0], [-hw + R, cy + hd - R, 90], [-hw + R, cy - hd + R, 180], [hw - R, cy - hd + R, 270]].forEach(([cx, cyy, a0]) => {
      for (let i = 0; i < N; i++) {
        const a = (a0 + 90 * i / N) * rad, b = (a0 + 90 * (i + 1) / N) * rad;
        seg(cx + R * Math.cos(a), cyy + R * Math.sin(a), cx + R * Math.cos(b), cyy + R * Math.sin(b), (a + b) / 2);
      }
    });
    return Object.fromEntries(out.filter(o => o[0]).map(o => [o[0], o[1]]));
  }

  const base = group(rig, 'base');
  const deck = mk(base, 'deck alu', W, D, `translateZ(${HB}px)`, [0, 0, 1], 'base');
  // Keyboard: rows in key units, like the real layout (14.5 u wide).
  const rows = [[1.5, ...Array(13).fill(1)], [...Array(13).fill(1), 1.5], [1.5, ...Array(13).fill(1)],
    [1.8, ...Array(11).fill(1), 1.7], [2.3, ...Array(10).fill(1), 2.2], [1, 1, 1, 1.25, 5, 1.25, 1, 'arrows']];
  deck.innerHTML = '<div class="grille l"></div><div class="grille r"></div><div class="pad"></div><div class="kb">' + rows.map((r, i) =>
    `<div class="row${i ? '' : ' fn'}">${r.map(u => u === 'arrows'
      ? '<span class="split" style="flex:1"><i class="gap"></i><i></i></span><span class="split" style="flex:1"><i></i><i></i></span><span class="split" style="flex:1"><i class="gap"></i><i></i></span>'
      :`<span style="flex:${u}"></span>`).join('')}</div>`).join('') + '</div>';
  const bw = walls(base, 'base', 0, HB, 0, 'alu', 'b');
  bw.bfront.innerHTML = '<i class="scoop"></i>';
  // Ports, left: MagSafe, two Thunderbolt, headphone. Right: HDMI, Thunderbolt, SD. (Seen during the turn.)
  bw.bleft.innerHTML = '<i class="port" style="left:120px;width:30px"></i><i class="port" style="left:430px;width:22px"></i><i class="port" style="left:470px;width:22px"></i><i class="port dot" style="left:540px"></i>';
  bw.bright.innerHTML = '<i class="port" style="left:120px;width:44px;height:4px;margin-top:-2px"></i><i class="port" style="left:430px;width:22px"></i><i class="port hdmi" style="left:470px;width:30px"></i>';

  const lid = group(rig, 'lid');
  const back = mk(lid, 'back alu', W, D, `translate3d(0,${D / 2}px,${HL}px) rotateZ(180deg)`, [0, 0, 1], 'lid');
  back.innerHTML = '<div class="biglogo"><i class="edge"></i><i class="mirror"></i><i class="light"></i></div>';
  const bezel = mk(lid, 'bezel', W, D, `translate3d(0,${D / 2}px,0) rotateX(180deg)`, [0, 0, -1], 'lid');
  bezel.innerHTML = '<div class="off"></div>';
  walls(lid, 'lid', D / 2, HL, 0, 'lidwall', 'l');
  const bigLogo = back.querySelector('.biglogo'), bigLight = bigLogo.querySelector('.light');

  // ---- Easing
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  function bezier(x1, y1, x2, y2) {   // CSS cubic-bezier
    const f = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
    return x => { if (x <= 0) return 0; if (x >= 1) return 1;
      let lo = 0, hi = 1, t = x; for (let i = 0; i < 22; i++) { t = (lo + hi) / 2; if (f(t, x1, x2) < x) lo = t; else hi = t; }
      return f(t, y1, y2); };
  }
  const inOut = bezier(.6, 0, .3, 1), soft = bezier(.42, 0, .22, 1), out = bezier(.2, .7, .3, 1), lidEase = bezier(.5, 0, .18, 1);
  const k = (t, a, b, e = inOut) => e(clamp((t - a) / (b - a)));

  // ---- Timeline (seconds)
  const T = { turn0: 1.1, turn1: 3.7, lid0: 2.15, lid1: 3.95, wake0: 3.9, wake1: 4.4,
    cur0: 4.45, curAt: 5.25, click: 5.38, open1: 5.7, demo0: 5.95, demoAt: 6.6, tap: 6.72, out0: 7.15, out1: 7.5 };
  const END = T.out1;

  // Pose of the laptop at time t. Final pose (all k = 1) puts the lid's glass flat at z = 0, exactly under .scr.
  function pose(t) {
    const m = k(t, T.turn0, T.turn1), o = k(t, T.lid0, T.lid1, lidEase);
    return {
      psi: 214 - 8 * k(t, 0, 1.4, out) + 154 * m,
      phi: lerp(30, 0, k(t, T.turn0 + .1, T.turn1 + .05, soft)),
      lam: 90 * k(t, T.lid0, T.lid1, lidEase),
      tz: lerp(-1250, D / 2, k(t, T.turn0 + .7, T.lid1 + .05, soft)),
      ty: lerp(395, HINGE + HB, o),
      P: lerp(3000, 16000, k(t, T.turn0 - .2, T.turn1, soft)),
      poy: lerp(395, HINGE + 1, o),
      fade: k(t, 0, .8, soft),
      sc: 1 - .15 * Math.sin(Math.PI * k(t, T.turn0, T.lid1, soft)),
    };
  }

  // ---- Light: the aluminium takes its tone from a soft key light above and in front.
  const nrm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  const Lk = nrm([-.32, -.82, .48]), Hk = nrm([Lk[0], Lk[1], Lk[2] + 1]);
  function light(p) {
    const cl = Math.cos(p.lam * rad), sl = Math.sin(p.lam * rad), cz = Math.cos(p.psi * rad), sz = Math.sin(p.psi * rad),
      a = (90 - p.phi) * rad, cx = Math.cos(a), sx = Math.sin(a);
    for (const f of faces) {
      let [x, y, z] = f.n;
      if (f.g === 'lid') [y, z] = [y * cl - z * sl, y * sl + z * cl];
      [x, y] = [x * cz - y * sz, x * sz + y * cz];
      [y, z] = [y * cx - z * sx, y * sx + z * cx];
      if (z <= 0 || !f.k) continue;
      const d = Math.max(0, x * Lk[0] + y * Lk[1] + z * Lk[2]), s = Math.max(0, x * Hk[0] + y * Hk[1] + z * Hk[2]);
      const v = clamp(.2 + .42 * d + .2 * s ** 12 + .18 * z, 0, 1);
      const g = Math.round(66 + 180 * v);
      f.e.style.backgroundColor = `rgb(${g - 2},${g - 1},${g + 1})`;
    }
  }

  // ---- Layout: scale the scene to the stage; on narrow screens the panel pops out at real size.
  let s = 1, ox = 0, outMode = false, stageH = 780;
  const SCENE_H = 772;
  function layout() {
    const w = stage.clientWidth;
    // Fit the whole laptop in the first screen on load: limit by the height left under the headline.
    const top = stage.getBoundingClientRect().top + scrollY;
    const fitH = top < innerHeight ? (innerHeight - top - 12) / SCENE_H : 1;
    s = Math.min(1, w / SW, Math.max(.5, fitH)); ox = (w - SW * s) / 2;
    outMode = s < .8;
    drop.classList.toggle('in', !outMode);
    scene.style.transform = `translate(${ox}px,0) scale(${s})`;
    placePanel();
    apply(tNow);
  }
  // Scene px → stage px
  const sx = x => ox + x * s, sy = y => y * s;
  let host = { x: 0, y: 0, ox: 0, oy: 0 };
  function placePanel() {
    const pw = panel.offsetWidth * zoomOf();
    const iconL = sx(icon.offsetLeft + icon.offsetParent.offsetLeft + DISP.x), iconC = iconL + icon.offsetWidth * s / 2;
    const mbBottom = sy(DISP.y + MB_H);
    let x, y, maxH = '';
    if (!outMode) {
      x = Math.min(iconL - 2, sx(DISP.x + DISP.w) - pw - 8 * s);
      y = mbBottom + 5;
      maxH = Math.floor(sy(DISP.y + DISP.h) - y - 10 * s) / zoomOf() + 'px';
    } else if (stage.clientWidth >= 640) {
      // Wide but short screens: the scene is scaled down, the panel stays real size under its icon.
      x = Math.min(iconL - 2, sx(DISP.x + DISP.w) - pw - 8 * s);
      y = mbBottom + 5;
    } else {
      x = (stage.clientWidth - pw) / 2;
      y = mbBottom + 8;
    }
    panel.style.maxHeight = maxH;
    drop.style.left = x + 'px'; drop.style.top = y + 'px';
    host = { x, y, ox: iconC - x, oy: mbBottom - y };   // the icon, in host coordinates (for the zoom origin)
    sizeStage();
  }
  function zoomOf() { const r = panel.getBoundingClientRect().width; return r && panelScale ? r / panelScale / panel.offsetWidth : 1; }
  let panelScale = 1;
  function sizeStage() {
    let h = SCENE_H * s;
    if (outMode) h = Math.max(h, host.y + panel.offsetHeight * zoomOf() + 6);
    if (Math.abs(h - stageH) > .5) { stageH = h; stage.style.height = h + 'px'; }
  }
  new ResizeObserver(() => sizeStage()).observe(panel);

  // ---- Logo light, shared with the panel's preview (renderLogo calls this every frame).
  let lv = 0, lglow = 0, llight = 0, lfill = 0, intro = reduce ? 1 : 0, openF = 0;
  window.lidHero = (x, l, glow, fill) => { lv = x; llight = l; lglow = glow; lfill = fill; paintLight(); };
  let lastL = '';
  function paintLight() {
    const L = llight * intro, g = lglow * intro;
    const a = ((.15 + .75 * g) * lfill * intro).toFixed(3);
    const key = L.toFixed(3) + a + openF.toFixed(3);
    if (key === lastL) return; lastL = key;
    bigLight.style.opacity = L.toFixed(3);
    bigLogo.style.filter = L > .001 ? `drop-shadow(0 0 ${(2 + 9 * g).toFixed(1)}px rgba(255,255,255,${a}))` : 'none';
    spill.style.opacity = (openF * intro * (lv > 0 ? .12 + .88 * Math.pow(lv, 1.3) : 0)).toFixed(3);
  }

  // ---- Frame
  let tNow = reduce ? END : 0, running = false, t0 = 0, lastPoseKey = '', panelOpen = false, demoDone = false;
  const pos = el => { const r = el.getBoundingClientRect(), b = stage.getBoundingClientRect(); return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }; };
  function apply(t) {
    const p = pose(t);
    const key = [p.psi, p.phi, p.lam, p.tz, p.ty, p.P, p.sc].map(v => v.toFixed(3)).join();
    if (key !== lastPoseKey) {
      lastPoseKey = key;
      scene.style.perspective = p.P + 'px';
      scene.style.perspectiveOrigin = `550px ${p.poy}px`;
      rig.style.transform = `translate3d(0,${p.ty}px,${p.tz}px) scale3d(${p.sc},${p.sc},${p.sc}) rotateX(${90 - p.phi}deg) rotateZ(${p.psi}deg)`;
      lid.style.transform = `translate3d(0,${-D / 2}px,${HB}px) rotateX(${p.lam}deg)`;
      light(p);
    }
    scene.style.opacity = p.fade;
    intro = reduce ? 1 : k(t, .35, 1.5, soft);
    openF = k(t, T.lid0 + .8, T.wake1, soft);
    paintLight();
    scr.style.opacity = k(t, T.wake0, T.wake1, soft);

    // The pointer: in from the desktop, to the icon, click; then to Breathe, tap; then away.
    const iconR = pos(icon), tile = panel.querySelector('.lp-mode[data-arg="breathe"]');
    const p0 = { x: sx(DISP.x + DISP.w * .58), y: sy(DISP.y + DISP.h * .62) };
    const p1 = { x: iconR.x + iconR.w * .52, y: iconR.y + iconR.h * .55 };
    const tl = { x: host.x + (tile.offsetLeft + tile.offsetWidth * .55) * zoomOf(), y: host.y + (tile.offsetTop + tile.offsetHeight * .6) * zoomOf() - panel.scrollTop };
    const arc = (a, b, q, bend) => { const mx = (a.x + b.x) / 2 - (b.y - a.y) * bend, my = (a.y + b.y) / 2 + (b.x - a.x) * bend;
      return { x: (1 - q) ** 2 * a.x + 2 * (1 - q) * q * mx + q * q * b.x, y: (1 - q) ** 2 * a.y + 2 * (1 - q) * q * my + q * q * b.y }; };
    let c, cs;
    if (t < T.demo0) c = arc(p0, p1, k(t, T.cur0 + .05, T.curAt), .12);
    else c = arc(p1, tl, k(t, T.demo0, T.demoAt), -.1);
    const small = Math.max(.62, s);
    cs = outMode ? lerp(small, 1, k(t, T.click, T.demoAt)) : s;
    const press = Math.max(1 - Math.abs(t - (T.click + .05)) / .09, 1 - Math.abs(t - (T.tap + .05)) / .09, 0);
    cs *= 1 - .12 * press;
    const co = Math.min(k(t, T.cur0, T.cur0 + .3, soft), 1 - k(t, T.out0, T.out1, soft));
    cur.style.opacity = co.toFixed(3);
    cur.style.transform = `translate(${c.x - 2}px,${c.y - 2}px) scale(${cs.toFixed(3)})`;

    // The panel: opens at the click; in narrow layouts it zooms from the icon to real size.
    const o = k(t, T.click + .02, T.open1, out);
    setOpen(t >= T.click + .02);
    if (t < END) {
      panelScale = outMode ? lerp(s * .9, 1, o) : 1;
      const dy = outMode ? 0 : -8 * (1 - o);
      drop.style.transformOrigin = `${host.ox}px ${host.oy}px`;
      drop.style.transform = `translateY(${dy}px) scale(${panelScale})`;
      drop.style.opacity = clamp(o * 1.6).toFixed(3);
      drop.style.clipPath = outMode ? '' : `inset(0 -40px ${(100 * (1 - o) * .9).toFixed(2)}% -40px round 16px)`;
    } else { panelScale = 1; drop.style.transform = drop.style.opacity = drop.style.clipPath = ''; }

    if (t >= T.tap && !demoDone && running) {
      demoDone = true;
      tile.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      tile.click();
    }
  }
  function setOpen(v) { if (v === panelOpen) return; panelOpen = v; drop.classList.toggle('open', v); icon.classList.toggle('on', v); }

  function tick(ms) {
    if (!running) return;
    tNow = Math.min(END, (ms - t0) / 1000);
    apply(tNow);
    if (tNow >= END) finish(); else requestAnimationFrame(tick);
  }
  function play() {
    stage.classList.add('ready');
    replayBtn.classList.remove('show');
    drop.classList.remove('fade');
    demoDone = false; running = true; panel.scrollTop = 0;
    t0 = performance.now(); tNow = 0; apply(0);
    requestAnimationFrame(tick);
  }
  function finish() {
    running = false; tNow = END; apply(END); setOpen(true);
    stage.classList.add('ready');
    replayBtn.classList.add('show');
  }

  // Clicking anywhere in the scene skips to the end (the click still lands on the panel if it was aimed there).
  stage.addEventListener('pointerdown', () => { if (running) finish(); }, true);
  stage.addEventListener('keydown', () => { if (running) finish(); }, true);
  // The menu-bar icon works like the real one: it shows and hides the panel.
  icon.addEventListener('click', e => { if (running) return; e.stopPropagation(); drop.classList.add('fade'); setOpen(!panelOpen); });
  replayBtn.addEventListener('click', () => { if (!running) play(); });

  // Menu-bar clock
  const clock = $('clock');
  const tickClock = () => { try { clock.textContent = new Date().toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).replace(',', ''); } catch (e) {} };
  tickClock(); setInterval(tickClock, 20000);

  // Debug/screenshot hook: lidHeroSeek(t) freezes the timeline at t seconds.
  window.lidHeroSeek = t => { running = false; tNow = t; stage.classList.add('ready'); demoDone = true; apply(t); };

  addEventListener('resize', () => layout());
  layout();
  if (reduce) { finish(); return; }
  apply(0);
  // Start once the stage is on screen.
  const io = new IntersectionObserver(es => {
    if (!es.some(e => e.isIntersecting)) return;
    io.disconnect();
    setTimeout(play, 250);
  }, { threshold: .15 });
  io.observe(stage);
})();
