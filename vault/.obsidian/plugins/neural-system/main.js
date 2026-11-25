/* Neural System — the vault as a human nervous system (human-shaped graph, glow colours from the graph colour groups). Brain = knowledge lobes, brainstem = Companion, spine = the record (receipts, daily,
   operations) in time order, arms = skills / agents, legs = notes / tools. Links glow as nerve paths with sparks.
   The renderer between the RENDERER markers has no Obsidian dependency, so it can be tested in a plain browser. */

/* ===== RENDERER START ===== */
const NeuralRender = (() => {
  /* VIEW REGISTRY (v9). A view is one record in VIEWS (search "const VIEWS"); the key 1..9 and the segmented-row button come from its position:
       { name, icon, layout(nodes) -> [[x, y], ...] screen px per node, backdrop(dt)?, dots?, body?, hit?(x, y) -> node index | -1 }
     layout    where every node sits in this view. It feeds the shared 700 ms tween (nodes glide from the previous view's layout) and default picking.
     backdrop  the view's own drawing (ring arcs, matrix cells, later: treemap, river, ...). Views with dots:true get the generic dot pass at layout();
               dots:false views (Ring, Matrix) draw their nodes themselves and the dot pass only runs during the tween.
     body      true = the 3D body pipeline (cached layer, nerves, sparks, labels) draws it; layout is proj(n.p). Body / Brainstem / Heat body.
     v9b2 extras: hud:true (draw() adds vignette + HUD after the dots), dim(i)/size(i) per-node multipliers for the generic dot pass, can(i) pickable filter, click(x,y) -> true if consumed (when no node hit),
     esc() -> true if consumed, drag(sx,sy,x,y) while dragging, ego:true (selection re-centres, tweened), heat:true (body view with heat blobs). Nine more keys: 1..9 and 0 for the 10th view.
     hit       optional picking override. New view = push one record, no other wiring. */
  // v3: real body proportions (head = 1/7.5 of height), anatomical brain regions, colour themes,
  // timeline that lights the body, "open one, light its tracts", controls panel, body <-> groups layout.
  const TAU = Math.PI * 2;
  const rnd = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (x, y, z = 0) => ({ x, y, z });
  const along = (pts, t) => { const n = pts.length - 1, f = Math.min(n - 1e-9, Math.max(0, t * n)), i = Math.floor(f), u = f - i;
    return P(lerp(pts[i].x, pts[i + 1].x, u), lerp(pts[i].y, pts[i + 1].y, u), lerp(pts[i].z, pts[i + 1].z, u)); };
  const sub = (pts, t0, t1, k = 24) => Array.from({ length: k + 1 }, (_, i) => along(pts, lerp(t0, t1, i / k)));
  const smooth = (pts, k = 6) => { const out = []; for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < k; j++) { const t = j / k;
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t * t + (-a + 3 * b - 3 * c2 + d) * t * t * t);
      out.push(P(c(p0.x, p1.x, p2.x, p3.x), c(p0.y, p1.y, p2.y, p3.y), c(p0.z, p1.z, p2.z, p3.z))); } out.push(pts[pts.length - 1]); return out; };
  const plen = (p) => { let l = 0; for (let i = 1; i < p.length; i++) l += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y, p[i].z - p[i - 1].z); return l; };

  // ---- body (world units; height 2.27: feet -1.12, crown 1.15; head = 1/7.5 of height) ----
  const BRAIN = { c: P(0, 1.02, 0), r: P(0.125, 0.095, 0.115) };
  const REGIONS = [ // anatomical brain regions (direction from brain centre), as in a reference design
    { name: 'Prefrontal', d: P(0, 0.05, 1) }, { name: 'Frontal', d: P(0, 0.75, 0.6) }, { name: 'Parietal', d: P(0, 0.85, -0.45) },
    { name: 'Temporal (left)', d: P(-1, -0.25, 0.15) }, { name: 'Temporal (right)', d: P(1, -0.25, 0.15) }, { name: 'Occipital', d: P(0, 0.1, -1) },
    { name: 'Cerebellum', d: P(0, -0.85, -0.65) }];
  const N = {};
  N.stem = smooth([P(0, 0.95, -0.04), P(0, 0.88, -0.03), P(0, 0.80, -0.02)]);
  N.cord = smooth([P(0, 0.80, -0.02), P(0, 0.62, -0.04), P(0, 0.42, -0.03), P(0, 0.24, -0.05), P(0, 0.12, -0.03)]);
  for (const [sx, side] of [[-1, 'L'], [1, 'R']]) {
    const arm = (dx, endY) => smooth([P(0, 0.78), P(sx * 0.10, 0.77), P(sx * (0.19 + dx), 0.72), P(sx * (0.27 + dx), 0.48), P(sx * (0.32 + dx), 0.22), P(sx * (0.35 + dx), 0.04), P(sx * (0.375 + dx), endY)]);
    N['arm' + side] = [arm(-0.012, -0.06), arm(0.0, -0.08), arm(0.014, -0.07), smooth([P(0, 0.78), P(sx * 0.10, 0.77), P(sx * 0.19, 0.72), P(sx * 0.26, 0.52), P(sx * 0.29, 0.40)])];
    const leg = (dx, z, endX, endY) => smooth([P(0, 0.14, z), P(sx * 0.05, 0.10, z), P(sx * (0.085 + dx), -0.04, z), P(sx * (0.095 + dx), -0.46, z), P(sx * (0.105 + dx), -0.80, z), P(sx * (0.115 + dx), -0.95, z), P(sx * endX, endY, z + 0.06)]);
    N['leg' + side] = [leg(0.0, -0.02, 0.15, -1.06), leg(0.018, 0.02, 0.12, -1.07), leg(-0.015, 0.0, 0.17, -1.05), smooth([P(0, 0.14, 0.02), P(sx * 0.06, 0.08, 0.04), P(sx * 0.11, -0.05, 0.05), P(sx * 0.12, -0.30, 0.05)])];
  }
  N.ribs = []; for (let i = 0; i < 11; i++) { const y = 0.72 - i * 0.042, w = 0.14 + 0.05 * Math.sin((i + 1) / 12 * Math.PI);
    for (const sx of [-1, 1]) N.ribs.push(smooth([P(0, y, -0.04), P(sx * w * 0.5, y + 0.005, 0.02), P(sx * w, y - 0.03, 0.08), P(sx * w * 0.75, y - 0.07, 0.14)])); }
  N.vagus = [-1, 1].map((sx) => smooth([P(sx * 0.02, 0.92, 0.02), P(sx * 0.03, 0.70, 0.05), P(sx * 0.035, 0.45, 0.07), P(sx * 0.03, 0.30, 0.06)]));
  N.cranial = (() => { const out = []; for (let i = 0; i < 6; i++) { const a = (i - 2.5) * 0.35; out.push(smooth([P(0, 0.95, 0.02), P(Math.sin(a) * 0.05, 0.94, 0.06), P(Math.sin(a) * 0.09, 0.90 + 0.02 * Math.cos(a), 0.09)])); } return out; })();
  const TWIGS = (() => { const r = rnd('twigs'), out = [];
    const grow = (path, step, len, depth) => { for (let t = step; t < 1; t += step) { const a = along(path, t), b = along(path, Math.min(1, t + 0.02));
        const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1; for (const side of [-1, 1]) { if (r() < 0.45) continue;
          const ang = side * (0.5 + r() * 0.6), ca = Math.cos(ang), sa = Math.sin(ang), ux = (dx * ca - dy * sa) / L, uy = (dx * sa + dy * ca) / L, l = len * (0.6 + r() * 0.7);
          const tw = [a, P(a.x + ux * l * 0.5, a.y + uy * l * 0.5, a.z + (r() - 0.5) * 0.04), P(a.x + ux * l, a.y + uy * l - l * 0.15, a.z + (r() - 0.5) * 0.06)];
          out.push(tw); if (depth > 0) grow(tw, 0.5, l * 0.5, depth - 1); } } };
    for (const k of ['armL', 'armR', 'legL', 'legR']) for (const p of N[k]) grow(p, 0.07, 0.07, 1);
    grow(N.cord, 0.05, 0.05, 0); for (const p of N.ribs) grow(p, 0.34, 0.04, 0);
    for (const sx of [-1, 1]) { for (let f = 0; f < 5; f++) { const a = (f - 2) * 0.22; const b0 = P(sx * 0.38, -0.08);
        out.push(smooth([b0, P(sx * (0.39 + 0.03 * Math.sin(a)), -0.13, 0.02), P(sx * (0.39 + 0.06 * Math.sin(a)), -0.20 - 0.02 * Math.cos(a), 0.03)])); }
      for (let f = 0; f < 5; f++) { const b0 = P(sx * 0.15, -1.06, 0.06); out.push([b0, P(sx * (0.12 + f * 0.018), -1.085, 0.13), P(sx * (0.11 + f * 0.022), -1.10, 0.19)]); } }
    return out; })();
  const ALL = [N.stem, N.cord, ...N.armL, ...N.armR, ...N.legL, ...N.legR, ...N.ribs, ...N.vagus, ...N.cranial, ...TWIGS];
  const OUTLINE = (() => { const h = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU; h.push(P(Math.sin(a) * 0.115, 1.0 + Math.cos(a) * 0.15)); }
    const body = smooth([P(-0.055, 0.87), P(-0.06, 0.80), P(-0.21, 0.76), P(-0.32, 0.50), P(-0.38, 0.20), P(-0.42, -0.02), P(-0.41, -0.22), P(-0.35, -0.10),
      P(-0.30, 0.20), P(-0.21, 0.42), P(-0.19, 0.18), P(-0.18, -0.02), P(-0.17, -0.40), P(-0.16, -0.90), P(-0.20, -1.12), P(-0.06, -1.12), P(-0.06, -0.90),
      P(-0.03, -0.40), P(0, -0.06), P(0.03, -0.40), P(0.06, -0.90), P(0.06, -1.12), P(0.20, -1.12), P(0.16, -0.90), P(0.17, -0.40), P(0.18, -0.02), P(0.19, 0.18),
      P(0.21, 0.42), P(0.30, 0.20), P(0.35, -0.10), P(0.41, -0.22), P(0.42, -0.02), P(0.38, 0.20), P(0.32, 0.50), P(0.21, 0.76), P(0.06, 0.80), P(0.055, 0.87)], 5);
    return [h, body]; })();
  const PART_LABEL = { armL: 'Left arm', armR: 'Right arm', legL: 'Left leg', legR: 'Right leg', spine: 'Spinal cord', stem: 'Brainstem', core: 'Center' };

  function regionOf(path) {
    const top = path.split('/')[0];
    if (path.startsWith('knowledge/')) return { kind: 'brain', lobe: path.split('/').length > 2 ? path.split('/')[1] : '_root' };
    if (top === '🧠 Brain.md' || top === '🧭 Maps' || /Hemisphere/.test(path)) return { kind: 'core' };
    if (top === '🔮 Companion') return { kind: 'stem' };
    if (top === 'receipts' || top === 'daily' || top === '📜 Operations') return { kind: 'spine' };
    if (top === '🧩 Skills') return { kind: 'armL' };
    if (top === '🤖 Agents') return { kind: 'armR' };
    if (top === 'notes') return { kind: 'legL' };
    return { kind: 'legR' };
  }
  function layout(nodes) {
    const lobes = [...new Set(nodes.map((n) => regionOf(n.path)).filter((r) => r.kind === 'brain').map((r) => r.lobe))].sort();
    const lobeReg = {}; lobes.forEach((l, i) => { lobeReg[l] = i % REGIONS.length; });
    const regLobes = REGIONS.map(() => []); lobes.forEach((l) => regLobes[lobeReg[l]].push(l));
    const byKind = {}; nodes.forEach((n) => { const k = regionOf(n.path).kind; (byKind[k] = byKind[k] || []).push(n); });
    for (const k in byKind) byKind[k].sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    nodes.forEach((n) => { const reg = regionOf(n.path), r = rnd(n.path), list = byKind[reg.kind], idx = list.indexOf(n), t = list.length > 1 ? idx / (list.length - 1) : 0.5; let p;
      n.route = null;
      if (reg.kind === 'brain') { const R = REGIONS[lobeReg[reg.lobe]].d, s = 0.45 + 0.5 * r(); let x = R.x * 0.8 + (r() - 0.5) * 0.9, y = R.y * 0.8 + (r() - 0.5) * 0.9, z = R.z * 0.8 + (r() - 0.5) * 0.9; const L = Math.hypot(x, y, z) || 1;
        p = P(BRAIN.c.x + x / L * BRAIN.r.x * s, BRAIN.c.y + y / L * BRAIN.r.y * s, BRAIN.c.z + z / L * BRAIN.r.z * s); n.lobe = reg.lobe; n.region = REGIONS[lobeReg[reg.lobe]].name; }
      else if (reg.kind === 'core') { const a = r() * TAU, rr = 0.025 * Math.sqrt(r()); p = P(Math.cos(a) * rr, BRAIN.c.y - 0.01 + (r() - 0.5) * 0.03, Math.sin(a) * rr); }
      else if (reg.kind === 'stem') { const u = r(); p = along(N.stem, u); n.route = sub(N.stem, u, 0, 8); }
      else if (reg.kind === 'spine') { const u = 0.02 + 0.96 * t, q = along(N.cord, u), a = r() * TAU, rr = 0.010 * Math.sqrt(r()); p = P(q.x + Math.cos(a) * rr, q.y, q.z + Math.sin(a) * rr); n.route = [...sub(N.cord, u, 0), ...[...N.stem].reverse()]; }
      else { const set = N[reg.kind], path = set[idx % set.length], u = 0.12 + 0.85 * ((Math.floor(idx / set.length) + 0.5) / Math.ceil(list.length / set.length));
        p = along(path, u); n.route = [...sub(path, u, 0), ...[...N.cord].reverse().filter((q) => q.y > path[0].y - 0.01), ...[...N.stem].reverse()]; }
      n.body = p; n.p = P(p.x, p.y, p.z); n.kind = reg.kind; });
    return { regLobes };
  }
  const hexToRgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  const THEMES = { Original: null,
    Lava: ['#3d0000', '#8b0000', '#d43a00', '#ff8c00', '#ffd166'], Ocean: ['#0b2e8a', '#0077b6', '#00b4d8', '#90e0ef', '#e0fbff'],
    Forest: ['#1b4332', '#2d6a4f', '#52b788', '#95d5b2', '#e9f5db'], Aurora: ['#5a189a', '#4361ee', '#4cc9f0', '#80ffdb', '#c7f9cc'],
    Mono: ['#7a7a7a', '#a0a0a0', '#c8c8c8', '#e6e6e6', '#ffffff'], Sunset: ['#7b2cbf', '#c9184a', '#e36414', '#fb8b24', '#ffd166'] };
  const grad = (stops, t) => { const c = stops.map((h) => hexToRgb(parseInt(h.slice(1), 16))), f = Math.min(c.length - 1.0001, Math.max(0, t * (c.length - 1))), i = Math.floor(f), u = f - i;
    return [0, 1, 2].map((k) => Math.round(lerp(c[i][k], c[i + 1][k], u))); };

  function create(canvas, data, opts = {}) {
    let ctx = canvas.getContext('2d'); const ctx0 = ctx, nodes = data.nodes, links = data.links, host = canvas.parentElement;
    const { regLobes } = layout(nodes);
    const deg = new Array(nodes.length).fill(0), adj = nodes.map(() => []); links.forEach(([a, b]) => { deg[a]++; deg[b]++; adj[a].push(b); adj[b].push(a); });
    const groupNames = [...new Set(nodes.map((n) => n.group || ''))]; groupNames.sort((a, b) => nodes.filter((n) => n.group === b).length - nodes.filter((n) => n.group === a).length);
    nodes.forEach((n, i) => { n.i = i; n.size = (n.kind === 'spine' ? 0.5 : 1) * (1 + Math.min(4.5, Math.log2(1 + deg[i]) * 0.75)); n.base = hexToRgb(n.color); n.gi = groupNames.indexOf(n.group || ''); n.z = rnd('z' + n.path)(); n.zs = 0.6 + 0.65 * n.z; n.za = 0.45 + 0.55 * n.z; n.dl = Math.abs(n.body.x) * 1.4;
      if (/^receipts\//.test(n.path)) n.name = 'receipt · ' + new Date(n.mtime || 0).toISOString().slice(0, 10); });
    // v7: hot / stale / orphan flags, thread + agent sets
    const NOW0 = data.now || Date.now(), DAY = 864e5, REDUCE = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches), HEART = P(-0.06, 0.42, 0.02);
    const pidx = new Map(nodes.map((n, i) => [n.path, i])), idxs = (a) => new Set((a || []).map((p) => pidx.get(p)).filter((i) => i != null));
    const threadSet = idxs([].concat(...(opts.threads || []).map((t) => t.paths || []))), agentSet = idxs(opts.agentToday);
    nodes.forEach((n, i) => { const a = (NOW0 - (n.mtime || 0)) / DAY; n.hot = a < 1 ? 0.9 - 0.3 * Math.max(0, a) : a < 7 ? 0.35 * (1 - (a - 1) / 6) : 0; n.stale = a > 90; n.orphan = !deg[i] && n.kind !== 'spine';
      if (n.orphan) { const c = (n.kind === 'brain' || n.kind === 'core') ? BRAIN.c : P(0, n.body.y, 0), dx = n.body.x - c.x, dy = n.body.y - c.y, dz = n.body.z - c.z, L = Math.hypot(dx, dy, dz) || 1;
        n.b0 = n.body; n.body = P(n.b0.x + dx / L * 0.05, n.b0.y + dy / L * 0.05, n.b0.z + dz / L * 0.05); n.p = P(n.body.x, n.body.y, n.body.z); } });
    const nOrph = deg.filter((d) => !d).length, nStale = nodes.filter((n) => n.stale).length;
    // settings (per viewer, survive reopen)
    const KEY = 'neural-system-v3'; let S = { theme: 'Original', labels: true, notes: true, record: true, turning: true, speed: 1, layout: 0, timeline: false, areas: [], view: 'Body', day: false, stale: true, flow: true, glow: true, heart: true, chips: true, heat: 0, depth: 2, bm: {}, sound: false, tags: false, calm: false, fx: 'std' };
    try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
    if (S.fx !== 'calm' && S.fx !== 'kin') S.fx = S.calm ? 'calm' : 'std'; S.calm = S.fx === 'calm';   // v11: one 3-way preset (Calm / Standard / Cinematic) replaces the separate effect switches
    const KIN = () => S.fx === 'kin', nfmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');   // v11: thin-space thousands
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
    const lr = (k, c) => S.theme === 'Original' && k === 'spine' ? [lerp(c[0], 123, 0.15) | 0, lerp(c[1], 92, 0.15) | 0, lerp(c[2], 255, 0.15) | 0] : S.theme === 'Original' && k === 'armR' ? [lerp(c[0], 255, 0.3) | 0, lerp(c[1], 111, 0.3) | 0, lerp(c[2], 181, 0.3) | 0] : c;   // lift the dull rose a little
    const cl01 = (x) => Math.max(0, Math.min(1, x)), easeOut = (x) => 1 - (1 - x) * (1 - x);
    const ezIO = (u) => u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;   // v12: the one in-out easing for camera, view and path tweens; durations are 0.2 / 0.4 / 0.7 s everywhere
    const calm = () => REDUCE || !!S.calm, smooth01 = (a, b, x) => { const t = cl01((x - a) / (b - a)); return t * t * (3 - 2 * t); }, backOut = (t) => { const u = t - 1; return 1 + 2.4 * u * u * u + 1.4 * u * u; };   // v10: calm = reduced motion OR the high-contrast setting
    let entT = 9, tintCur = [120, 130, 200];
    // colours by theme
    const regCol = {}; let brainCols = [];
    function applyTheme() { const st = THEMES[S.theme], G = Math.max(1, groupNames.length - 1);
      nodes.forEach((n) => { n.rgb = st ? grad(st, n.gi / G) : n.base; });
      nodes.forEach((n) => { const c = lr(n.kind, n.rgb); n.drgb = n.z < 0.33 ? [lerp(c[0], 110, 0.15) | 0, lerp(c[1], 140, 0.15) | 0, lerp(c[2], 255, 0.15) | 0] : c; });
      for (const k in regCol) delete regCol[k];
      for (const n of nodes) { const c = (regCol[n.kind] = regCol[n.kind] || [0, 0, 0, 0]); c[0] += n.rgb[0]; c[1] += n.rgb[1]; c[2] += n.rgb[2]; c[3]++; }
      brainCols = nodes.filter((n) => n.kind === 'brain' || n.kind === 'core').map((n) => n.rgb);
      for (const d of dust) { d.rgb = d.node != null ? nodes[d.node].rgb : colOf(d.kind); d.ck = undefined; } dustCkM.clear(); }
    const dustCkM = new Map(), dustCk = (d) => { const k = d.kind + '|' + d.rgb.join(','); let v = dustCkM.get(k); if (v === undefined) dustCkM.set(k, v = dustCkM.size); return v; };
    const colOf = (k) => { const c = regCol[k]; return c && c[3] ? [c[0] / c[3] | 0, c[1] / c[3] | 0, c[2] / c[3] | 0] : [120, 150, 255]; };
    // dust: brain cloud + light points along every nerve
    let SKK; const dust = []; { const r = rnd('dust'), brainIdx = nodes.map((n, i) => (n.kind === 'brain' || n.kind === 'core') ? i : -1).filter((i) => i >= 0);
      for (let i = 0; i < 3200; i++) { let x, y, z; do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1);
        dust.push({ p: P(BRAIN.c.x + x * BRAIN.r.x, BRAIN.c.y + y * BRAIN.r.y, BRAIN.c.z + z * BRAIN.r.z), node: brainIdx.length ? brainIdx[(r() * brainIdx.length) | 0] : null, kind: 'core', s: 1.0, nerve: false }); }
      const kinds = SKK = [[N.stem, 'stem'], [N.cord, 'spine'], ...N.armL.map((p) => [p, 'armL']), ...N.armR.map((p) => [p, 'armR']), ...N.legL.map((p) => [p, 'legL']), ...N.legR.map((p) => [p, 'legR']),
        ...N.ribs.map((p) => [p, 'spine']), ...N.vagus.map((p) => [p, 'stem']), ...N.cranial.map((p) => [p, 'stem']), ...TWIGS.map((p) => [p, null])];
      const tot = kinds.reduce((a, [p]) => a + plen(p), 0);
      for (const [p, k] of kinds) { const cnt = Math.max(4, Math.round(9000 * plen(p) / tot));
        for (let i = 0; i < cnt; i++) { const q = along(p, r()), a = r() * TAU, rr = (p === N.cord ? 0.014 : 0.005) * Math.sqrt(r());
          const kk = k || (q.x < -0.17 ? (q.y > -0.1 ? 'armL' : 'legL') : q.x > 0.17 ? (q.y > -0.1 ? 'armR' : 'legR') : (q.y > 0.1 ? 'spine' : (q.x < 0 ? 'legL' : 'legR')));
          dust.push({ p: P(q.x + Math.cos(a) * rr, q.y + (r() - 0.5) * 0.004, q.z + Math.sin(a) * rr), node: null, kind: kk, s: 1.05, nerve: true, rec: kk === 'spine' && p === N.cord }); } } }
    applyTheme();
    // v8: nerve strokes in 4 width tiers (spine / limb trunk / branch / twig), trunks taper over their length
    const SKG = (() => { const m = new Map(), tw = new Set(TWIGS), tr = new Set([...N.armL.slice(0, 3), ...N.armR.slice(0, 3), ...N.legL.slice(0, 3), ...N.legR.slice(0, 3)]),
        W_ = [2.6, 1.6, 0.9, 0.45, 1.0], A_ = [0.22, 0.22, 0.14, 0.07, 0.22], rb = new Set(N.ribs);   // ribs: own tier (brighter lattice); limb tips fade out over the last 12%
      for (const [p, k0] of SKK) { const q = along(p, 0.5), k = k0 || (q.x < -0.17 ? (q.y > -0.1 ? 'armL' : 'legL') : q.x > 0.17 ? (q.y > -0.1 ? 'armR' : 'legR') : (q.y > 0.1 ? 'spine' : (q.x < 0 ? 'legL' : 'legR'))),
          t = (p === N.cord || p === N.stem) ? 0 : rb.has(p) ? 4 : tr.has(p) ? 1 : tw.has(p) ? 3 : 2, n = p.length - 1;
        (t === 0 ? [[0, 0.4, 1, 1], [0.4, 0.75, 0.72, 1], [0.75, 1, 0.5, 1]] : t === 1 ? [[0, 0.4, 1, 1], [0.4, 0.75, 0.72, 1], [0.75, 0.88, 0.5, 1], [0.88, 0.94, 0.5, 0.5], [0.94, 1, 0.5, 0.2]] : t === 4 ? [[0, 1, 1, 1]] : [[0, 0.88, 1, 1], [0.88, 0.94, 1, 0.5], [0.94, 1, 1, 0.2]]).forEach(([t0, t1, wm, fa]) => { const key = k + '|' + t + '|' + wm + '|' + fa; let g = m.get(key); if (!g) m.set(key, g = { kind: k, w: W_[t] * wm, a: A_[t] * fa, segs: [] });
          g.segs.push(p.slice(Math.floor(t0 * n), Math.ceil(t1 * n) + 1)); }); }
      return [...m.values()]; })();
    const order0 = 0;
    const order = nodes.map((n, i) => i).sort((a, b) => nodes[a].z - nodes[b].z), fdv = new Float32Array(nodes.length);   // far nodes first
    const topL = new Set(links.map((l, i) => i).sort((x, y) => deg[links[y][0]] + deg[links[y][1]] - deg[links[x][0]] - deg[links[x][1]]).slice(0, 300));
    const topS = [...topL].slice(0, 150);
    // group cluster positions for the "Groups" layout (inward, like a reference layout)
    const gPos = groupNames.map((g, i) => { const a = i / groupNames.length * TAU; return P(Math.cos(a) * 0.62, 0.05 + Math.sin(a) * 0.62, Math.sin(a * 2) * 0.2); });
    nodes.forEach((n) => { const r = rnd('g' + n.path), c = gPos[Math.max(0, n.gi)], cnt = nodes.filter((m) => m.gi === n.gi).length, rad = 0.06 + 0.03 * Math.cbrt(cnt);
      let x, y, z; do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1); n.grp = P(c.x + x * rad, c.y + y * rad, c.z + z * rad); });

    // v4: theme backgrounds, day mode (white page, dark points), from a reference design
    const BG = { Original: ['#0a0c1a', '#010104'], Lava: ['#24080a', '#070102'], Ocean: ['#061733', '#01040c'], Forest: ['#0a2014', '#010603'],
      Aurora: ['#160c2c', '#03010a'], Mono: ['#151515', '#020202'], Sunset: ['#260a1a', '#070106'] };
    const VT = { 'Body': [[10, 12, 26], [1, 1, 4]], 'Brainstem': [[8, 10, 30], [1, 1, 6]], 'Ring': [[12, 10, 24], [2, 1, 6]], 'Matrix': [[12, 13, 17], [2, 2, 3]], 'Heat body': [[26, 9, 13], [5, 1, 2]], 'Cortex map': [[23, 18, 13], [5, 4, 2]],
      'Time river': [[6, 17, 27], [1, 3, 8]], 'Constellation map': [[17, 10, 33], [3, 1, 9]], 'Ego radial': [[10, 14, 25], [1, 2, 5]], 'Spinal section': [[15, 12, 19], [3, 2, 4]], 'Neuron': [[8, 19, 23], [1, 4, 6]], 'Reflex arc': [[21, 8, 21], [4, 1, 5]],
      'Synapse network': [[10, 12, 23], [1, 2, 5]], '3D brain': [[8, 10, 25], [1, 1, 5]], 'Dendrite tree': [[9, 21, 14], [2, 5, 3]], 'Sundial': [[22, 17, 8], [4, 3, 1]], 'Wave': [[6, 19, 19], [1, 4, 5]], 'Coral': [[21, 12, 10], [4, 2, 2]] };   // v10 B15: per-view backdrop tone, L 6-10%
    const tone = (c) => S.day ? [c[0] * 0.42 | 0, c[1] * 0.42 | 0, c[2] * 0.42 | 0] : c;
    const sprites = {}; const sprite = (rgb0) => { const key = rgb0[0] * 65536 + rgb0[1] * 256 + rgb0[2] + (S.day ? 1e8 : 0), hit = sprites[key]; if (hit) return hit; const rgb = tone(rgb0);   // numeric key: no string building per dot per frame
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32), k3 = rgb.join(','), core = rgb.map((v) => lerp(v, 255, 0.35) | 0).join(',');
      gr.addColorStop(0, S.day ? `rgba(${k3},1)` : `rgba(${core},0.85)`); gr.addColorStop(0.16, `rgba(${k3},${S.day ? 0.95 : 0.8})`); gr.addColorStop(0.42, `rgba(${k3},${S.day ? 0.35 : 0.25})`); gr.addColorStop(1, `rgba(${k3},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (sprites[key] = c); };
    const hsprites = {}; const hsprite = (rgb0) => { const key = rgb0[0] * 65536 + rgb0[1] * 256 + rgb0[2] + (S.day ? 1e8 : 0), hit = hsprites[key]; if (hit) return hit; const c0 = tone(rgb0), m = (c0[0] + c0[1] + c0[2]) / 3, rgb = c0.map((v) => Math.max(0, Math.min(255, Math.round(m + (v - m) * 1.2))));
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32), k3 = rgb.join(',');
      gr.addColorStop(0, `rgba(${k3},0.6)`); gr.addColorStop(0.35, `rgba(${k3},0.28)`); gr.addColorStop(1, `rgba(${k3},0)`); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (hsprites[key] = c); };
    const stars = Array.from({ length: 440 }, (_, i) => { const r = rnd('star' + i); return { x: r(), y: r(), l: i % 3, tw: r() < 0.08 ? 3 + r() * 3 : 0, ph: r() * TAU }; });
    const STAR_L = [[0.6, 0.15, 0.02], [1.0, 0.27, 0.05], [1.4, 0.42, 0.09]];   // size, alpha, parallax
    let yaw = 0, pitch = 0.02, zoom = 1, hover = -1, sel = -1, W = 0, H = 0, dpr = 1, raf = 0, last = 0, clock = 0, panY = 0, range = null, layoutT = S.layout;
    const sparks = [];
    let introT = 0, camK = 1, camX = 0, camY = 0, camE = 0, lastIn = performance.now(), selFade = 0, fSel = -1, fAdj = null, f2 = null, labT = 0;
    let fly = null, flash = null, panX = 0, lastPP = null, areaSet = new Set((S.areas || []));
    let query = '', matches = new Set();          // v5: search, live birth pulses, touch
    const beats = [], gl = document.createElement('canvas'), gctx = gl.getContext('2d'), glowOk = 'filter' in ctx0; const vA = new Uint8Array(nodes.length), lA = new Uint8Array(nodes.length), isSp = Uint8Array.from(nodes, (n) => n.kind === 'spine' ? 1 : 0);
    let blN = 0, blR = [0, 0, 1, 1], orphF = false, ambT = -1, amb = [], fkey = -2, flinks = [];
    const born = new Map();                         // node index -> clock time it was created / changed
    // "Brainstem": a brain on a long glowing stem; limbs fold into the stem as fibres (animated by stemT)
    let stemT = S.view === 'Brainstem' ? 1 : 0;
    let cOpen = S.chips !== false && (S.view === 'Body' || S.view === 'Brainstem' || S.view === 'Heat body'); const L0 = () => cOpen ? 304 : 46;   // left inset: the chip panel (open 292 px + gutter) or its small toggle
    const T = (p) => { if (stemT < 0.001) return p; const c = BRAIN.c; let q;
      if (p.y > 0.865) { const k = 4.2; q = P(c.x + (p.x - c.x) * k, 0.66 + (p.y - c.y) * k, c.z + (p.z - c.z) * k); }
      else { const u = (p.y + 1.12) / (0.865 + 1.12); q = P(p.x * 0.12 + Math.sin(u * 5 + p.x * 9) * 0.014, -1.10 + u * 1.40, p.z * 0.3); }
      return P(lerp(p.x, q.x, stemT), lerp(p.y, q.y, stemT), lerp(p.z, q.z, stemT)); };
    const CX = () => W * (0.5 + 0.04 * Math.min(1, W / 1000)) + (cOpen ? 70 * Math.min(1, W / 1000) : 0), FIT = 2.65, INS = opts.bottomInset || 0, TLB = 84, TLH = () => (S.timeline ? TLB : 0) + INS, cardB = () => ((S.timeline ? TLB + 12 : 64) + INS) + 'px';   // figure ~85% of the height, nudged right to balance the chips column
    const proj = (p0) => { const p = T(p0), cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      let x = p.x * cy - p.z * sy, z = p.x * sy + p.z * cy, y = p.y - 0.015 + panY; const y2 = y * cp - z * sp; z = y * sp + z * cp;
      const f = 3.2 / (3.2 + z), s = Math.min(W / 1.0, (H - TLH()) / FIT) * zoom * camK; return [CX() + panX + x * f * s + camX, (H - TLH()) / 2 - y2 * f * s + camY, f]; };
    const scale = () => Math.min(W / 1.0, (H - TLH()) / FIT) * zoom;
    function resize() { dpr = window.devicePixelRatio || 1; const r = canvas.getBoundingClientRect(); W = Math.max(50, r.width); H = Math.max(50, r.height); canvas.width = W * dpr; canvas.height = H * dpr; drawTimeline(); }
    const aOk = (n) => !areaSet.size || areaSet.has(n.group || '');
    const inRng = (n) => !range || (n.mtime >= range[0] && n.mtime < range[1]);
    let todayOn = false, todaySet = new Set(), nToday = 0;   // v9 "Today" mode: notes modified today + today's agent receipt refs
    const calcToday = () => { const d0 = new Date(NOW0); d0.setHours(0, 0, 0, 0); todaySet = new Set(); nToday = 0; nodes.forEach((n, i) => { const t = (n.mtime || 0) >= d0.getTime(); if (t) nToday++; if (t || agentSet.has(i)) todaySet.add(i); }); };
    const inRange = (n) => inRng(n) && (!todayOn || todaySet.has(n.i));
    const drawPath = (pts, style, w) => { ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((q, i) => { const v = proj(q); i ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1]); }); ctx.stroke(); };
    // ---- "Ring": groups as arcs, every note a tick on the outer ring, links as chords through the middle ----
    const ringOrder = nodes.map((n, i) => i).sort((a, b) => (nodes[a].gi - nodes[b].gi) || ((nodes[a].mtime || 0) - (nodes[b].mtime || 0)));
    const ringAng = new Array(nodes.length); { const gap = 0.012, G = groupNames.length, span = TAU - gap * G; let a = -Math.PI / 2, prev = -1;
      ringOrder.forEach((i) => { if (nodes[i].gi !== prev) { if (prev !== -1) a += gap; prev = nodes[i].gi; } ringAng[i] = a; a += span / nodes.length; }); }
    let ringRot = 0;
    const ribGeo = () => memoL('rib', 'x', () => { const G = groupNames.length, cnt = Array.from({ length: G }, () => new Array(G).fill(0)); for (const [a, b] of links) cnt[Math.min(nodes[a].gi, nodes[b].gi)][Math.max(nodes[a].gi, nodes[b].gi)]++;
      const span = groupNames.map((_, gi) => { const idx = ringOrder.filter((i) => nodes[i].gi === gi); return idx.length ? [ringAng[idx[0]], ringAng[idx[idx.length - 1]] + 0.004] : null; });
      const tot = groupNames.map((_, g) => { let t = 0; for (let h = 0; h < G; h++) t += h === g ? 2 * cnt[g][g] : cnt[Math.min(g, h)][Math.max(g, h)]; return t; }), cur = span.map((sp) => sp ? sp[0] : 0), slot = (g, c) => { const sp = span[g], w = (sp[1] - sp[0]) * c / Math.max(1, tot[g]), r = [cur[g], cur[g] + w]; cur[g] += w; return r; }, rib = [];
      for (let g = 0; g < G; g++) for (let h = g; h < G; h++) { const c = cnt[g][h]; if (!c || !span[g] || !span[h]) continue; const A = slot(g, c), B = slot(h, c); rib.push({ ga: g, gb: h, a0: A[0], a1: A[1], b0: B[0], b1: B[1], c }); } return { rib }; });
    const ringGeo = () => { const R = Math.min(W - L0() - 60, H - TLH()) * 0.36 * zoom; return { cx: L0() + (W - L0()) / 2, cy: (H - TLH()) / 2 + panY * 200, R }; };
    const ringPt = (i, r) => { const g = ringGeo(), a = ringAng[i] + ringRot; return [g.cx + Math.cos(a) * r, g.cy + Math.sin(a) * r]; };
    function drawRing(dt) {
      if (S.turning && !calm()) ringRot += dt * 0.03 * S.speed;
      const g = ringGeo(); ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter';
      { const rb = ribGeo().rib, r0 = g.R * 0.8, hA = hover >= 0 ? nodes[hover].gi : sel >= 0 ? nodes[sel].gi : -1, pt = (an) => [g.cx + Math.cos(an) * r0, g.cy + Math.sin(an) * r0], cw = (u0, u1) => { const m = (u0 + u1) / 2, w = Math.max(2 / r0, Math.min(28 / r0, u1 - u0)); return [m - w / 2, m + w / 2]; };
        for (const x of rb) { const [p0, p1] = cw(x.a0, x.a1), [q0, q1] = cw(x.b0, x.b1), ma = (p0 + p1) / 2 + ringRot, mb = (q0 + q1) / 2 + ringRot, cc = [g.cx + (Math.cos(ma) + Math.cos(mb)) * g.R * 0.12, g.cy + (Math.sin(ma) + Math.sin(mb)) * g.R * 0.12];
          const on = !areaSet.size || (areaSet.has(groupNames[x.ga] || '') && areaSet.has(groupNames[x.gb] || '')), al = (on ? 1 : 0.15) * (hA < 0 ? (S.day ? 0.24 : 0.18) : x.ga === hA || x.gb === hA ? 0.55 : 0.04), A = pt(ma), B = pt(mb), gr = ctx.createLinearGradient(A[0], A[1], B[0], B[1]);
          gr.addColorStop(0, rgba(gRgb(x.ga), al)); gr.addColorStop(1, rgba(gRgb(x.gb), al)); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(...pt(p0 + ringRot)); ctx.arc(g.cx, g.cy, r0, p0 + ringRot, p1 + ringRot); ctx.quadraticCurveTo(cc[0], cc[1], ...pt(q0 + ringRot)); ctx.arc(g.cx, g.cy, r0, q0 + ringRot, q1 + ringRot); ctx.quadraticCurveTo(cc[0], cc[1], ...pt(p0 + ringRot)); ctx.closePath(); ctx.fill(); }   // B2: one ribbon per area pair, width ~ link count (2-28 px at the ring)
        const ho = hover >= 0 ? hover : sel; if (ho >= 0) { ctx.lineWidth = 1; for (const j of adj[ho]) { const A = ringPt(ho, g.R * 0.86), B = ringPt(j, g.R * 0.86); ctx.strokeStyle = rgba(tone(nodes[j].rgb), 0.8); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(g.cx, g.cy, B[0], B[1]); ctx.stroke(); } } }
      for (let i = 0; i < nodes.length; i++) { const n = nodes[i], c = tone(n.rgb), len = 6 + Math.min(26, deg[i] * 1.6), lit = inRange(n) && (sel < 0 || i === sel || adj[sel].includes(i));
        const A = ringPt(i, g.R * 0.9), B = ringPt(i, g.R * 0.9 + len); ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${lit ? 0.9 : 0.15})`; ctx.lineWidth = i === hover || i === sel ? 3 : 1.2;
        ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
      groupNames.forEach((gname, gi) => { const idx = ringOrder.filter((i) => nodes[i].gi === gi); if (!idx.length) return; const a0 = ringAng[idx[0]] + ringRot, a1 = ringAng[idx[idx.length - 1]] + ringRot + 0.004, c = tone(nodes[idx[0]].rgb);
        ctx.strokeStyle = `rgb(${c.join(',')})`; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R * 0.82, a0, a1); ctx.stroke();
        if (S.labels && idx.length >= 8) { const am = (a0 + a1) / 2; ctx.fillStyle = S.day ? 'rgba(30,30,40,.8)' : 'rgba(235,238,255,.8)'; ctx.font = '11px -apple-system,sans-serif';
          ctx.textAlign = Math.cos(am) < 0 ? 'right' : 'left'; title((gname || 'other').toUpperCase() + ' ' + idx.length, g.cx + Math.cos(am) * (g.R + 40 + (idx.length < 30 ? 20 * (gi % 3) : 0)), g.cy + Math.sin(am) * (g.R + 40 + (idx.length < 30 ? 20 * (gi % 3) : 0)), ctx.textAlign); ctx.textAlign = 'left'; } });
      ctx.fillStyle = S.day ? 'rgba(30,30,40,.7)' : 'rgba(235,238,255,.75)'; ctx.font = '600 18px -apple-system,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(nfmt(range ? nodes.filter(inRange).length : nodes.length), g.cx, g.cy - 6); ctx.font = '11px -apple-system,sans-serif'; ctx.fillText(range ? 'selected period' : 'notes · ' + links.length + ' links', g.cx, g.cy + 14); ctx.textAlign = 'left';
      drawHud(null);
    }
    // ---- "Matrix": groups x days heatmap, and weekday x hour heatmap ----
    let matGeo = null;
    const matBase = () => { const top = 70, left = L0() + 150, Hh = H - TLH(), now2 = data.now || Date.now(), D = Math.max(14, Math.min(120, Math.ceil((now2 - Math.min(...nodes.map((n) => n.mtime || now2))) / 864e5) + 1));
      return { top, left, Hh, now2, D, cw: Math.max(3, (W - left - 30) / D), ch: Math.min(18, (Hh * 0.55 - top) / Math.max(1, groupNames.length)) }; };
    function drawMatrix() {
      const { top, left, Hh, now2, D, cw, ch } = matBase();
      const cnt = groupNames.map(() => new Array(D).fill(0)); for (const n of nodes) { const d = D - 1 - Math.floor((now2 - (n.mtime || 0)) / 864e5); if (d >= 0 && d < D) cnt[Math.max(0, n.gi)][d]++; }
      const mx = Math.max(1, ...cnt.flat()); ctx.font = '11px -apple-system,sans-serif'; ctx.textBaseline = 'middle';
      const [mmx, mmy] = mouse, hgi = mmx >= left && mmx < left + D * cw && mmy >= top && mmy < top + groupNames.length * ch ? Math.floor((mmy - top) / ch) : -1, hgd = hgi >= 0 ? Math.floor((mmx - left) / cw) : -1;
      const ink = S.day ? 'rgba(30,30,40,.8)' : 'rgba(235,238,255,.8)';
      ctx.fillStyle = ink; ctx.fillText('GROUPS × DAYS (last ' + D + ' days)', left, top - 22);
      groupNames.forEach((gname, gi) => { const y = top + gi * ch, n0 = nodes.find((n) => n.gi === gi), c = tone(n0 ? n0.rgb : [140, 150, 255]);
        ctx.font = (gi === hgi ? '600 ' : '') + '11px -apple-system,sans-serif'; ctx.fillStyle = ink; ctx.textAlign = 'right'; ctx.fillText(gname || 'other', left - 8, y + ch / 2); ctx.textAlign = 'left';
        for (let d = 0; d < D; d++) { const v = cnt[gi][d]; const day0 = now2 - (D - 1 - d) * 864e5, inR = !range || (day0 >= range[0] - 864e5 && day0 < range[1]);
          if (v) { const sh = [0.5, 0.7, 0.88, 1.06, 1.3][Math.min(4, Math.floor(Math.sqrt(v / mx) * 5))] * (amOn() ? 1 + 0.16 * Math.sin(d * 0.3 - clock * 1.3 + gi * 0.8) : 1); ctx.fillStyle = `rgba(${Math.min(255, c[0] * sh) | 0},${Math.min(255, c[1] * sh) | 0},${Math.min(255, c[2] * sh) | 0},${0.92 * (inR ? 1 : 0.3)})`; } else ctx.fillStyle = S.day ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.035)';   // 5 lightness steps of the area hue
          ctx.fillRect(left + d * cw, y + 1, cw - 1, ch - 2); } });
      if (hgi >= 0) { const c = gRgb(hgi); ctx.fillStyle = rgba(c, 0.08); ctx.fillRect(left, top + hgi * ch, D * cw, ch); ctx.fillRect(left + hgd * cw, top, cw, groupNames.length * ch); ctx.strokeStyle = S.day ? 'rgba(30,30,45,.95)' : 'rgba(235,238,255,.95)'; ctx.lineWidth = 1.5; ctx.strokeRect(left + hgd * cw, top + hgi * ch + 1, cw - 1, ch - 2); ctx.lineWidth = 1; }
      { const ay = top + groupNames.length * ch + 3.5, ax = left - 3.5; ctx.strokeStyle = S.day ? 'rgba(30,30,40,.22)' : 'rgba(235,238,255,.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, ay); ctx.lineTo(left + D * cw, ay); ctx.moveTo(ax, top); ctx.lineTo(ax, top + groupNames.length * ch); for (let d = 0; d < D; d += Math.ceil(D / 10)) { ctx.moveTo(left + d * cw + 0.5, ay); ctx.lineTo(left + d * cw + 0.5, ay + 4); } ctx.stroke(); }
      for (let d = 0; d < D; d += Math.ceil(D / 10)) { ctx.fillStyle = S.day ? 'rgba(30,30,40,.5)' : 'rgba(235,238,255,.45)'; ctx.fillText(new Date(now2 - (D - 1 - d) * 864e5).toISOString().slice(5, 10), left + d * cw, top + groupNames.length * ch + 16); }
      ctx.font = '10px -apple-system,sans-serif'; ctx.fillStyle = S.day ? 'rgba(30,30,40,.42)' : 'rgba(235,238,255,.38)'; ctx.textAlign = 'right'; ctx.fillText('DAY →', left + D * cw, top - 22); ctx.textAlign = 'left'; ctx.font = '11px -apple-system,sans-serif';
      const wd = Array.from({ length: 7 }, () => new Array(24).fill(0)); for (const n of nodes) { const t = new Date(n.mtime || 0); wd[(t.getDay() + 6) % 7][t.getHours()]++; }
      const m2 = Math.max(1, ...wd.flat()), top2 = top + groupNames.length * ch + 60, cw2 = Math.min(28, (W - left - 30) / 24), ch2 = Math.min(22, (Hh - top2 - 30) / 7), hk = mmx >= left && mmx < left + 24 * cw2 && mmy >= top2 && mmy < top2 + 7 * ch2 ? Math.floor((mmy - top2) / ch2) : -1, hh = hk >= 0 ? Math.floor((mmx - left) / cw2) : -1;
      ctx.fillStyle = ink; ctx.fillText('WEEKDAY × HOUR (when notes were written)', left, top2 - 18);
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((nm, k) => { ctx.font = (k === hk ? '600 ' : '') + '11px -apple-system,sans-serif'; ctx.fillStyle = ink; ctx.textAlign = 'right'; ctx.fillText(nm, left - 8, top2 + k * ch2 + ch2 / 2); ctx.textAlign = 'left';
        for (let h = 0; h < 24; h++) { const v = wd[k][h]; ctx.fillStyle = v ? `rgba(${S.day ? '60,70,170' : '140,170,255'},${Math.min(1, (0.15 + 0.85 * v / m2) * (amOn() ? 1 + 0.2 * Math.sin(h * 0.45 - clock * 1.2 + k * 0.9) : 1))})` : (S.day ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.035)'); ctx.fillRect(left + h * cw2, top2 + k * ch2, cw2 - 2, ch2 - 2); } });
      if (hk >= 0) { ctx.fillStyle = S.day ? 'rgba(60,70,170,.1)' : 'rgba(140,170,255,.1)'; ctx.fillRect(left, top2 + hk * ch2, 24 * cw2, ch2 - 2); ctx.fillRect(left + hh * cw2, top2, cw2 - 2, 7 * ch2); ctx.strokeStyle = S.day ? 'rgba(30,30,45,.95)' : 'rgba(235,238,255,.95)'; ctx.lineWidth = 1.5; ctx.strokeRect(left + hh * cw2, top2 + hk * ch2, cw2 - 2, ch2 - 2); ctx.lineWidth = 1; }
      { const ay = top2 + 7 * ch2 + 1.5; ctx.strokeStyle = S.day ? 'rgba(30,30,40,.22)' : 'rgba(235,238,255,.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, ay); ctx.lineTo(left + 24 * cw2 - 2, ay); ctx.moveTo(left - 3.5, top2); ctx.lineTo(left - 3.5, top2 + 7 * ch2 - 2); for (let h = 0; h < 24; h += 3) { ctx.moveTo(left + h * cw2 + 0.5, ay); ctx.lineTo(left + h * cw2 + 0.5, ay + (h % 6 ? 3 : 5)); } ctx.stroke(); }
      for (let h = 0; h < 24; h += 3) { ctx.font = (h % 6 ? '' : '600 ') + '11px -apple-system,sans-serif'; ctx.fillStyle = S.day ? (h % 6 ? 'rgba(30,30,40,.42)' : 'rgba(30,30,40,.75)') : (h % 6 ? 'rgba(235,238,255,.38)' : 'rgba(235,238,255,.75)'); ctx.fillText(String(h).padStart(2, '0'), left + h * cw2, top2 + 7 * ch2 + 16); }
      ctx.font = '10px -apple-system,sans-serif'; ctx.fillStyle = S.day ? 'rgba(30,30,40,.42)' : 'rgba(235,238,255,.38)'; ctx.textAlign = 'right'; ctx.fillText('HOUR →', left + 24 * cw2 - 2, top2 - 18); ctx.textAlign = 'left'; ctx.font = '11px -apple-system,sans-serif';
      { const tip = hgi >= 0 ? gName(hgi) + ' · ' + new Date(now2 - (D - 1 - hgd) * 864e5).toISOString().slice(5, 10) + ' · ' + cnt[hgi][hgd] + ' notes' : hk >= 0 ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][hk] + ' ' + String(hh).padStart(2, '0') + ':00 · ' + wd[hk][hh] + ' notes' : '';
        if (tip) tipLine(tip, mmx, mmy + 14, 70); }
      matGeo = { left, top, cw, ch, D, now2, cnt };
      if (hover >= 0 && hover < 0) {}
      drawHud(null);
    }
    // ---- v9 batch 2: shared helpers for the new views (panel inset, memo, viewport, colours, hit-testing) ----
    const memo = {}, memoL = (nm, key, fn) => { const m = memo[nm]; if (m && m.k === key) return m.v; const v = fn(); memo[nm] = { k: key, v }; return v; };
    const vkey = () => W + ',' + H + ',' + TLH() + ',' + L0();
    const vp = () => { const x0 = L0() + 8, y0 = 64, x1 = W - 16, y1 = H - TLH() - 14; return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; };
    const gFirst = groupNames.map((_, gi) => nodes.find((n) => n.gi === gi)), gCount = groupNames.map((_, gi) => nodes.filter((n) => n.gi === gi).length);
    const gRgb = (gi) => tone(gFirst[gi] ? gFirst[gi].rgb : [140, 150, 255]), rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')', gName = (gi) => groupNames[gi] || 'other';
    const ageD = (n) => Math.max(0, (NOW0 - (n.mtime || 0)) / DAY), hsh = nodes.map((n) => rnd('v9' + n.path)()), ink = (a) => { const b = S.day ? [30, 30, 45] : [235, 238, 255]; return 'rgba(' + ((b[0] + (tintCur[0] - b[0]) * 0.08) | 0) + ',' + ((b[1] + (tintCur[1] - b[1]) * 0.08) | 0) + ',' + ((b[2] + (tintCur[2] - b[2]) * 0.08) | 0) + ',' + a + ')'; };   // v10: greys carry 8% of the dominant area's hue
    const isLit = (n) => inRange(n) && aOk(n), rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); };
    const inA = nodes.map(() => []), outA = nodes.map(() => []); { const seen = new Set(); links.forEach(([a, b]) => { const k = a * 100000 + b; if (seen.has(k)) return; seen.add(k); outA[a].push(b); inA[b].push(a); }); }
    let mouse = [-1, -1], thrOn = false, camTw = null, heatT = 0, vRel = false, egoK = -2, tmZoom = -1, csDepth = -1, skyRot = 0, broken = new Map(), nBroken = 0, nbK = -2, nbS = null;
    const selNb = () => { if (sel < 0) return null; if (nbK !== sel) { nbK = sel; nbS = new Set([sel, ...adj[sel]]); } return nbS; };
    const dgr = { f: null, m: new Map() };
    const dotHit = (mx, my) => { const V = VIEWS[S.view], pos = V.layout(); if (dgr.f !== pos) { dgr.f = pos; dgr.m.clear(); pos.forEach((q, i) => { const k = (q[0] / 16 | 0) * 4096 + (q[1] / 16 | 0); (dgr.m.get(k) || dgr.m.set(k, []).get(k)).push(i); }); }
      let best = -1, bd = 150; const cx = mx / 16 | 0, cy = my / 16 | 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const i of dgr.m.get((cx + a) * 4096 + cy + b) || []) { const n = nodes[i]; if (!vis(n) || !isLit(n) || (V.can && !V.can(i))) continue; const d = (pos[i][0] - mx) ** 2 + (pos[i][1] - my) ** 2; if (d < bd) { bd = d; best = i; } } return best; };
    const arcText = (txt, cx, cy, r, am, col) => { ctx.save(); ctx.fillStyle = col; ctx.font = '600 11px -apple-system,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const bot = Math.sin(am) > 0, tot = ctx.measureText(txt).width / r; let a = bot ? am + tot / 2 : am - tot / 2;
      for (const ch of txt) { const cw = ctx.measureText(ch).width / r; a += bot ? -cw / 2 : cw / 2; ctx.save(); ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.rotate(bot ? a - Math.PI / 2 : a + Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore(); a += bot ? -cw / 2 : cw / 2; } ctx.restore(); };
    // marks over every view: dashed thread rings (25), broken-synapse stubs (17), hover / selection rings, search flash
    const drawMarks = (pos, body) => { const V = VIEWS[S.view], dm = (i) => V.dim && V.dim(i) < 0.2; ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.lineWidth = 1; drawExtra(pos, body); hubRings(pos, body); selRing(pos, body);
      if (thrOn && threadSet.size) { ctx.setLineDash([2.5, 3]); const ph = clock * TAU / 8; for (const i of threadSet) { const n = nodes[i], q = pos[i]; if (!q || !vis(n) || !isLit(n) || dm(i)) continue; ctx.strokeStyle = rgba(tone(n.rgb), 0.9); ctx.beginPath(); ctx.arc(q[0], q[1], 7.5, ph, ph + TAU); ctx.stroke(); } ctx.setLineDash([]); }
      if (broken.size) { ctx.strokeStyle = 'rgba(240,92,160,.9)'; ctx.setLineDash([2, 2]); for (const i of broken.keys()) { const n = nodes[i], q = pos[i]; if (!q || !vis(n) || !isLit(n) || dm(i)) continue; const a = -0.5 - hsh[i] * 1.1, x = q[0] + Math.cos(a) * 14, y = q[1] + Math.sin(a) * 14; ctx.beginPath(); ctx.moveTo(q[0] + Math.cos(a) * 3, q[1] + Math.sin(a) * 3); ctx.lineTo(x, y); ctx.stroke(); }
        ctx.setLineDash([]); for (const i of broken.keys()) { const n = nodes[i], q = pos[i]; if (!q || !vis(n) || !isLit(n) || dm(i)) continue; const a = -0.5 - hsh[i] * 1.1, x = q[0] + Math.cos(a) * 14, y = q[1] + Math.sin(a) * 14; ctx.beginPath(); ctx.moveTo(x - 2.5, y - 2.5); ctx.lineTo(x + 2.5, y + 2.5); ctx.moveTo(x + 2.5, y - 2.5); ctx.lineTo(x - 2.5, y + 2.5); ctx.stroke(); } }
      if (!body) { for (const i of [hover]) { if (i < 0 || !pos[i]) continue; const q = pos[i], c = tone(nodes[i].rgb); ctx.strokeStyle = i === sel ? ink(0.95) : rgba(c, 0.9); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(q[0], q[1], 9, 0, TAU); ctx.stroke(); }
        if (flash) { const age = clock - flash.t0; if (age > 1.6) flash = null; else { const q = pos[flash.i], c = tone(nodes[flash.i].rgb); if (q) { ctx.strokeStyle = rgba(c, 1 - age / 1.6); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(q[0], q[1], 8 + (age * 2.5 % 1) * 30, 0, TAU); ctx.stroke(); } } } }
      drawRipples(); ctx.restore(); };
    // squarified treemap: writes x, y, w, h on every item (items sorted by v, biggest first)
    const sqf = (items, x, y, w, h) => { const tot = items.reduce((s, q) => s + q.v, 0); if (!(tot > 0) || w < 1 || h < 1) { items.forEach((q) => { q.x = x; q.y = y; q.w = 0; q.h = 0; }); return; }
      const k = w * h / tot; let i = 0, cx = x, cy = y, cw = w, ch = h;
      while (i < items.length) { const side = Math.min(cw, ch); let j = i, s = 0, best = Infinity;
        for (; j < items.length; j++) { const s2 = s + items[j].v * k, wst = Math.max(side * side * items[i].v * k / (s2 * s2), s2 * s2 / (side * side * items[j].v * k)); if (wst > best) break; best = wst; s = s2; }
        if (cw >= ch) { const w2 = s / ch; let yy = cy; for (let q = i; q < j; q++) { const hh = items[q].v * k / w2; Object.assign(items[q], { x: cx, y: yy, w: w2, h: hh }); yy += hh; } cx += w2; cw -= w2; }
        else { const h2 = s / cw; let xx = cx; for (let q = i; q < j; q++) { const ww = items[q].v * k / h2; Object.assign(items[q], { x: xx, y: cy, w: ww, h: h2 }); xx += ww; } cy += h2; ch -= h2; }
        i = j; } };
    // ---- 3 "Cortex map": area -> subfolder -> note treemap, cell area ~ 1 + links, brightness ~ recency ----
    const tmCompute = (gis, a) => { const n = nodes.length, rx = new Float32Array(n), ry = new Float32Array(n), rw = new Float32Array(n), rh = new Float32Array(n), groups = [], gm = new Map(gis.map((gi) => [gi, { gi, v: 0, subs: new Map() }]));
      nodes.forEach((nd, i) => { const g = gm.get(nd.gi); if (!g) return; g.v += 1 + deg[i]; const p = nd.path.split('/'), key = p.length > 2 ? p[1] : '·'; let s = g.subs.get(key); if (!s) g.subs.set(key, s = { v: 0, ids: [] }); s.v += 1 + deg[i]; s.ids.push(i); });
      const top = [...gm.values()].sort((x, y) => y.v - x.v); sqf(top, a.x, a.y, a.w, a.h);
      for (const g of top) { const hh = g.w > 70 && g.h > 40 ? 17 : 0; groups.push({ gi: g.gi, x: g.x, y: g.y, w: g.w, h: g.h, hh }); const subs = [...g.subs.values()].sort((x, y) => y.v - x.v); sqf(subs, g.x + 1.5, g.y + 1.5 + hh, g.w - 3, g.h - 3 - hh);
        for (const s of subs) { const lv = s.ids.map((i) => ({ i, v: 1 + deg[i] })).sort((x, y) => y.v - x.v); sqf(lv, s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1); for (const l of lv) { rx[l.i] = l.x; ry[l.i] = l.y; rw[l.i] = l.w; rh[l.i] = l.h; } } }
      return { rx, ry, rw, rh, groups, pos: nodes.map((_, i) => [rx[i] + rw[i] / 2, ry[i] + rh[i] / 2]) }; };
    const tmFull = () => memoL('tmF', vkey(), () => { const v = vp(); return tmCompute(groupNames.map((_, gi) => gi), { x: v.x0, y: v.y0, w: v.w, h: v.h }); });
    const tmBuild = () => { const f = tmFull(); if (tmZoom < 0) return f; return memoL('tmZ', vkey() + ',' + tmZoom, () => { const v = vp(), z = tmCompute([tmZoom], { x: v.x0, y: v.y0, w: v.w, h: v.h }); z.pos = nodes.map((nd, i) => nd.gi === tmZoom ? z.pos[i] : f.pos[i]); return z; }); };
    const wavy = (x, y, w, h) => { const st = 3, A = 2, f = (t) => A * Math.sin(t * TAU / 18); ctx.beginPath(); for (let t = 0; t <= w; t += st) t ? ctx.lineTo(x + t, y + f(t)) : ctx.moveTo(x, y + f(0)); for (let t = 0; t <= h; t += st) ctx.lineTo(x + w + f(t), y + t);
      for (let t = w; t >= 0; t -= st) ctx.lineTo(x + t, y + h + f(t)); for (let t = h; t >= 0; t -= st) ctx.lineTo(x + f(t), y + t); ctx.closePath(); };
    const gyP = {}, gyrus = () => { const k = S.day ? 'd' : 'n'; if (gyP[k]) return gyP[k]; const c = document.createElement('canvas'); c.width = 36; c.height = 56; const g = c.getContext('2d'); g.strokeStyle = S.day ? 'rgba(30,30,45,.06)' : 'rgba(255,255,255,.05)'; g.lineWidth = 1;
      for (let y = 3.5; y < 56; y += 7) { g.beginPath(); for (let x = 0; x <= 36; x += 2) { const yy = y + 2 * Math.sin(x * TAU / 36 + y); x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke(); } return (gyP[k] = ctx.createPattern(c, 'repeat')); };   // B5: cached gyrus texture, wavy line every 7 px
    function drawTree() { const T = tmBuild(), nb = selNb(), hot = [], lp = new Path2D(), dp = new Path2D(); ctx.globalCompositeOperation = 'source-over';
      for (const g of T.groups) { const c = gRgb(g.gi), on = !areaSet.size || areaSet.has(groupNames[g.gi] || ''); ctx.fillStyle = rgba(c, S.day ? 0.05 : 0.06 * (on ? 1 : 0.4)); wavy(g.x + 1, g.y + 1, g.w - 2, g.h - 2); ctx.fill(); ctx.fillStyle = gyrus(); ctx.fill(); }
      for (let i = 0; i < nodes.length; i++) { const w = T.rw[i]; if (!(w > 1) || !vis(nodes[i])) continue; const n = nodes[i], c = gRgb(n.gi), rec = Math.exp(-ageD(n) / 30), on = isLit(n), x = T.rx[i], y = T.ry[i], h = T.rh[i];
        ctx.fillStyle = rgba(c, (0.15 + 0.6 * rec) * (on ? 1 : 0.15) * (nb && !nb.has(i) ? 0.5 : 1)); const rd = Math.min(6, w / 3, h / 3); rr(x + 1, y + 1, w - 2, h - 2, rd); ctx.fill(); if (w > 10 && h > 10) { const x2 = x + w - 1, y2 = y + h - 1; lp.moveTo(x + 1 + rd, y + 1.5); lp.lineTo(x2 - rd, y + 1.5); lp.moveTo(x + 1.5, y + 1 + rd); lp.lineTo(x + 1.5, y2 - rd); dp.moveTo(x + 1 + rd, y2 - 1); dp.lineTo(x2 - rd, y2 - 1); dp.moveTo(x2 - 1, y + 1 + rd); dp.lineTo(x2 - 1, y2 - rd); } if (rec > 0.8 && on) hot.push(i); }
      ctx.lineWidth = 2; ctx.strokeStyle = S.day ? 'rgba(0,0,0,.14)' : 'rgba(0,0,0,.25)'; ctx.stroke(dp); ctx.lineWidth = 1; ctx.strokeStyle = S.day ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.15)'; ctx.stroke(lp);   // B5: inner emboss, one batched stroke each
      if (hot.length && !S.day) { ctx.globalCompositeOperation = 'lighter'; for (const i of hot) { const n = nodes[i], r = Math.max(T.rw[i], T.rh[i]) * 1.3 + 8; ctx.globalAlpha = 0.5 * (amOn() ? 0.75 + 0.25 * Math.sin(clock * TAU / 2.6 + i * 0.7) : 1); ctx.drawImage(hsprite(n.rgb), T.rx[i] + T.rw[i] / 2 - r, T.ry[i] + T.rh[i] / 2 - r, r * 2, r * 2); } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      if (tmZoom >= 0) { ctx.font = '11px -apple-system,sans-serif'; ctx.textBaseline = 'middle'; ctx.fillStyle = ink(0.85); for (let i = 0; i < nodes.length; i++) { if (!(T.rw[i] > 78 && T.rh[i] > 20) || !isLit(nodes[i])) continue; let t = nodes[i].name; while (t.length > 3 && ctx.measureText(t).width > T.rw[i] - 10) t = t.slice(0, -2); ctx.fillText(t, T.rx[i] + 5, T.ry[i] + 10); } }
      if (nb) for (const i of nb) { if (!(T.rw[i] > 1)) continue; ctx.strokeStyle = i === sel ? ink(0.95) : rgba(gRgb(nodes[i].gi), 0.9); ctx.lineWidth = i === sel ? 1.8 : 1; rr(T.rx[i] + 0.5, T.ry[i] + 0.5, T.rw[i] - 1, T.rh[i] - 1, 2); ctx.stroke(); }
      if (hover >= 0 && T.rw[hover] > 1) { ctx.strokeStyle = ink(0.9); ctx.lineWidth = 1.3; rr(T.rx[hover] + 0.5, T.ry[hover] + 0.5, T.rw[hover] - 1, T.rh[hover] - 1, 2); ctx.stroke(); }
      ctx.font = '600 11px -apple-system,sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      for (const g of T.groups) { const c = gRgb(g.gi), nm = gName(g.gi), on = !areaSet.size || areaSet.has(groupNames[g.gi] || ''); ctx.strokeStyle = rgba(c, on ? 0.8 : 0.25); ctx.lineWidth = 1.5; wavy(g.x + 1, g.y + 1, g.w - 2, g.h - 2); ctx.stroke();
        if (g.hh) { let t = nm + '  ' + gCount[g.gi] + (tmZoom >= 0 ? '  ·  Esc: back' : ''); while (t.length > 3 && ctx.measureText(t).width > g.w - 16) t = t.slice(0, -2); ctx.fillStyle = S.day ? 'rgba(30,30,45,.85)' : rgba(c.map((v) => lerp(v, 255, 0.55) | 0), on ? 0.95 : 0.4); ctx.fillText(t, g.x + 8, g.y + 11); } }
      ctx.fillStyle = ink(0.5); ctx.font = '11px -apple-system,sans-serif'; ctx.fillText('CORTEX MAP · area = folder, cell = note (size ~ links), brightness = recency · click an area title to zoom', L0() + 12, H - TLH() - 4); }
    // ---- 4 "Time river": streamgraph, one layer per area, thickness = notes touched that week ----
    const WKr = 7 * DAY, RW = Math.max(8, Math.min(52, Math.ceil((NOW0 - Math.min(...nodes.map((n) => n.mtime || NOW0))) / WKr) + 1)), RT0 = NOW0 - RW * WKr;
    const rwk = nodes.map((n) => Math.max(0, Math.min(RW - 1, Math.floor(((n.mtime || 0) - RT0) / WKr)))), rcnt = groupNames.map(() => new Array(RW).fill(0)); nodes.forEach((n, i) => rcnt[n.gi][rwk[i]]++);
    const rorder = (() => { const g = groupNames.map((_, gi) => gi).sort((a, b) => gCount[b] - gCount[a]), top = [], bot = []; g.forEach((q, k) => (k % 2 ? bot : top).push(q)); return [...top.reverse(), ...bot]; })(), rpos = []; rorder.forEach((gi, l) => { rpos[gi] = l; });
    const rivGeo = () => memoL('riv', vkey(), () => { const v = vp(), n = rorder.length, x0 = v.x0 + 14, x1 = v.x1 - 14, st = (x1 - x0) / (RW - 1), py0 = v.y0 + 8, py1 = v.y1 - 24, lo = [], hi = [], raw = rorder.map(() => ({ lo: [], hi: [] }));
      let ymin = Infinity, ymax = -Infinity; for (let w = 0; w < RW; w++) { let s = 0; rorder.forEach((gi, i) => { s += (n - i) * rcnt[gi][w]; }); let b = -s / (n + 1); rorder.forEach((gi, i) => { raw[i].lo[w] = b; b += rcnt[gi][w]; raw[i].hi[w] = b; ymin = Math.min(ymin, raw[i].lo[w]); ymax = Math.max(ymax, raw[i].hi[w]); }); }
      const k = (py1 - py0) / Math.max(1, ymax - ymin), cy = (py0 + py1) / 2, Y = (y) => cy - (y - (ymin + ymax) / 2) * k, xs = Array.from({ length: RW }, (_, w) => x0 + w * st), tops = [], bots = [], gr = [];
      raw.forEach((l, i) => { lo.push(l.lo.map(Y)); hi.push(l.hi.map(Y)); tops.push(xs.map((x, w) => [x, hi[i][w]])); bots.push(xs.map((x, w) => [x, lo[i][w]]).reverse()); gr.push([Math.min(...hi[i]), Math.max(...lo[i])]); });
      const pos = nodes.map((n2, i) => { const l = rpos[n2.gi], w = rwk[i], f = (hsh[i] * 7.31) % 1; return [xs[w] + (hsh[i] - 0.5) * st * 0.7, lerp(hi[l][w], lo[l][w], 0.15 + 0.7 * f)]; }); return { xs, st, x0, x1, py0, py1, lo, hi, tops, bots, gr, pos }; });
    const cat = (P, move) => { move ? ctx.moveTo(P[0][0], P[0][1]) : ctx.lineTo(P[0][0], P[0][1]); for (let i = 0; i < P.length - 1; i++) { const a = P[i - 1] || P[i], b = P[i], c = P[i + 1], d = P[i + 2] || c; ctx.bezierCurveTo(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6, c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6, c[0], c[1]); } };
    const rivWeek = (x) => { const g = rivGeo(); return Math.max(0, Math.min(RW - 1, Math.round((x - g.x0) / g.st))); };
    const mmdd = (t) => new Date(t).toISOString().slice(5, 10);
    function drawRiver() { const g = rivGeo(), v = vp(); ctx.globalCompositeOperation = 'source-over';
      for (let l = rorder.length - 1; l >= 0; l--) { const gi = rorder[l], c = gRgb(gi), on = !areaSet.size || areaSet.has(groupNames[gi] || ''), k = on ? 1 : 0.2, [y0, y1] = g.gr[l], gr = ctx.createLinearGradient(0, y0, 0, y1 + 1);
        gr.addColorStop(0, rgba(c, 0.75 * k)); gr.addColorStop(1, rgba(c, 0.35 * k)); ctx.fillStyle = gr; ctx.beginPath(); cat(g.tops[l], true); cat(g.bots[l], false); ctx.closePath(); ctx.fill(); }
      ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter';
      for (let l = 0; l < rorder.length; l++) { const gi = rorder[l], c = gRgb(gi), on = !areaSet.size || areaSet.has(groupNames[gi] || ''), k = on ? 1 : 0.2; ctx.beginPath(); cat(g.tops[l], true); ctx.strokeStyle = rgba(c, 0.07 * k); ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = rgba(c.map((q) => lerp(q, 255, 0.55) | 0), 0.85 * k); ctx.lineWidth = 1; ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
      if (range) { const a = g.x0 + (range[0] - RT0) / WKr * g.st - g.st / 2, b = g.x0 + (range[1] - RT0) / WKr * g.st - g.st / 2; ctx.fillStyle = S.day ? 'rgba(255,255,255,.55)' : 'rgba(5,4,14,.5)'; ctx.fillRect(g.x0 - 14, g.py0 - 8, Math.max(0, a - g.x0 + 14), g.py1 - g.py0 + 16); ctx.fillRect(Math.max(g.x0 - 14, b), g.py0 - 8, g.x1 + 14 - Math.max(g.x0 - 14, b), g.py1 - g.py0 + 16);
        ctx.strokeStyle = 'rgba(160,140,255,.6)'; ctx.lineWidth = 1; ctx.strokeRect(a, g.py0 - 8, b - a, g.py1 - g.py0 + 16); }
      ctx.font = '10px -apple-system,sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = ink(0.5); ctx.fillRect(Math.round(g.x0), Math.round(v.y1 - 17), Math.round(g.x1 - g.x0), 1); for (let w = RW - 1; w >= 0; w -= 3) { const tx = Math.round(Math.min(g.xs[w], v.x1 - 14)) + 0.5; ctx.fillText(mmdd(RT0 + (w + 0.5) * WKr), tx, v.y1 - 8); ctx.fillRect(tx - 0.5, v.y1 - 17, 1, 4); }
      { const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; ctx.save(); ctx.setLineDash([2, 4]); ctx.lineWidth = 1; ctx.font = '10px -apple-system,sans-serif'; ctx.textAlign = 'left'; const d0 = new Date(RT0); d0.setDate(1); d0.setHours(0, 0, 0, 0);
        for (let m = new Date(d0); m.getTime() < NOW0; m.setMonth(m.getMonth() + 1)) { const x = g.x0 + ((m.getTime() - RT0) / WKr - 0.5) * g.st; if (x < g.x0 || x > g.x1) continue; ctx.strokeStyle = ink(0.15); ctx.beginPath(); ctx.moveTo(x, g.py0 - 8); ctx.lineTo(x, g.py1 + 8); ctx.stroke(); ctx.fillStyle = ink(0.55); ctx.fillText(MN[m.getMonth()], x + 4, g.py0 - 1); } ctx.restore(); }   // B3 month ticks (wet-edge top line and 0.75 -> 0.35 gradient already existed)
      ctx.textAlign = 'left'; ctx.fillStyle = ink(0.5); ctx.font = '11px -apple-system,sans-serif'; ctx.fillText('TIME RIVER · each layer is an area, thickness = notes touched per week · drag: select a period', v.x0 + 4, v.y0 - 8);
      const [mx, my] = mouse; if (mx >= g.x0 - g.st / 2 && mx <= g.x1 + g.st / 2 && my >= g.py0 - 8 && my <= g.py1 + 8 && !(drag && drag.moved)) { const w = rivWeek(mx), x = g.xs[w]; ctx.strokeStyle = ink(0.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, g.py0 - 8); ctx.lineTo(x, g.py1 + 8); ctx.stroke();
        const rows = groupNames.map((_, gi) => [gi, rcnt[gi][w]]).filter((q) => q[1]).sort((a, b) => b[1] - a[1]), tot = rows.reduce((s, q) => s + q[1], 0), show = rows.slice(0, 7), bw = 190, bh = 24 + show.length * 15 + (rows.length > 7 ? 14 : 0), bx = Math.min(x + 14, W - bw - 10), by = Math.max(v.y0, Math.min(my - bh / 2, v.y1 - bh));
        tipBg(bx, by, bw, bh); ctx.font = '600 12px -apple-system,sans-serif'; ctx.fillText(mmdd(RT0 + w * WKr) + ' → ' + mmdd(RT0 + (w + 1) * WKr - 1) + ' · ' + tot + ' notes', bx + 12, by + 14); ctx.font = '11px -apple-system,sans-serif';
        show.forEach(([gi, cnt], k) => { const yy = by + 29 + k * 15; ctx.fillStyle = rgba(gRgb(gi), 1); ctx.beginPath(); ctx.arc(bx + 14, yy, 3.5, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(235,238,255,.85)'; ctx.fillText(gName(gi), bx + 24, yy); ctx.textAlign = 'right'; ctx.fillText(String(cnt), bx + bw - 10, yy); ctx.textAlign = 'left'; }); if (rows.length > 7) { ctx.fillStyle = 'rgba(235,238,255,.5)'; ctx.fillText('+' + (rows.length - 7) + ' more areas', bx + 24, by + bh - 10); } }
      ctx.textAlign = 'left'; }
    // ---- 5 "Constellation map" (v9b3 rewrite): every area is a constellation spread over the whole sky (golden-angle spiral + overlap relaxation), hubs = bright centre stars, short MST lines, Milky Way band ----
    const maxDeg = Math.max(1, ...deg);
    const skyGeo = () => memoL('sky', vkey(), () => { const v = vp(), n = nodes.length, G = groupNames.length, ax = v.w / 2 * 0.84, ay = v.h / 2 * 0.8, M = Math.min(v.w, v.h);
      const rho = groupNames.map((_, gi) => Math.max(24, Math.min(M * 0.17, 14 + 7.5 * Math.sqrt(gCount[gi]))));
      const ctr = groupNames.map((_, gi) => { const t = Math.sqrt((gi + 1.6) / (G + 1.6)), a = gi * 2.399963 + 0.9; return [v.cx + Math.cos(a) * t * ax, v.cy + Math.sin(a) * t * ay]; });
      for (let it = 0; it < 90; it++) { for (let a = 0; a < G; a++) for (let b = a + 1; b < G; b++) { const dx = ctr[b][0] - ctr[a][0], dy = ctr[b][1] - ctr[a][1], d = Math.hypot(dx, dy) || 0.01, need = rho[a] + rho[b] + 28; if (d < need) { const p = (need - d) / 2 / d; ctr[a][0] -= dx * p; ctr[a][1] -= dy * p; ctr[b][0] += dx * p; ctr[b][1] += dy * p; } }
        for (let a = 0; a < G; a++) { ctr[a][0] = Math.max(v.x0 + rho[a] + 8, Math.min(v.x1 - rho[a] - 8, ctr[a][0])); ctr[a][1] = Math.max(v.y0 + rho[a] + 22, Math.min(v.y1 - rho[a] - 24, ctr[a][1])); } }
      const dmax = groupNames.map(() => 1); nodes.forEach((nd, i) => { dmax[nd.gi] = Math.max(dmax[nd.gi], deg[i]); });
      const px = new Float32Array(n), py = new Float32Array(n);
      const rk = new Float32Array(n); groupNames.forEach((_, gi) => { const ids = nodes.map((_n, i) => i).filter((i) => nodes[i].gi === gi).sort((a, b) => deg[b] - deg[a] || hsh[a] - hsh[b]); ids.forEach((i, q) => { rk[i] = ids.length > 1 ? q / (ids.length - 1) : 0; }); });   // rank, not raw degree: equal-degree areas (receipts) still fill their disc
      nodes.forEach((nd, i) => { const r = rnd('sk' + nd.path), a = r() * TAU, u = r(), rad = rho[nd.gi] * (0.06 + 0.94 * Math.pow(rk[i], 0.6)) * (0.8 + 0.4 * u); px[i] = ctr[nd.gi][0] + Math.cos(a) * rad; py[i] = ctr[nd.gi][1] + Math.sin(a) * rad; });
      const mst = groupNames.map((_, gi) => { const ids = nodes.map((_n, i) => i).filter((i) => nodes[i].gi === gi).sort((a, b) => deg[b] - deg[a]).slice(0, Math.max(3, Math.min(26, Math.round(2 + 1.7 * Math.sqrt(gCount[gi]))))), E = [];
        if (ids.length < 2) return E; const used = new Set([ids[0]]), d = ids.map((i) => Math.hypot(px[i] - px[ids[0]], py[i] - py[ids[0]])), par = ids.map(() => ids[0]);
        for (let k = 1; k < ids.length; k++) { let b = -1, bd = 1e9; ids.forEach((i, q) => { if (!used.has(i) && d[q] < bd) { bd = d[q]; b = q; } }); used.add(ids[b]); E.push([par[b], ids[b]]);
          ids.forEach((i, q) => { if (!used.has(i)) { const dd = Math.hypot(px[i] - px[ids[b]], py[i] - py[ids[b]]); if (dd < d[q]) { d[q] = dd; par[q] = ids[b]; } } }); } return E; });
      const r = rnd('milky'), a0 = -0.42, dir = [Math.cos(a0), Math.sin(a0)], nor = [-dir[1], dir[0]], len = Math.hypot(v.w, v.h) * 0.55, bx = v.cx, by = v.cy + v.h * 0.04, mw = [];
      for (let k = 0; k < 1500; k++) { const t = (r() * 2 - 1) * len, s = (r() + r() + r() - 1.5) * v.h * 0.12, wob = Math.sin(t / 170) * 26, q = by - bx * 0; mw.push([bx + dir[0] * t + nor[0] * (s + wob), q + dir[1] * t + nor[1] * (s + wob), 0.6 + r() * 1.2, Math.max(0.03, 0.05 + r() * 0.25 * (1 - Math.min(1, Math.abs(s) / (v.h * 0.17)))), k % 3]); }
      return { cx: v.cx, cy: v.cy, v, rho, ctr, px, py, mst, dmax, mw, bx, by, dir, nor, len }; });
    const skyAng = () => 0.045 * Math.sin(skyRot);
    const skyPos = () => { const g = skyGeo(); return memoL('skyP', vkey() + ',' + skyRot.toFixed(4), () => { const an = skyAng(), ca = Math.cos(an), sa = Math.sin(an); return nodes.map((_, i) => { const x = g.px[i] - g.cx, y = g.py[i] - g.cy; return [g.cx + x * ca - y * sa, g.cy + x * sa + y * ca]; }); }); };
    const sparkSet = new Set(nodes.map((_, i) => i).filter((i) => nodes[i].kind !== 'spine').sort((a, b) => deg[b] - deg[a]).slice(0, 30)), skTw = (i) => skf(i) * (calm() ? 1 : 1 + 0.15 * Math.sin(clock * TAU / (2 + 3 * hsh[i]) + hsh[i] * 40));
    const skf = (i) => sel < 0 ? 1 : nodes[i].gi === nodes[sel].gi ? 1 : selNb().has(i) ? 0.6 : 0.2;
    function drawSky(dt) { if (S.turning && hover < 0 && !calm()) skyRot += dt * 0.12 * S.speed; const g = skyGeo(), pos = skyPos(), an = skyAng(), ca = Math.cos(an), sa = Math.sin(an), rot = (p) => [g.cx + (p[0] - g.cx) * ca - (p[1] - g.cy) * sa, g.cy + (p[0] - g.cx) * sa + (p[1] - g.cy) * ca], v = g.v;
      ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter'; ctx.lineCap = 'round';
      for (let k = 0; k < 9; k++) { const w = v.h * (0.4 - 0.035 * k), a = 0.016; ctx.lineWidth = w; ctx.strokeStyle = 'rgba(' + (S.day ? '110,100,190' : '150,130,255') + ',' + (S.day ? a * 1.5 : a) + ')'; ctx.beginPath(); ctx.moveTo(g.bx - g.dir[0] * g.len, g.by - g.dir[1] * g.len); ctx.quadraticCurveTo(g.bx + g.nor[0] * 40, g.by + g.nor[1] * 40, g.bx + g.dir[0] * g.len, g.by + g.dir[1] * g.len); ctx.stroke(); }
      for (let b = 0; b < 3; b++) { ctx.fillStyle = S.day ? ['#6a5fb0', '#4f78b0', '#a06aa8'][b] : ['#c9bfff', '#9fd2ff', '#ffc9ee'][b]; for (const m of g.mw) { if (m[4] !== b || m[0] < v.x0 - 20 || m[0] > v.x1 + 20 || m[1] < v.y0 - 20 || m[1] > v.y1 + 20) continue; ctx.globalAlpha = m[3] * (S.day ? 1.6 : 1); ctx.fillRect(m[0], m[1], m[2], m[2]); } } ctx.globalAlpha = 1;
      groupNames.forEach((_, gi) => { const [x, y] = rot(g.ctr[gi]), c = gRgb(gi), R = g.rho[gi] * 1.55, on = !areaSet.size || areaSet.has(groupNames[gi] || ''), gr = ctx.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, rgba(c, (S.day ? 0.17 : 0.14) * (on ? 1 : 0.3))); gr.addColorStop(1, rgba(c, 0)); ctx.fillStyle = gr; ctx.fillRect(x - R, y - R, R * 2, R * 2); });
      ctx.lineWidth = 0.8; groupNames.forEach((_, gi) => { const E = g.mst[gi]; if (!E.length) return; const c = gRgb(gi).map((q) => lerp(q, 255, 0.35) | 0), f = sel < 0 ? 1 : nodes[sel].gi === gi ? 1.8 : 0.3, on = !areaSet.size || areaSet.has(groupNames[gi] || ''); ctx.strokeStyle = rgba(c, Math.min(0.9, (S.day ? 0.4 : 0.32) * f * (on ? 1 : 0.3))); ctx.beginPath();
        for (const [a, b] of E) { if (!isLit(nodes[a]) || !isLit(nodes[b])) continue; ctx.moveTo(pos[a][0], pos[a][1]); ctx.lineTo(pos[b][0], pos[b][1]); } ctx.stroke(); });
      groupNames.forEach((_, gi) => { const c = gRgb(gi); ctx.strokeStyle = rgba(c.map((q) => lerp(q, 255, 0.55) | 0), 0.35); ctx.lineWidth = 1; ctx.beginPath(); let any = false; for (let i = 0; i < nodes.length; i++) { const nd = nodes[i]; if (nd.gi !== gi || !sparkSet.has(i) || !isLit(nd) || skf(i) < 0.5) continue; const q = pos[i], L = 1.5 * (3 + nd.size * 0.9) * (0.8 + 1.1 * Math.sqrt(deg[i] / maxDeg)); ctx.moveTo(q[0] - L, q[1]); ctx.lineTo(q[0] + L, q[1]); ctx.moveTo(q[0], q[1] - L); ctx.lineTo(q[0], q[1] + L); any = true; } if (any) ctx.stroke(); });
      ctx.globalCompositeOperation = 'source-over'; ctx.font = '600 11px -apple-system,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; try { ctx.letterSpacing = '0.6px'; } catch (e) {}
      groupNames.forEach((_, gi) => { const [x, y] = rot(g.ctr[gi]), on = !areaSet.size || areaSet.has(groupNames[gi] || ''); ctx.fillStyle = S.day ? rgba(gRgb(gi), on ? 0.95 : 0.4) : rgba(gRgb(gi).map((q) => lerp(q, 255, 0.45) | 0), on ? 0.92 : 0.35); title(gName(gi).toUpperCase() + ' · ' + gCount[gi], x, Math.min(v.y1 - 4, y + g.rho[gi] + 16)); });
      try { ctx.letterSpacing = '0px'; } catch (e) {} ctx.textAlign = 'left'; ctx.fillStyle = ink(0.5); ctx.font = '11px -apple-system,sans-serif'; ctx.fillText('CONSTELLATION MAP · each area is a constellation · bright star = hub · lines: short network of the strongest notes', v.x0 + 4, v.y0 - 8); }
    // ---- 9 "Ego radial": the selected note in the middle, neighbours on ring 1, their neighbours on ring 2 (and 3) ----
    const topDeg = (() => { let b = deg.indexOf(maxDeg), bd = -1; nodes.forEach((n, i) => { if (n.kind !== 'spine' && deg[i] <= 40 && deg[i] > bd) { bd = deg[i]; b = i; } }); return b; })(), egoC = () => sel >= 0 ? sel : topDeg;
    const egoGeo = () => memoL('ego', vkey() + ',' + egoC() + ',' + S.depth, () => { const c = egoC(), D = Math.max(1, Math.min(3, S.depth | 0)), lvl = new Int8Array(nodes.length).fill(-1), ang = new Float32Array(nodes.length), R = [0, 140, 270, 390], v = vp(); lvl[c] = 0; let front = [c]; const rings = [[c]];
      for (let k = 1; k <= D; k++) { const cand = new Map(); for (const p of front) for (const j of adj[p]) if (lvl[j] < 0) { (cand.get(j) || cand.set(j, []).get(j)).push(p); }
        let ids = [...cand.keys()].sort((a, b) => deg[b] - deg[a]).slice(0, k === 1 ? 200 : 120); if (k === 1) ids.sort((a, b) => (nodes[a].gi - nodes[b].gi) || (nodes[a].name < nodes[b].name ? -1 : 1)); ids.forEach((j) => { lvl[j] = k; });
        if (k === 1) ids.forEach((j, q) => { ang[j] = -Math.PI / 2 + TAU * q / ids.length; });
        else { ids.forEach((j) => { let sx = 0, sy = 0; for (const p of cand.get(j)) { sx += Math.cos(ang[p]); sy += Math.sin(ang[p]); } ang[j] = Math.atan2(sy, sx); }); ids.sort((a, b) => ang[a] - ang[b]); const gap = Math.min(0.06, TAU / Math.max(1, ids.length));
          for (let it = 0; it < 12; it++) for (let q = 0; q < ids.length; q++) { const a = ids[q], b = ids[(q + 1) % ids.length]; let d = ang[b] - ang[a]; if (q === ids.length - 1) d += TAU; if (d < gap && ids.length > 1) { const push = (gap - d) / 2; ang[a] -= push; ang[b] += push; } } }
        rings.push(ids); front = ids; }
      const s = Math.min(1.25, Math.min(v.w / 2, v.h / 2) / (R[D] + 26)), pos = new Array(nodes.length), par = new Map();
      nodes.forEach((n, i) => { if (lvl[i] >= 0) { pos[i] = lvl[i] ? [v.cx + Math.cos(ang[i]) * R[lvl[i]] * s, v.cy + Math.sin(ang[i]) * R[lvl[i]] * s] : [v.cx, v.cy]; return; }
        const r = rnd('eg' + n.path); let x, y, t = 0; do { x = v.x0 + r() * v.w; y = v.y0 + r() * v.h; t++; } while (t < 8 && Math.hypot(x - v.cx, y - v.cy) < R[D] * s + 36); pos[i] = [x, y]; });
      const tree = []; for (let k = 1; k <= D; k++) for (const j of rings[k]) { let p = -1, bd = 1e9; for (const q of adj[j]) if (lvl[q] === k - 1) { const d = Math.abs(Math.atan2(Math.sin(ang[q] - ang[j]), Math.cos(ang[q] - ang[j]))); if (d < bd) { bd = d; p = q; } } if (p >= 0) tree.push([p, j]); }
      return { c, D, lvl, pos, rings, tree, s, R, cx: v.cx, cy: v.cy, ang }; });
    function drawEgo() { const g = egoGeo(), re = calm() ? 1 : easeOut(cl01((performance.now() - egoAt) / 400)); ctx.globalCompositeOperation = 'source-over'; ctx.setLineDash([2, 6]); ctx.strokeStyle = ink(0.14 * (0.4 + 0.6 * re)); ctx.lineWidth = 1; ctx.font = '10px -apple-system,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      for (let k = 1; k <= g.D; k++) { const rk = g.R[k] * g.s * (0.55 + 0.45 * re); ctx.beginPath(); ctx.arc(g.cx, g.cy, rk, 0, TAU); ctx.stroke(); ctx.fillStyle = ink(0.5 * re); ctx.fillText(String(k), g.cx + rk * 0.7071 + 4, g.cy - rk * 0.7071); } ctx.setLineDash([]);   // B11: hop rings ease in over 400 ms, hop number at 45 degrees
      ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter';
      for (let k = g.D; k >= 1; k--) { ctx.lineWidth = k === 1 ? 1.2 : 0.8; for (const [p, j] of g.tree) { if (g.lvl[j] !== k || !isLit(nodes[j])) continue; const A = g.pos[p], B = g.pos[j], c = tone(nodes[j].rgb), mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2; ctx.strokeStyle = rgba(c, k === 1 ? 0.5 : 0.3); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(mx + (g.cy - my) * 0.06, my + (mx - g.cx) * 0.06, B[0], B[1]); ctx.stroke(); } }
      ctx.strokeStyle = ink(0.07); ctx.lineWidth = 0.5; ctx.beginPath(); for (const [a, b] of links) { if (g.lvl[a] > 0 && g.lvl[b] > 0) { ctx.moveTo(g.pos[a][0], g.pos[a][1]); ctx.lineTo(g.pos[b][0], g.pos[b][1]); } } ctx.stroke();
      const cn = nodes[g.c], cc = tone(cn.rgb), cr = 60; ctx.globalAlpha = 0.5; ctx.drawImage(hsprite(cn.rgb), g.cx - cr, g.cy - cr, cr * 2, cr * 2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.font = '11px -apple-system,sans-serif'; ctx.textBaseline = 'middle'; ctx.fillStyle = ink(0.85); if (g.rings[1].length <= 36) for (const j of g.rings[1]) { const a = g.ang[j], q = g.pos[j], right = Math.cos(a) >= 0; ctx.textAlign = right ? 'left' : 'right'; let t = nodes[j].name; if (t.length > 22) t = t.slice(0, 21) + '…'; ctx.fillText(t, q[0] + (right ? 12 : -12), q[1]); }
      ctx.textAlign = 'center'; ctx.font = '600 12px -apple-system,sans-serif'; ctx.fillStyle = ink(0.95); ctx.fillText(cn.name.length > 30 ? cn.name.slice(0, 29) + '…' : cn.name, g.cx, g.cy + 26);
      ctx.font = '11px -apple-system,sans-serif'; ctx.fillStyle = ink(0.55); ctx.fillText(g.rings[1].length + ' direct · ' + (g.D > 1 ? g.rings[2].length + ' second step' : '') + (sel < 0 ? '  ·  pick a note to centre it' : ''), g.cx, g.cy + 42); ctx.textAlign = 'left'; ctx.fillStyle = ink(0.5); ctx.fillText('EGO RADIAL · click: move to centre · double-click: open', L0() + 12, H - TLH() - 4); void cc; }
    // ---- 6 "Spinal section": rings = folder depth, sectors = areas, links bend toward the grey-matter butterfly ----
    const depthOf = nodes.map((n) => n.path.split('/').length - 1), maxD = Math.max(1, ...depthOf), ringR = (d) => d <= 2 ? 60 + 70 * d : 200 + 26 * (d - 2);   // spec r = 60 + 70 * depth; rings beyond 2 are packed tighter so one deep folder does not shrink the whole view
    const csGeo = () => memoL('cs', vkey(), () => { const v = vp(), Rm = ringR(maxD), s = Math.min(1.2, Math.min(v.w / 2 - 70, v.h / 2 - 34) / Rm), gap = 0.05, tot = TAU - gap * groupNames.length, sec = [], pos = new Array(nodes.length); let a = -Math.PI / 2 + gap / 2;
      groupNames.forEach((_, gi) => { const sp = tot * gCount[gi] / nodes.length, ids = nodes.map((_n, i) => i).filter((i) => nodes[i].gi === gi).sort((x, y) => (nodes[x].path < nodes[y].path ? -1 : 1)); sec[gi] = [a, a + sp];
        ids.forEach((i, q) => { const an = a + sp * (q + 0.5) / ids.length, d = depthOf[i], r = d === 0 ? s * 34 * Math.sqrt(hsh[i]) : s * ringR(d) + (hsh[i] - 0.5) * 24 * s, an2 = d === 0 ? hsh[i] * 97 % TAU : an; pos[i] = [v.cx + Math.cos(an2) * r, v.cy + Math.sin(an2) * r]; }); a += sp + gap; });
      return { cx: v.cx, cy: v.cy, s, Rm, sec, pos }; });
    const csDim = (i) => csDepth < 0 || depthOf[i] === csDepth ? 1 : 0.12;
    function drawCross() { const g = csGeo(); ctx.globalCompositeOperation = 'source-over'; const bf = (sx) => { ctx.beginPath(); ctx.moveTo(g.cx, g.cy - 30 * g.s); ctx.bezierCurveTo(g.cx + sx * 40 * g.s, g.cy - 52 * g.s, g.cx + sx * 56 * g.s, g.cy - 14 * g.s, g.cx + sx * 24 * g.s, g.cy - 2 * g.s); ctx.bezierCurveTo(g.cx + sx * 50 * g.s, g.cy + 8 * g.s, g.cx + sx * 42 * g.s, g.cy + 46 * g.s, g.cx, g.cy + 30 * g.s); ctx.closePath(); };
      ctx.fillStyle = S.day ? 'rgba(80,80,110,.1)' : 'rgba(190,190,230,.08)'; bf(1); ctx.fill(); bf(-1); ctx.fill(); ctx.strokeStyle = ink(0.2); ctx.lineWidth = 1; bf(1); ctx.stroke(); bf(-1); ctx.stroke();
      { const hp = memoL('csH', vkey(), () => { const pth = new Path2D(); for (let a = 0; a < 360; a += 6) { const t = a * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t); pth.moveTo(g.cx + c * 64 * g.s, g.cy + sn * 64 * g.s); pth.lineTo(g.cx + c * 100 * g.s, g.cy + sn * 100 * g.s); } return pth; }); ctx.strokeStyle = ink(0.05); ctx.stroke(hp); ctx.strokeStyle = ink(0.1); ctx.beginPath(); ctx.arc(g.cx, g.cy, 100 * g.s, 0, TAU); ctx.stroke(); }   // B13: white-matter ring, radial hatching every 6 degrees
      ctx.font = '10px -apple-system,sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      for (let d = 1; d <= maxD; d++) { const r = g.s * ringR(d); ctx.strokeStyle = d === csDepth ? 'rgba(160,140,255,.7)' : ink(0.09); ctx.lineWidth = d === csDepth ? 1.6 : 1; ctx.beginPath(); ctx.arc(g.cx, g.cy, r, 0, TAU); ctx.stroke(); ctx.fillStyle = ink(d === csDepth ? 0.9 : 0.45); ctx.fillText('level ' + d, g.cx + r * 0.707 + 4, g.cy - r * 0.707 - 2); }
      ctx.fillStyle = ink(0.45); ctx.fillText('root', g.cx + 22 * g.s, g.cy + 38 * g.s);
      groupNames.forEach((_, gi) => { const [a0, a1] = g.sec[gi], c = gRgb(gi), on = !areaSet.size || areaSet.has(groupNames[gi] || ''); ctx.strokeStyle = rgba(c, on ? 0.85 : 0.25); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.s * g.Rm + 18, a0, a1); ctx.stroke(); ctx.lineWidth = 1;
        if ((a1 - a0) * (g.s * g.Rm + 18) > (gName(gi).length + 4) * 7) arcText(gName(gi) + ' ' + gCount[gi], g.cx, g.cy, g.s * g.Rm + 34, (a0 + a1) / 2, ink(0.78)); });
      ctx.lineWidth = 0.6; ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter'; const cp = (p) => [g.cx + (p[0] - g.cx) * 0.35, g.cy + (p[1] - g.cy) * 0.35];
      groupNames.forEach((_, gi) => { const c = gRgb(gi); ctx.strokeStyle = rgba(c, S.day ? 0.12 : 0.085); ctx.beginPath(); let any = false; for (const [a, b] of links) { if (nodes[a].gi !== gi || !isLit(nodes[a]) || !isLit(nodes[b]) || csDim(a) < 1 || csDim(b) < 1 || (sel >= 0 && (a === sel || b === sel))) continue; const A = g.pos[a], B = g.pos[b], m = cp([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(m[0], m[1], B[0], B[1]); any = true; } if (any) ctx.stroke(); });
      const hot = (i) => { if (i < 0) return; ctx.lineWidth = 1.3; for (const j of adj[i]) { const A = g.pos[i], B = g.pos[j], m = cp([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]); ctx.strokeStyle = rgba(tone(nodes[j].rgb), 0.8); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(m[0], m[1], B[0], B[1]); ctx.stroke(); } };
      hot(sel); if (hover !== sel) hot(hover); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = ink(0.5); ctx.font = '11px -apple-system,sans-serif'; ctx.fillText('SPINAL SECTION · ring = folder depth · click a ring: pick the level · click a sector: pick the area', L0() + 12, H - TLH() - 4); }
    const csClick = (x, y) => { const g = csGeo(), dx = x - g.cx, dy = y - g.cy, r = Math.hypot(dx, dy); if (r < 10) return false; for (let d = 1; d <= maxD; d++) if (Math.abs(r - g.s * ringR(d)) < 12) { csDepth = csDepth === d ? -1 : d; wake(); return true; }
      if (r < g.s * g.Rm + 60) { let a = Math.atan2(dy, dx); while (a < -Math.PI / 2) a += TAU; for (let gi = 0; gi < groupNames.length; gi++) { const [a0, a1] = g.sec[gi]; if (a >= a0 - 0.025 && a <= a1 + 0.025) { const nm = groupNames[gi] || ''; areaSet = areaSet.size === 1 && areaSet.has(nm) ? new Set() : new Set([nm]); S.areas = [...areaSet]; save(); paintChips(); return true; } } } return false; };
    // ---- 8 "Heat body": body layout, nodes as additive heat blobs (cool violet -> cyan -> white where they pile up) ----
    const heatMetric = (i) => S.heat === 1 ? Math.min(1, Math.log2(1 + deg[i]) / 4.5) : S.heat === 2 ? (agentSet.has(i) ? 1 : 0) : Math.exp(-ageD(nodes[i]) / 10);
    const heatSprite = () => { const key = 'heat' + S.theme + S.day; if (sprites[key]) return sprites[key]; const st = THEMES[S.theme], a = st ? grad(st, 0.1) : [123, 92, 255], b = st ? grad(st, 0.65) : [47, 211, 255], D = S.day, t = (v) => D ? v.map((x) => x * 0.55 | 0) : v;
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, D ? rgba(t(b), 0.9) : 'rgba(225,245,255,0.95)'); gr.addColorStop(0.3, rgba(t(b), 0.6)); gr.addColorStop(0.65, rgba(t(a), 0.32)); gr.addColorStop(1, rgba(t(a), 0)); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (sprites[key] = c); };
    const GW = 96, GH = 160, iso = { key: '', lv: null };
    function heatIso() { const key = S.heat + '|' + nodes.length; if (iso.key === key) return iso.lv; iso.key = key; const g = new Float32Array(GW * GH), X0 = -0.5, X1 = 0.5, Y0 = -1.15, Y1 = 1.2, sg = 2.4;   // B7: low-res heat grid + marching squares, rebuilt only when the metric / data changes
      nodes.forEach((n, i) => { const v = heatMetric(i), wgt = (0.04 + 0.24 * v) * (n.kind === 'spine' ? 0.1 : n.kind === 'brain' || n.kind === 'core' ? 0.3 : 1), gx = (n.body.x - X0) / (X1 - X0) * GW, gy = (Y1 - n.body.y) / (Y1 - Y0) * GH;
        for (let y = Math.max(0, Math.floor(gy - 6)); y <= Math.min(GH - 1, Math.ceil(gy + 6)); y++) for (let x = Math.max(0, Math.floor(gx - 6)); x <= Math.min(GW - 1, Math.ceil(gx + 6)); x++) g[y * GW + x] += wgt * Math.exp(-((x - gx) ** 2 + (y - gy) ** 2) / (2 * sg * sg)); });
      let mx = 0; for (let i = 0; i < g.length; i++) if (g[i] > mx) mx = g[i]; const out = [];
      for (const f of [0.12, 0.25, 0.45, 0.7]) { const lv = f * mx, seg = [], at = (x, y) => g[y * GW + x], W2 = (gx, gy) => [X0 + gx / GW * (X1 - X0), Y1 - gy / GH * (Y1 - Y0)];
        for (let y = 0; y < GH - 1; y++) for (let x = 0; x < GW - 1; x++) { const a = at(x, y), b = at(x + 1, y), c = at(x + 1, y + 1), d = at(x, y + 1), k = (a > lv ? 1 : 0) | (b > lv ? 2 : 0) | (c > lv ? 4 : 0) | (d > lv ? 8 : 0); if (k === 0 || k === 15) continue;
          const T = () => W2(x + (lv - a) / (b - a), y), Rr = () => W2(x + 1, y + (lv - b) / (c - b)), B = () => W2(x + (lv - d) / (c - d), y + 1), L = () => W2(x, y + (lv - a) / (d - a)), add = (p, q) => seg.push(p[0], p[1], q[0], q[1]);
          switch (k) { case 1: case 14: add(L(), T()); break; case 2: case 13: add(T(), Rr()); break; case 3: case 12: add(L(), Rr()); break; case 4: case 11: add(Rr(), B()); break; case 6: case 9: add(T(), B()); break; case 7: case 8: add(L(), B()); break; case 5: add(L(), T()); add(Rr(), B()); break; case 10: add(T(), Rr()); add(L(), B()); break; } }
        out.push(seg); } return (iso.lv = out); }
    function drawIso() { const lv = heatIso(); ctx.globalCompositeOperation = 'source-over'; ctx.lineWidth = 1; lv.forEach((seg, k) => { ctx.strokeStyle = S.day ? 'rgba(40,40,70,' + (0.1 + 0.05 * k) * heatT + ')' : 'rgba(255,255,255,' + (0.1 + 0.05 * k) * heatT + ')'; ctx.beginPath(); for (let i = 0; i < seg.length; i += 4) { const a = proj(P(seg[i], seg[i + 1])), b = proj(P(seg[i + 2], seg[i + 3])); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke(); }); }
    const drawHeat = (pp) => { const sp = heatSprite(), R = 26 * scale() / 330; ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter';
      for (const i of order) { const n = nodes[i]; if (!vis(n) || fdv[i] <= 0.01) continue; const v = heatMetric(i); if (S.heat === 2 && v < 0.02) continue; const q = pp[i], br = amOn() ? 1 + 0.1 * Math.sin(clock * TAU / 3.4 + i * 1.7) : 1, r = R * q[2] * br; ctx.globalAlpha = Math.min(1, br * (0.04 + 0.24 * v) * (n.kind === 'spine' ? 0.1 : n.kind === 'brain' || n.kind === 'core' ? 0.3 : 1) * (isLit(n) ? 1 : 0.1) * heatT * fdv[i] * (S.day ? 1.6 : 1)); ctx.drawImage(sp, q[0] - r, q[1] - r, r * 2, r * 2); }
      ctx.globalAlpha = 1; drawIso(); };
    // ---- v9 batch 3: path finder (12) + Reflex arc (7), Neuron (1), Synapse network (2), 3D brain (10), suggestions (24), compare (19), tour (23), tags (18), sound (26) ----
    let pathA = -1, pathB = -1, pathR = null, pathX = new Set(), pathPillEl = null, nHist = [], nLast = -1, nBack = false, tourOn = false, tourI = 0, tourT = 0, ac = null;
    const bfs = (a, b, ban) => { if (a === b) return [a]; const prv = new Int32Array(nodes.length).fill(-2); prv[a] = -1; let q = [a];
      while (q.length) { const nx = []; for (const u of q) for (const v of adj[u]) { if (prv[v] !== -2 || ban.has(v)) continue; prv[v] = u; if (v === b) { const r = [b]; for (let w = u; w >= 0; w = prv[w]) r.push(w); return r.reverse(); } nx.push(v); } q = nx; } return null; };
    const pathName = (i) => nodes[i].name.length > 26 ? nodes[i].name.slice(0, 25) + '…' : nodes[i].name;
    function paintPath() { if (!pathPillEl) return; pathPillEl.style.display = pathA >= 0 ? 'flex' : 'none'; if (pathA < 0) return; const t = pathPillEl.firstChild;
      t.textContent = pathB < 0 ? 'Path: A = ' + pathName(pathA) + ' · Shift+click for B' : pathR ? 'Path: ' + pathName(pathA) + ' → ' + pathName(pathB) + ' · ' + (pathR.length - 1) + ' steps' : 'No path: ' + pathName(pathA) + ' ↛ ' + pathName(pathB); }
    function clearPath() { pathA = pathB = -1; pathR = null; pathX = new Set(); paintPath(); wake(); }
    function setPathPt(i) { if (pathA < 0 || pathB >= 0) { pathA = i; pathB = -1; pathR = null; pathX = new Set(); toast('A: ' + nodes[i].name + ' · Shift+click for B'); }
      else if (i === pathA) { clearPath(); return; } else { pathB = i; pathX = new Set(); pathR = bfs(pathA, pathB, pathX); toast(pathR ? (pathR.length - 1) + '-step path' : 'no path'); } paintPath(); wake(); }
    const pathKey = () => { if (sel < 0) { pathR || pathA >= 0 ? clearPath() : toast('Select a note first, then P'); return; } setPathPt(sel); };
    function nextPath() { if (!pathR || pathR.length < 3) { toast('no other path'); return; } pathX.add(pathR[pathR.length >> 1]); let r = bfs(pathA, pathB, pathX); if (!r) { pathX = new Set(); r = bfs(pathA, pathB, pathX); toast('no other path, back to the first'); } else toast('next path · ' + (r.length - 1) + ' steps'); pathR = r; paintPath(); wake(); }
    function stepPath(d) { if (!pathR) return false; const k = pathR.indexOf(sel), j = Math.max(0, Math.min(pathR.length - 1, (k < 0 ? (d > 0 ? -1 : pathR.length) : k) + d)); sel = pathR[j]; showCard(sel); flash = { i: sel, t0: clock }; wake(); return true; }
    const qb = (p, c, q, f) => [(1 - f) * (1 - f) * p[0] + 2 * (1 - f) * f * c[0] + f * f * q[0], (1 - f) * (1 - f) * p[1] + 2 * (1 - f) * f * c[1] + f * f * q[1]];
    const drawArc = (pos) => { const R = pathR, pts = R.map((i) => pos[i]), ctl = (k) => { const p = pts[k - 1], q = pts[k]; return [(p[0] + q[0]) / 2 - (q[1] - p[1]) * 0.12, (p[1] + q[1]) / 2 + (q[0] - p[0]) * 0.12]; };
      ctx.save(); ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [w, a, c] of [[7, 0.14, '255,110,150'], [2.2, 0.95, S.day ? '200,40,90' : '255,215,228']]) { ctx.strokeStyle = 'rgba(' + c + ',' + a + ')'; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((q, k) => { if (k) { const c2 = ctl(k); ctx.quadraticCurveTo(c2[0], c2[1], q[0], q[1]); } else ctx.moveTo(q[0], q[1]); }); ctx.stroke(); }
      const u = (clock / 1.2) % (R.length - 1), k = Math.floor(u) + 1, f = u - (k - 1), sp = sprite([255, 190, 215]);
      for (let j = 4; j >= 0; j--) { const ff = Math.max(0, f - j * 0.07), q = qb(pts[k - 1], ctl(k), pts[k], ff), s = j ? 9 - j : 16; ctx.globalAlpha = j ? 0.5 - j * 0.09 : 1; ctx.drawImage(sp, q[0] - s, q[1] - s, s * 2, s * 2); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.font = '600 11px -apple-system,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      pts.forEach((q, k2) => { const e = k2 === 0 || k2 === pts.length - 1; ctx.strokeStyle = S.day ? 'rgba(200,40,90,.9)' : 'rgba(255,170,200,.95)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q[0], q[1], e ? 10 : 5.5, 0, TAU); ctx.stroke(); if (e) { ctx.fillStyle = ink(0.95); ctx.fillText(k2 ? 'B' : 'A', q[0], q[1] - 18); } }); ctx.restore(); };
    const drawExtra = (pos, body) => { ctx.save(); ctx.globalAlpha = 1;   // the body pass leaves a low alpha behind
      if (cmpPair && cmpX.length) { ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter'; ctx.strokeStyle = S.day ? 'rgba(170,110,0,.45)' : 'rgba(255,213,106,.4)'; ctx.lineWidth = 0.9; ctx.beginPath(); for (const [a, b] of cmpX.slice(0, 500)) { ctx.moveTo(pos[a][0], pos[a][1]); ctx.lineTo(pos[b][0], pos[b][1]); } ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
      if (pathR && pathR.length > 1 && S.view !== 'Reflex arc') drawArc(pos); ctx.restore(); };
    // ---- 7 "Reflex arc": shortest path between two notes as a chain with a sine wobble, first-degree neighbours as a faint halo, one comet A -> B ----
    // idle demo: busiest note -> a far note reachable from it (<= 6 steps), computed once
    const demoPath = () => memoL('refDemo', 'd', () => { let h = 0; for (let i = 1; i < nodes.length; i++) if (deg[i] > deg[h]) h = i;
      const dist = new Int16Array(nodes.length).fill(-1); dist[h] = 0; let q = [h], far = h;
      for (let d = 1; d <= 6 && q.length; d++) { const nx = []; for (const u of q) for (const v of adj[u]) if (dist[v] < 0) { dist[v] = d; nx.push(v); if (d > dist[far] || (d === dist[far] && deg[v] > deg[far])) far = v; } q = nx; }
      return far === h ? [] : bfs(h, far, new Set()) || []; });
    const refGeo = () => memoL('ref', vkey() + ',' + (pathR ? pathR.join() : pathA), () => { const v = vp(), n = nodes.length, pos = new Array(n), role = new Int8Array(n), R = pathR || (pathA >= 0 ? [pathA] : demoPath()), demo = !pathR && pathA < 0 && R.length > 1, L = R.length, x0 = v.x0 + 70, x1 = v.x1 - 70, chain = [], pl = [];
      R.forEach((i, k) => { const x = L > 1 ? lerp(x0, x1, k / (L - 1)) : v.cx, y = v.cy + (L > 1 ? Math.sin(k * 1.35 + 0.6) * 40 : 0); pos[i] = [x, y]; role[i] = 2; chain.push([x, y]); });
      R.forEach((i, k) => { const nb = [...new Set(adj[i])].filter((j) => !role[j]).sort((a, b) => deg[b] - deg[a]).slice(0, 14); nb.forEach((j, q) => { const a = q * 2.399963 + k, r = 30 + 30 * Math.sqrt((q + 1) / 14); pos[j] = [chain[k][0] + Math.cos(a) * r, chain[k][1] + Math.sin(a) * r]; role[j] = 1; }); });
      nodes.forEach((nd, i) => { if (pos[i]) return; const r = rnd('rf' + nd.path); pos[i] = [v.x0 + r() * v.w, v.y0 + r() * v.h]; });
      for (let k = 0; k + 1 < L; k++) for (let s = 0; s < 24; s++) { const f = s / 24; pl.push([lerp(chain[k][0], chain[k + 1][0], f), lerp(chain[k][1], chain[k + 1][1], (1 - Math.cos(Math.PI * f)) / 2)]); }
      if (L) pl.push(chain[L - 1]); return { pos, role, chain, pl, R, v, demo }; });
    const inE = (u) => u < 0.5 ? Math.cbrt(u / 4) : 1 - Math.cbrt(2 * (1 - u)) / 2, refP = () => { const k = pathR ? pathR.join() : String(pathA); if (k !== refKey) { refKey = k; refT0 = performance.now(); } const age = calm() ? 9 : (performance.now() - refT0) / 1000, u = cl01(age / 0.7); return { age, p: ezIO(u) }; };
    const refFl = (i) => { const g = refGeo(), k = g.R.indexOf(i); if (k < 0 || g.R.length < 2) return 1; const rp = refP(), fa = rp.age - 0.7 * inE(cl01(k / (g.R.length - 1))); return fa < 0 ? 0.6 : fa < 0.18 ? 1.3 - 0.3 * fa / 0.18 : 1; };   // B12: node flash 1.3 -> 1 over 180 ms when the stroke head arrives
    function drawRef() { const g = refGeo(), v = g.v, R = g.R, rp = refP(), DA = g.demo ? 0.5 : 1; ctx.globalCompositeOperation = 'source-over'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = ink(0.5); ctx.font = '11px -apple-system,sans-serif';
      ctx.fillText('REFLEX ARC · Shift+click: A, B · N: next · ← →', v.x0 + 4, v.y0 - 8);
      if (!R.length) { ctx.textAlign = 'center'; ctx.fillStyle = ink(0.7); ctx.font = '600 14px -apple-system,sans-serif'; ctx.fillText('Pick two notes for a path', v.cx, v.cy - 10); ctx.font = '12px -apple-system,sans-serif'; ctx.fillStyle = ink(0.5); ctx.fillText('Shift+click the first (A), then the second (B) · or select a note and press P', v.cx, v.cy + 14); ctx.textAlign = 'left'; return; }
      ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter'; ctx.lineWidth = 0.7; ctx.globalAlpha = DA;
      R.forEach((i, k) => { ctx.strokeStyle = rgba(tone(nodes[i].rgb), 0.16); ctx.beginPath(); for (const j of adj[i]) if (g.role[j] === 1 && Math.hypot(g.pos[j][0] - g.chain[k][0], g.pos[j][1] - g.chain[k][1]) < 62) { ctx.moveTo(g.chain[k][0], g.chain[k][1]); ctx.lineTo(g.pos[j][0], g.pos[j][1]); } ctx.stroke(); });
      if (g.pl.length > 1) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; for (const [w, a] of [[9, 0.1], [3, 0.5], [1.4, 1]]) { ctx.lineWidth = w; for (let k = 0; k + 1 < R.length; k++) { const fk = cl01(rp.p * (R.length - 1) - k), ns = Math.round(24 * fk); if (ns < 1) continue; const c1 = tone(nodes[R[k]].rgb), c2 = tone(nodes[R[k + 1]].rgb), A = g.chain[k], B = g.chain[k + 1], gr = ctx.createLinearGradient(A[0], A[1], B[0], B[1]);
            gr.addColorStop(0, rgba(w < 2 ? c1.map((q) => lerp(q, 255, 0.5) | 0) : c1, a)); gr.addColorStop(1, rgba(w < 2 ? c2.map((q) => lerp(q, 255, 0.5) | 0) : c2, a)); ctx.strokeStyle = gr; ctx.beginPath(); for (let s = 0; s <= ns; s++) { const q = g.pl[k * 24 + s]; s ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke(); } }
        if (rp.p >= 1 && !calm()) { const t = (clock / (1.2 * (R.length - 1))) % 1, f = t * (g.pl.length - 1), sp = sprite([255, 235, 215]); for (let j = 5; j >= 0; j--) { const q = g.pl[Math.max(0, Math.floor(f - j * 2))], s = j ? 9 - j : 17; ctx.globalAlpha = (j ? 0.55 - j * 0.08 : 1) * DA; ctx.drawImage(sp, q[0] - s, q[1] - s, s * 2, s * 2); } ctx.globalAlpha = DA; } }
      ctx.globalCompositeOperation = 'source-over'; ctx.font = '11px -apple-system,sans-serif'; ctx.textAlign = 'center';
      R.forEach((i, k) => { const q = g.chain[k], up = k % 2 === 0, fl = refFl(i); if (fl < 1 && fl === 0.6) return; ctx.fillStyle = ink(0.85); ctx.fillText((k === 0 ? 'A · ' : k === R.length - 1 && R.length > 1 ? 'B · ' : '') + pathName(i), q[0], q[1] + (up ? -22 : 24)); ctx.strokeStyle = rgba(tone(nodes[i].rgb), 0.9); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(q[0], q[1], 8 * fl, 0, TAU); ctx.stroke(); });
      ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.font = '600 12px -apple-system,sans-serif'; ctx.fillStyle = ink(0.8);
      ctx.fillText(g.demo ? 'Sample path · ' + (R.length - 1) + ' steps · Shift+click the first (A), then the second (B) for your own path' : pathB < 0 ? 'A selected · Shift+click for B' : pathR ? (R.length - 1) + (R.length === 2 ? ' step · directly linked' : ' steps') : 'no path · these two notes are in separate parts', v.cx, v.y1 - 8); ctx.textAlign = 'left'; }
    // ---- 1 "Neuron": the selected note as a neuron. soma = note, dendrites = backlinks, axon = outlinks, terminals = link targets, synapse ring = mutual link ----
    const folderKey = (p) => p.split('/').slice(0, -1).slice(0, 3).join('/');
    const neyGeo = () => memoL('ney', vkey() + ',' + egoC(), () => { const c = egoC(), v = vp(), n = nodes.length, pos = new Array(n), role = new Int8Array(n), mut = new Set(), inl = [...new Set(inA[c])], outl = [...new Set(outA[c])], outS = new Set(outl);
      inl.forEach((j) => { if (outS.has(j)) mut.add(j); });
      const s = Math.max(0.55, Math.min(1.7, v.w * 0.36 / 300, (v.h / 2 - 30) / 250)), cx = v.x0 + v.w * 0.4, cy = v.cy, rS = (14 + 3 * Math.sqrt(deg[c])) * s;
      const dIn = inl.slice().sort((a, b) => deg[b] - deg[a]).slice(0, 40).sort((a, b) => { const ka = folderKey(nodes[a].path), kb = folderKey(nodes[b].path); return ka < kb ? -1 : ka > kb ? 1 : nodes[a].name < nodes[b].name ? -1 : 1; });
      const m = dIn.length, cls = new Map(), den = [], trunks = []; dIn.forEach((j, k) => { const key = folderKey(nodes[j].path); (cls.get(key) || cls.set(key, []).get(key)).push({ j, a: lerp(1.745, 4.538, (k + 0.5) / m) }); });
      for (const cl of cls.values()) { const am = cl.reduce((q, t) => q + t.a, 0) / cl.length; let rm = 0; cl.forEach((t, q) => { t.r = (120 + 38 * (q % 4)) * s; rm += t.r; }); rm /= cl.length; const rf = rS + (rm - rS) * 0.6, f0 = [cx + Math.cos(am) * rS, cy + Math.sin(am) * rS], fk = [cx + Math.cos(am) * rf, cy + Math.sin(am) * rf];
        if (cl.length > 1) trunks.push([f0, fk]);
        cl.forEach((t) => { const tip = [cx + Math.cos(t.a) * t.r, cy + Math.sin(t.a) * t.r], st = cl.length > 1 ? fk : [cx + Math.cos(t.a) * rS, cy + Math.sin(t.a) * rS], sg = hsh[t.j] < 0.5 ? 1 : -1; pos[t.j] = tip; role[t.j] = 1; den.push({ j: t.j, tip, st, f0: cl.length > 1 ? f0 : st, cp: [(st[0] + tip[0]) / 2 - (tip[1] - st[1]) * 0.12 * sg, (st[1] + tip[1]) / 2 + (tip[0] - st[0]) * 0.12 * sg] }); }); }
      pos[c] = [cx, cy]; role[c] = 3; const ax0 = cx + rS, ax1 = cx + rS + 240 * s, bout = [], ordOut = outl.slice().sort((a, b) => deg[b] - deg[a]).slice(0, 40), show = ordOut.length;
      ordOut.forEach((j, k) => { const ring = Math.floor(k / 12), cnt = Math.min(12, show - ring * 12), q = k % 12, ang = cnt > 1 ? lerp(-1, 1, q / (cnt - 1)) : 0, r = (80 + 44 * ring) * s, p = [ax1 + Math.cos(ang) * r, cy + Math.sin(ang) * r], gh = role[j] === 1; if (!gh) { pos[j] = p; role[j] = 2; } bout.push({ j, p, gh }); });
      nodes.forEach((nd, i) => { if (pos[i]) return; const r = rnd('ny' + nd.path); pos[i] = [v.x0 + r() * v.w, v.y0 + r() * v.h]; });
      return { c, v, s, cx, cy, rS, ax0, ax1, den, trunks, bout, pos, role, mut, nIn: inl.length, nOut: outl.length, nMut: mut.size, sh: m }; });
    const neyBack = () => { if (S.view !== 'Neuron' || !nHist.length) return false; sel = nHist.pop(); nBack = true; showCard(sel); wake(); return true; };
    function drawNey() { const g = neyGeo(), c = nodes[g.c], col = tone(c.rgb), s = g.s, t = clock, L = S.day ? 'source-over' : 'lighter', sp = sprite(c.rgb);
      if (g.c !== nLast) { if (nLast >= 0 && !nBack) { nHist.push(nLast); if (nHist.length > 30) nHist.shift(); } nLast = g.c; nBack = false; }
      ctx.globalCompositeOperation = L; ctx.lineCap = 'round';
      const dpath = (d) => { ctx.moveTo(d.st[0], d.st[1]); ctx.quadraticCurveTo(d.cp[0], d.cp[1], d.tip[0], d.tip[1]); };
      for (const [w, a] of [[6, 0.08], [1.5, 0.55]]) { ctx.lineWidth = w * (w > 2 ? s : 1);
        for (const d of g.den) { ctx.strokeStyle = rgba(tone(nodes[d.j].rgb), a); ctx.beginPath(); dpath(d); ctx.stroke(); }
        ctx.strokeStyle = rgba(col, a * 1.1); ctx.lineWidth = w * (w > 2 ? 1.3 : 2.1) * s; ctx.beginPath(); for (const [f0, fk] of g.trunks) { ctx.moveTo(f0[0], f0[1]); ctx.lineTo(fk[0], fk[1]); } ctx.stroke();
        ctx.lineWidth = w * (w > 2 ? 1.2 : 1.8) * s; ctx.beginPath(); ctx.moveTo(g.ax0, g.cy); ctx.lineTo(g.ax1, g.cy); ctx.stroke(); }
      ctx.lineWidth = 1.1; for (const b of g.bout) { ctx.strokeStyle = rgba(tone(nodes[b.j].rgb), 0.45); ctx.beginPath(); ctx.moveTo(g.ax1, g.cy); ctx.quadraticCurveTo(g.ax1 + (b.p[0] - g.ax1) * 0.4, g.cy + (b.p[1] - g.cy) * 0.95, b.p[0], b.p[1]); ctx.stroke(); }
      const hl = rgb2hsl(col), colL = hsl2rgb([hl[0], hl[1], 0.6]), colH = hsl2rgb([hl[0], hl[1] * 0.6, 0.9]), nSeg = Math.max(1, Math.floor((g.ax1 - g.ax0 - 6 * s) / (22 * s))), lit = calm() ? -1 : Math.floor((clock % 3) / 0.07);   // B10: myelin segments 18 px, gaps 4 px; one impulse hops from gap to gap every 3 s
      for (let k = 0; k < nSeg; k++) { const x = g.ax0 + 4 * s + k * 22 * s; rr(x, g.cy - 4 * s, 18 * s, 8 * s, 4 * s); ctx.fillStyle = rgba(colL, k === lit ? 0.9 : 0.14); ctx.fill(); ctx.strokeStyle = rgba(k === lit ? colH : colL, k === lit ? 1 : 0.5); ctx.lineWidth = 1; ctx.stroke(); if (k === lit) { ctx.globalAlpha = 0.9; ctx.drawImage(sp, x + 9 * s - 14 * s, g.cy - 14 * s, 28 * s, 28 * s); ctx.globalAlpha = 1; } }
      const pu = (pt, u, A, B) => [lerp(A[0], B[0], u), lerp(A[1], B[1], u)], tx = calm() ? 0 : t;
      g.den.slice(0, 16).forEach((d) => { const u = (tx * 0.42 + hsh[d.j] * 3) % 1, tr = d.st !== d.f0, u1 = tr ? 0.65 : 1; const q = u < u1 ? qb(d.tip, d.cp, d.st, u / u1) : pu(0, (u - u1) / (1 - u1), d.st, d.f0); ctx.globalAlpha = 0.9; ctx.drawImage(sp, q[0] - 6, q[1] - 6, 12, 12); });
      g.bout.slice(0, 20).forEach((b) => { if (b.gh) return; const u = (tx * 0.5 + hsh[b.j] * 3) % 1, q = qb([g.ax1, g.cy], [g.ax1 + (b.p[0] - g.ax1) * 0.4, g.cy + (b.p[1] - g.cy) * 0.95], b.p, u); ctx.globalAlpha = 1 - u * 0.6; ctx.drawImage(sprite(nodes[b.j].rgb), q[0] - 5, q[1] - 5, 10, 10); });
      ctx.globalAlpha = 1; const R = g.rS * (1 + 0.05 * Math.sin(tx * 2.4)), gr = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, R * 2.6); gr.addColorStop(0, rgba(col, 0.55)); gr.addColorStop(0.45, rgba(col, 0.16)); gr.addColorStop(1, rgba(col, 0)); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(g.cx, g.cy, R * 2.6, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = rgba(col.map((q) => lerp(q, 255, 0.35) | 0), S.day ? 0.9 : 0.78); ctx.beginPath(); ctx.arc(g.cx, g.cy, R, 0, TAU); ctx.fill(); ctx.strokeStyle = ink(0.8); ctx.lineWidth = 1.4; ctx.stroke(); ctx.fillStyle = rgba(col.map((q) => q * 0.35 | 0), 0.8); ctx.beginPath(); ctx.arc(g.cx + R * 0.15, g.cy - R * 0.1, R * 0.34, 0, TAU); ctx.fill();
      for (const b of g.bout) { ctx.strokeStyle = b.gh ? 'rgba(255,213,106,.9)' : rgba(tone(nodes[b.j].rgb), 0.7); ctx.lineWidth = 1.2; ctx.setLineDash(b.gh ? [2, 2] : []); ctx.beginPath(); ctx.arc(b.p[0], b.p[1], 5.5 * s + 1, 0, TAU); ctx.stroke(); } ctx.setLineDash([]);
      for (const j of g.mut) if (g.role[j] === 1) { const q = g.pos[j]; ctx.strokeStyle = 'rgba(255,213,106,.9)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(q[0], q[1], 8, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(q[0], q[1], 11.5, 0, TAU); ctx.stroke(); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = ink(0.95); ctx.font = '600 12px -apple-system,sans-serif'; ctx.fillText(pathName(g.c), g.cx, g.cy + g.rS + 34);
      ctx.font = '11px -apple-system,sans-serif'; ctx.fillStyle = ink(0.6); ctx.fillText(deg[g.c] ? g.nIn + ' in · ' + g.nOut + ' out · ' + g.nMut + ' mutual' : 'unlinked', g.cx, g.cy + g.rS + 51);
      ctx.textAlign = 'left'; ctx.fillStyle = ink(0.5); ctx.fillText('DENDRITES · backlinks (' + g.nIn + (g.nIn > g.sh ? ', strongest ' + g.sh : '') + ')', g.v.x0 + 6, g.v.y0 + 24); ctx.fillText('AXON · outgoing (' + g.nOut + (g.nOut > 40 ? ', strongest 40' : '') + ') · yellow ring = mutual', g.ax1 - 60 * s, g.v.y0 + 24);
      ctx.fillText('NEURON · click a note: new soma · Backspace: back', g.v.x0 + 6, H - TLH() - 4); }
    // ---- 2 "Synapse network": force layout precomputed in ~3 ms chunks (cell-grid repulsion, no O(n^2)); drag pins a node, double-click unpins all ----
    const fsN = { x: new Float32Array(nodes.length), y: new Float32Array(nodes.length), vx: new Float32Array(nodes.length), vy: new Float32Array(nodes.length), it: 0, tot: 300, run: false, ver: 0, pin: new Set(), px: 0, py: 0, init: false, R: 200, mx: 0, my: 0, d: null, node: -1, lx: 0, ly: 0 };
    const fsInit = () => { if (fsN.init) return; fsN.init = true; nodes.forEach((n, i) => { const r = rnd('fs' + n.path), a = r() * TAU, d = 30 + r() * 80, g = n.gi * 2.4; fsN.x[i] = Math.cos(g) * 150 + Math.cos(a) * d; fsN.y[i] = Math.sin(g) * 150 + Math.sin(a) * d; }); fsFit(); };
    function fsFit() { const ids = []; let sx = 0, sy = 0; for (let i = 0; i < nodes.length; i++) if (deg[i]) { ids.push(i); sx += fsN.x[i]; sy += fsN.y[i]; } const k = Math.max(1, ids.length); fsN.mx = sx / k; fsN.my = sy / k;
      const rs = ids.map((i) => Math.hypot(fsN.x[i] - fsN.mx, fsN.y[i] - fsN.my)).sort((a, b) => a - b), r95 = rs.length ? rs[Math.floor(rs.length * 0.95)] : 100; fsN.R = Math.max(60, r95 * 1.2);
      for (let i = 0; i < nodes.length; i++) if (!deg[i]) { const a = hsh[i] * TAU * 3.7; fsN.x[i] = fsN.mx + Math.cos(a) * fsN.R * 0.97; fsN.y[i] = fsN.my + Math.sin(a) * fsN.R * 0.97; } }
    function fsStep() { const n = nodes.length, { x, y, vx, vy } = fsN, cell = 60, al = Math.max(0.06, 1 - fsN.it / fsN.tot), G = new Map(), ng = groupNames.length, gx = new Float64Array(ng), gy = new Float64Array(ng), gn = new Float64Array(ng), fx = new Float32Array(n), fy = new Float32Array(n);
      for (let i = 0; i < n; i++) { if (!deg[i]) continue; const g = nodes[i].gi; gx[g] += x[i]; gy[g] += y[i]; gn[g]++; const k = Math.floor(x[i] / cell) * 4096 + Math.floor(y[i] / cell); (G.get(k) || G.set(k, []).get(k)).push(i); }
      for (let i = 0; i < n; i++) { if (!deg[i]) continue; const cx = Math.floor(x[i] / cell), cy = Math.floor(y[i] / cell);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = G.get((cx + a) * 4096 + cy + b); if (!l) continue; for (const j of l) { if (j <= i) continue; let dx = x[i] - x[j], dy = y[i] - y[j], d2 = dx * dx + dy * dy; if (d2 >= cell * cell) continue; if (d2 < 0.01) { dx = 0.3; dy = 0.2; d2 = 0.13; } const d = Math.sqrt(d2), f = 2.2 * (1 - d / cell) / d; fx[i] += dx * f; fy[i] += dy * f; fx[j] -= dx * f; fy[j] -= dy * f; } } }
      for (const [a, b] of links) { const dx = x[b] - x[a], dy = y[b] - y[a], d = Math.hypot(dx, dy) || 0.1, f = 0.07 * (d - 40) / d / Math.sqrt(Math.min(deg[a], deg[b])); fx[a] += dx * f; fy[a] += dy * f; fx[b] -= dx * f; fy[b] -= dy * f; }
      for (let i = 0; i < n; i++) { if (!deg[i] || fsN.pin.has(i)) continue; const g = nodes[i].gi; fx[i] += (gx[g] / gn[g] - x[i]) * 0.012 - x[i] * 0.0025; fy[i] += (gy[g] / gn[g] - y[i]) * 0.012 - y[i] * 0.0025;
        vx[i] = Math.max(-12, Math.min(12, (vx[i] + fx[i] * al) * 0.7)); vy[i] = Math.max(-12, Math.min(12, (vy[i] + fy[i] * al) * 0.7)); x[i] += vx[i]; y[i] += vy[i]; } }
    function fsKick() { fsInit(); if (fsN.run || fsN.it >= fsN.tot) return; fsN.run = true;
      const tick = () => { if (dead) return; const t0 = performance.now(); do { fsStep(); fsN.it++; } while (fsN.it < fsN.tot && performance.now() - t0 < 3); fsFit(); fsN.ver++; wake(); if (fsN.it < fsN.tot) setTimeout(tick, 16); else fsN.run = false; }; setTimeout(tick, 0); }
    const fsScale = () => { const v = vp(); return Math.min(v.w, v.h) / 2 / (fsN.R || 200) * 0.94 * zoom; };
    const fsPos = () => { fsInit(); fsKick(); return memoL('fs', vkey() + ',' + fsN.ver + ',' + zoom.toFixed(3) + ',' + fsN.px.toFixed(1) + ',' + fsN.py.toFixed(1), () => { const v = vp(), sc = fsScale(); return nodes.map((_, i) => [v.cx + fsN.px + (fsN.x[i] - fsN.mx) * sc, v.cy + fsN.py + (fsN.y[i] - fsN.my) * sc]); }); };
    const fsDrag = (sx, sy, x, y) => { if (fsN.d !== drag) { fsN.d = drag; fsN.node = dotHit(sx, sy); fsN.lx = sx; fsN.ly = sy; if (fsN.node >= 0 && !deg[fsN.node]) fsN.node = -1; if (fsN.node >= 0) fsN.pin.add(fsN.node); }
      const dx = x - fsN.lx, dy = y - fsN.ly, sc = fsScale(); fsN.lx = x; fsN.ly = y;
      if (fsN.node >= 0) { const i = fsN.node; fsN.x[i] += dx / sc; fsN.y[i] += dy / sc; fsN.vx[i] = fsN.vy[i] = 0; fsN.it = Math.min(fsN.it, fsN.tot - 60); fsKick(); } else { fsN.px += dx; fsN.py += dy; } fsN.ver++; wake(); };
    const netCtl = (pos) => memoL('fsCtl', vkey() + ',' + fsN.ver + ',' + zoom.toFixed(3) + ',' + fsN.px.toFixed(1) + ',' + fsN.py.toFixed(1), () => { const G = groupNames.length, sx = new Float64Array(G), sy = new Float64Array(G), sn = new Float64Array(G); nodes.forEach((n, i) => { if (deg[i]) { sx[n.gi] += pos[i][0]; sy[n.gi] += pos[i][1]; sn[n.gi]++; } });
      return links.map(([a, b]) => { const ga = nodes[a].gi, gb = nodes[b].gi; if (ga === gb || !sn[ga] || !sn[gb]) return null; const mx = (pos[a][0] + pos[b][0]) / 2, my = (pos[a][1] + pos[b][1]) / 2, cx = (sx[ga] / sn[ga] + sx[gb] / sn[gb]) / 2, cy = (sy[ga] / sn[ga] + sy[gb] / sn[gb]) / 2; return [mx + (cx - mx) * 0.35, my + (cy - my) * 0.35]; }); });   // B8: cross-area links bend toward the midpoint of the two area centroids; recomputed only when the layout moves
    function drawNet() { const pos = fsPos(), v = vp(), ctl = netCtl(pos); ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter'; ctx.lineWidth = 0.6; ctx.strokeStyle = S.day ? 'rgba(60,70,150,.1)' : 'rgba(150,165,255,.09)'; ctx.beginPath();
      links.forEach(([a, b], li) => { if (!aOk(nodes[a]) || !aOk(nodes[b]) || !isLit(nodes[a]) || !isLit(nodes[b]) || a === sel || b === sel) return; ctx.moveTo(pos[a][0], pos[a][1]); const c = ctl[li]; c ? ctx.quadraticCurveTo(c[0], c[1], pos[b][0], pos[b][1]) : ctx.lineTo(pos[b][0], pos[b][1]); }); ctx.stroke();
      const hot = (i) => { if (i < 0) return; ctx.lineWidth = 1.2; for (const j of adj[i]) { ctx.strokeStyle = rgba(tone(nodes[j].rgb), 0.7); ctx.beginPath(); ctx.moveTo(pos[i][0], pos[i][1]); ctx.lineTo(pos[j][0], pos[j][1]); ctx.stroke(); } }; hot(sel); if (hover !== sel) hot(hover);
      ctx.globalCompositeOperation = 'source-over'; ctx.font = '600 11px -apple-system,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const sc = fsScale();
      groupNames.forEach((_, gi) => { if (gCount[gi] < 6) return; let sx = 0, sy = 0, k = 0; nodes.forEach((n, i) => { if (n.gi === gi && deg[i]) { sx += pos[i][0]; sy += pos[i][1]; k++; } }); if (k < 4) return; ctx.fillStyle = rgba(gRgb(gi).map((q) => lerp(q, 255, 0.3) | 0), S.day ? 0.8 : 0.55); title(gName(gi).toUpperCase(), sx / k, sy / k - 26 * Math.min(2, sc)); });
      ctx.fillStyle = ink(0.35); for (const i of fsN.pin) { ctx.beginPath(); ctx.moveTo(pos[i][0], pos[i][1] - 12); ctx.lineTo(pos[i][0] + 4, pos[i][1] - 7); ctx.lineTo(pos[i][0], pos[i][1] - 2); ctx.lineTo(pos[i][0] - 4, pos[i][1] - 7); ctx.closePath(); ctx.fill(); }
      ctx.textAlign = 'left'; ctx.fillStyle = ink(0.5); ctx.font = '11px -apple-system,sans-serif'; ctx.fillText('SYNAPSE NETWORK · drag: pins a note, empty space: pans · wheel: zoom · double-click empty space: release pins' + (fsN.run ? ' · computing ' + Math.round(100 * fsN.it / fsN.tot) + '%' : ''), v.x0 + 4, v.y0 - 8); }
    // ---- 10 "3D brain": the brain lobes as a rotating point cloud, notes of the head float inside; drag to rotate ----
    const b3 = { yaw: 0.5, pitch: -0.2, hold: -1e9, d: null, lx: 0, ly: 0, cloud: null }, B3P = [[255, 150, 130], [255, 200, 110], [140, 225, 150], [110, 200, 255], [150, 165, 255], [205, 140, 255], [255, 150, 205]];
    const b3U = nodes.map((n) => [(n.body.x - BRAIN.c.x) / BRAIN.r.x, (n.body.y - BRAIN.c.y) / BRAIN.r.y, (n.body.z - BRAIN.c.z) / BRAIN.r.z]), b3In = b3U.map((u) => Math.hypot(u[0], u[1], u[2]) < 1.15);
    const b3Cloud = () => b3.cloud || (b3.cloud = (() => { const r = rnd('b3cloud'), out = [], dirs = REGIONS.map((q) => { const L = Math.hypot(q.d.x, q.d.y, q.d.z); return [q.d.x / L, q.d.y / L, q.d.z / L]; });
      while (out.length < 4400) { const u = r() * 2 - 1, th = r() * TAU, s = Math.sqrt(1 - u * u), x = s * Math.cos(th), y = u, z = s * Math.sin(th); if (Math.abs(x) < 0.05 && y > -0.3) continue; let bi = 0, bd = -9; dirs.forEach((d, k) => { const dp = x * d[0] + y * d[1] + z * d[2]; if (dp > bd) { bd = dp; bi = k; } });
        const rad = 0.95 + 0.07 * Math.sin(x * 9 + y * 7) * Math.sin(z * 8 - y * 5) + r() * 0.04; out.push([x * rad * 0.9, y * rad * 0.78, z * rad * 1.08, bi, 0.45 + r() * 0.55]); }
      const by = B3P.map(() => []); out.forEach((p) => by[p[3]].push(p)); return by; })());
    const b3Proj = (x, y, z, Sc, v) => { const cy = Math.cos(b3.yaw), sy = Math.sin(b3.yaw), cp = Math.cos(b3.pitch), sp = Math.sin(b3.pitch), x1 = x * cy - z * sy, z1 = x * sy + z * cy, y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp, f = 3.5 / (3.5 + z2); return [v.cx + x1 * f * Sc, v.cy - y1 * f * Sc, f, z2]; };
    const b3Sc = () => Math.min(vp().w, vp().h) * 0.4 * zoom;
    const b3Pos = () => memoL('b3', vkey() + ',' + b3.yaw.toFixed(4) + ',' + b3.pitch.toFixed(4) + ',' + zoom.toFixed(3), () => { const v = vp(), Sc = b3Sc(), P3 = b3U.map((u, i) => b3In[i] ? b3Proj(u[0] * 0.9, u[1] * 0.78, u[2] * 1.08, Sc, v) : [v.cx, v.cy, 1, 0]); let lo = 9, hi = 0; P3.forEach((q, i) => { if (b3In[i]) { lo = Math.min(lo, q[2]); hi = Math.max(hi, q[2]); } }); return { pos: P3.map((q) => [q[0], q[1]]), f: P3.map((q) => q[2]), lo, hi }; });
    const b3D = (i) => { const o = b3Pos(); return cl01((o.f[i] - o.lo) / Math.max(1e-6, o.hi - o.lo)); };   // B9: depth 0 (far) .. 1 (near)
    const b3Drag = (sx, sy, x, y) => { if (b3.d !== drag) { b3.d = drag; b3.lx = sx; b3.ly = sy; } b3.yaw += (x - b3.lx) * 0.009; b3.pitch = Math.max(-1.4, Math.min(1.4, b3.pitch + (y - b3.ly) * 0.009)); b3.lx = x; b3.ly = y; b3.hold = performance.now(); wake(); };
    function drawB3(dt) { if (S.turning && !calm() && hover < 0 && sel < 0 && performance.now() - b3.hold > 2500) b3.yaw += dt * 0.3 * S.speed;
      const v = vp(), Sc = b3Sc(), by = b3Cloud(), P3 = b3Pos();   // stop rotating while a note is under the pointer or selected, so dblclick can open it
      ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter';
      by.forEach((pts, k) => { const c = tone(B3P[k]); ctx.fillStyle = rgba(c, 1); for (const p of pts) { const q = b3Proj(p[0], p[1], p[2], Sc, v); ctx.globalAlpha = Math.min(1, (0.2 + 0.6 * (1 - q[3]) / 2) * p[4] * (S.day ? 1.5 : 1) * (amOn() ? 0.8 + 0.3 * Math.sin(clock * 1.4 + p[4] * 40) : 1)); const s = 1.2 + 1.5 * q[2] * q[2]; ctx.fillRect(q[0] - s / 2, q[1] - s / 2, s, s); } });
      ctx.globalAlpha = 1; ctx.lineWidth = 0.6; ctx.strokeStyle = S.day ? 'rgba(60,70,150,.15)' : 'rgba(180,190,255,.09)'; ctx.beginPath(); for (const [a, b] of links) if (b3In[a] && b3In[b]) { ctx.moveTo(P3.pos[a][0], P3.pos[a][1]); ctx.lineTo(P3.pos[b][0], P3.pos[b][1]); } ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; ctx.font = '600 10px -apple-system,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      REGIONS.forEach((rg, k) => { const L = Math.hypot(rg.d.x, rg.d.y, rg.d.z), q = b3Proj(rg.d.x / L * 1.3 * 0.9, rg.d.y / L * 1.3 * 0.78, rg.d.z / L * 1.3 * 1.08, Sc, v); if (q[3] > 0.35) return; ctx.fillStyle = rgba(tone(B3P[k]), 0.85); ctx.fillText(rg.name, q[0], q[1]); });
      ctx.textAlign = 'left'; ctx.fillStyle = ink(0.5); ctx.font = '11px -apple-system,sans-serif'; ctx.fillText('3D BRAIN · drag: spin · wheel: zoom · point cloud = brain lobes, bright points = knowledge notes', v.x0 + 4, v.y0 - 8); }
    // ---- 24 link suggestions: notes that share many neighbours with this one but are not linked to it ----
    const suggest = (i) => { const mine = new Set(adj[i]), cnt = new Map(); for (const j of mine) for (const k of new Set(adj[j])) { if (k === i || mine.has(k) || nodes[k].kind === 'spine') continue; const e = cnt.get(k) || [0, 0]; e[0]++; e[1] += 1 / Math.log(2 + adj[j].length); cnt.set(k, e); }
      return [...cnt.entries()].filter(([, e]) => e[0] >= 2).sort((a, b) => b[1][0] - a[1][0] || b[1][1] - a[1][1]).slice(0, 5).map(([k, e]) => [k, e[0]]); };
    function sugRows(i) { const box = el('div', 'margin-top:8px'), S5 = suggest(i); box.append(el('div', 'opacity:.6;font-size:10px;letter-spacing:.08em;margin-bottom:2px', 'Can be linked · shared neighbours (' + S5.length + ')')); if (!S5.length) box.append(el('div', 'opacity:.5', '—'));
      S5.forEach(([j, c]) => box.append(rowBtn(j, c + ' shared'))); return box; }
    // ---- 19 compare two areas: pick exactly two chips ----
    var cmpEl = null, cmpPair = null, cmpX = [];
    function paintCmp() { if (!cmpEl) return; const A = [...areaSet]; if (A.length !== 2) { cmpPair = null; cmpX = []; cmpEl.style.display = 'none'; return; }
      const ids = A.map((a) => nodes.map((_, i) => i).filter((i) => (nodes[i].group || '') === a)), sets = ids.map((l) => new Set(l)), X = [], br = [new Map(), new Map()], inl = [0, 0], seen = new Set();
      for (const [p, q] of links) { const k = Math.min(p, q) * 100000 + Math.max(p, q); if (seen.has(k)) continue; seen.add(k); const pa = sets[0].has(p) ? 0 : sets[1].has(p) ? 1 : -1, qa = sets[0].has(q) ? 0 : sets[1].has(q) ? 1 : -1; if (pa < 0 || qa < 0) continue;
        if (pa === qa) inl[pa]++; else { X.push([p, q]); br[pa].set(p, (br[pa].get(p) || 0) + 1); br[qa].set(q, (br[qa].get(q) || 0) + 1); } }
      cmpPair = A; cmpX = X; cmpEl.innerHTML = ''; cmpEl.style.bottom = cardB(); cmpEl.style.display = 'block'; const head = el('div', 'display:flex;align-items:center;gap:8px;margin-bottom:6px'), cols = el('div', 'display:grid;grid-template-columns:1fr 1fr;gap:4px 22px');
      const t = el('div', 'font-weight:600;flex:1'); t.textContent = 'Compare · ' + A[0] + ' ↔ ' + A[1] + ' · ' + X.length + ' shared links'; const xb = el('button', 'font:inherit;color:inherit;padding:0 4px;box-shadow:none;background:none;border:0;cursor:pointer;opacity:.7;font-size:14px;line-height:1', '×'); xb.setAttribute('aria-label', 'Close comparison'); xb.onclick = () => { areaSet.clear(); S.areas = []; save(); paintChips(); }; head.append(t, xb); cmpEl.append(head, cols);
      A.forEach((a, k) => { const l = ids[k], ages = l.map((i) => ageD(nodes[i])).sort((x, y) => x - y), avg = l.length ? (l.reduce((s, i) => s + deg[i], 0) / l.length).toFixed(1) : '0', hubs = l.slice().sort((x, y) => deg[y] - deg[x]).slice(0, 3).map((i) => nodes[i].name).join(', '), bridges = [...br[k].entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([i]) => nodes[i].name).join(', ');
        const col = el('div', 'min-width:0;font-size:11px'), h = el('div', 'font-weight:600;display:flex;align-items:center'); if (l.length) h.append(dotEl(nodes[l[0]].rgb)); h.append(document.createTextNode(a)); col.append(h);
        for (const s of [l.length + ' notes · ' + inl[k] + ' internal links', 'avg links ' + avg + ' · avg age ' + (ages.length ? Math.round(ages[ages.length >> 1]) : 0) + ' days', 'hubs: ' + (hubs || '—'), 'bridges: ' + (bridges || '—')]) { const d = el('div', 'opacity:.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'); d.textContent = s; d.title = s; col.append(d); } cols.append(col); }); wake(); }
    // ---- 23 auto tour through the top hubs; any input stops it ----
    const tourL = nodes.map((_, i) => i).filter((i) => nodes[i].kind !== 'spine').sort((a, b) => deg[b] - deg[a]).slice(0, 10);
    function tourGo() { const i = tourL[tourI % tourL.length]; sel = i; selT = performance.now(); showCard(i); flash = { i, t0: clock }; if (VIEWS[S.view].body) fly = { i, z: 2.3, t: 0 }; toast('Tur · ' + nodes[i].name + ' · ' + deg[i] + ' links'); tourT = 0; wake(); }
    function tourStop() { if (!tourOn) return; tourOn = false; paintTools(); }
    function tourToggle() { if (tourOn) { tourStop(); return; } if (!tourL.length) return; tourOn = true; tourI = 0; paintTools(); tourGo(); }
    // ---- 26 sound (off by default): a tiny WebAudio blip when a note is born ----
    const beep = () => { if (!S.sound) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(523, t); o.frequency.exponentialRampToValueAtTime(880, t + 0.12);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.32); } catch (e) {} };
    setTimeout(() => fsKick(), 900);
    // ---- v10 batch C: four new views (Dendrite tree, Sundial, Wave, Coral) ----
    const layers = {}, lay = (name, key, fn) => { let L = layers[name]; if (!L) L = layers[name] = { c: document.createElement('canvas'), k: '' }; const k = key + '|' + dpr + '|' + S.day + '|' + S.theme;   // cached static layer, repainted only when the key changes
      if (L.k !== k) { L.k = k; L.c.width = canvas.width; L.c.height = canvas.height; const g = L.c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); const sv = ctx; ctx = g; try { fn(); } finally { ctx = sv; } } return L.c; };
    const MN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], ctOf = (n) => n.ctime || n.mtime || 0, HUDT = (t) => { ctx.globalCompositeOperation = 'source-over'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = ink(0.5); ctx.font = '11px -apple-system,sans-serif'; ctx.fillText(t, L0() + 12, H - TLH() - 4); };
    const polar = (cx, cy, r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    // ---- 15 "Dendrite tree": folders = branches (width ~ log of note count, tapered), notes = leaves on the outer ring; angle share ~ note count ----
    const dendGeo = () => memoL('dend', vkey(), () => { const v = vp(), n = nodes.length, RL = Math.min(v.w, v.h) / 2 - 44, cx = v.cx, cy = v.cy + 6, root = { name: '', kids: new Map(), notes: [], depth: 0, par: null }, fOf = new Array(n), all = [];
      nodes.forEach((nd, i) => { let cur = root; for (const sg of nd.path.split('/').slice(0, -1).slice(0, 3)) { let k = cur.kids.get(sg); if (!k) cur.kids.set(sg, k = { name: sg, kids: new Map(), notes: [], depth: cur.depth + 1, par: cur }); cur = k; } cur.notes.push(i); fOf[i] = cur; });
      const gc = (f) => { f.cnt = f.notes.length; f.g = new Map(); for (const i of f.notes) f.g.set(nodes[i].gi, (f.g.get(nodes[i].gi) || 0) + 1); for (const k of f.kids.values()) { gc(k); f.cnt += k.cnt; for (const [g, c] of k.g) f.g.set(g, (f.g.get(g) || 0) + c); } const best = [...f.g.entries()].sort((a, b) => b[1] - a[1])[0]; f.dom = best ? best[0] : 0; all.push(f); }; gc(root);
      const md = Math.max(1, ...all.map((f) => f.depth)), rF = (d) => d === 0 ? 0 : RL * (0.2 + 0.6 * (d - 1) / md), ang = new Float32Array(n), per = TAU / n; let a = -Math.PI / 2;
      const place = (f) => { f.a0 = a; f.notes.slice().sort((x, y) => nodes[x].path < nodes[y].path ? -1 : 1).forEach((i) => { ang[i] = a + per / 2; a += per; }); for (const k of [...f.kids.values()].sort((x, y) => x.name < y.name ? -1 : 1)) place(k); f.a1 = a; f.am = (f.a0 + f.a1) / 2; }; place(root);
      const fp = (f) => f.depth ? polar(cx, cy, rF(f.depth), f.am) : [cx, cy], pos = nodes.map((nd, i) => polar(cx, cy, RL * 0.9 + (hsh[i] - 0.5) * 8, ang[i]));
      return { cx, cy, RL, root, all, fOf, pos, rF, fp, ang, md }; });
    const dendW = (f) => Math.min(14, Math.log(f.cnt + 1) * 1.5);
    function dendEdge(g, f, col, wMul, al) { const p = f.par, A = g.fp(p), B = g.fp(f), rm = (g.rF(p.depth) + g.rF(f.depth)) / 2, c1 = polar(g.cx, g.cy, rm, p === g.root ? f.am : p.am), c2 = polar(g.cx, g.cy, rm, f.am), w0 = dendW(p) * wMul, w1 = dendW(f) * wMul; ctx.lineCap = 'round'; ctx.strokeStyle = rgba(col, al); let q = A;
      for (let k = 1; k <= 12; k++) { const t = k / 12, u = 1 - t, x = u * u * u * A[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * B[0], y = u * u * u * A[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * B[1]; ctx.lineWidth = Math.max(0.8, lerp(w0, w1, t)); ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(x, y); ctx.stroke(); q = [x, y]; } }
    function drawDend() { const g = dendGeo(); ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(lay('dend', vkey(), () => { for (let i = 0; i < nodes.length; i++) { const f = g.fOf[i], rf = g.rF(f.depth), A = polar(g.cx, g.cy, rf, g.ang[i]); ctx.strokeStyle = rgba(gRgb(nodes[i].gi), 0.22); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(g.pos[i][0], g.pos[i][1]); ctx.stroke(); }
        for (const f of g.all) { const rf = g.rF(f.depth); if (!rf) continue; const an = [...f.notes.map((i) => g.ang[i]), ...[...f.kids.values()].map((k) => k.am), f.am]; const lo = Math.min(...an), hi = Math.max(...an); if (hi - lo < 1e-4) continue; ctx.strokeStyle = rgba(gRgb(f.dom), 0.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(g.cx, g.cy, rf, lo, hi); ctx.stroke(); }   // radial-dendrogram arcs: each folder joins its notes on its own radius
        for (const f of g.all) { if (!f.par) continue; dendEdge(g, f, gRgb(f.dom).map((q) => q * 0.75 | 0), 1, 0.78); } for (const f of g.all) { const c = gRgb(f.dom), q = g.fp(f); ctx.fillStyle = rgba(c.map((z) => lerp(z, 255, 0.3) | 0), 0.9); ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(1.6, f.par ? dendW(f) / 2 : dendW(f) / 3), 0, TAU); ctx.fill(); } }), 0, 0, W, H);
      if (sel >= 0) { ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter'; const c = gRgb(nodes[sel].gi); let f = g.fOf[sel]; const A = g.fp(f); ctx.strokeStyle = rgba(c, 0.9); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(g.pos[sel][0], g.pos[sel][1]); ctx.stroke(); for (; f && f.par; f = f.par) dendEdge(g, f, c, 0.6, 0.85); ctx.globalCompositeOperation = 'source-over'; }
      ctx.font = '600 11px -apple-system,sans-serif'; ctx.textBaseline = 'middle'; for (const f of g.all) { if (f.depth !== 1 || f.cnt < 6) continue; const q = polar(g.cx, g.cy, g.RL * 0.9 + 16, f.am), right = Math.cos(f.am) >= 0, t = f.name.replace(/^[^\p{L}\p{N}]+/u, '') + ' ' + f.cnt; ctx.textAlign = right ? 'left' : 'right'; tOut(t, q[0], q[1]); ctx.fillStyle = rgba(gRgb(f.dom).map((z) => lerp(z, 255, 0.45) | 0), 0.92); ctx.fillText(t, q[0], q[1]); }
      ctx.textAlign = 'center'; ctx.fillStyle = ink(0.8); ctx.font = '600 14px -apple-system,sans-serif'; ctx.fillText(String(nodes.length), g.cx, g.cy - 22); ctx.font = '10px -apple-system,sans-serif'; ctx.fillStyle = ink(0.5); ctx.fillText('notes', g.cx, g.cy - 9);
      HUDT('DENDRITE TREE · folder = branch (thickness ~ note count), note = leaf · angle share ~ note count · the path of the selected note lights up'); }
    // ---- 16 "Sundial": 24 hour sectors x 7 weekday rings, cell hue = dominant area of the edits in that slot ----
    const SUND = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], SUNS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const sunCell = nodes.map((n) => { const t = new Date(n.mtime || 0); return [(t.getDay() + 6) % 7, t.getHours()]; });
    const sunData = (() => { const cnt = Array.from({ length: 7 }, () => new Array(24).fill(0)), gcn = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => new Map())); nodes.forEach((n, i) => { const [k, h] = sunCell[i]; cnt[k][h]++; const m = gcn[k][h]; m.set(n.gi, (m.get(n.gi) || 0) + 1); });
      const dom = cnt.map((r, k) => r.map((c, h) => { let b = -1, bc = 0; for (const [g, x] of gcn[k][h]) if (x > bc) { bc = x; b = g; } return b; })), hourTot = new Array(24).fill(0); cnt.forEach((r) => r.forEach((c, h) => { hourTot[h] += c; })); let bh = 0; hourTot.forEach((c, h) => { if (c > hourTot[bh]) bh = h; });
      return { cnt, dom, hourTot, busy: bh, max: Math.max(1, ...cnt.flat()) }; })();
    const sunGeo = () => memoL('sun', vkey(), () => { const v = vp(), M = Math.min(v.w, v.h) / 2 - 38, r0 = M * 0.2, dr = (M - r0) / 7, cx = v.cx, cy = v.cy;
      return { cx, cy, M, r0, dr, pos: nodes.map((n, i) => { const [k, h] = sunCell[i], r = r0 + dr * (k + 0.15 + 0.7 * hsh[i]), a = -Math.PI / 2 + TAU / 24 * (h + 0.12 + 0.76 * ((hsh[i] * 7.31) % 1)); return [cx + Math.cos(r * 0 + a) * r, cy + Math.sin(a) * r]; }) }; });
    const sunAt = (x, y) => { const g = sunGeo(), r = Math.hypot(x - g.cx, y - g.cy); if (r < g.r0 || r > g.M) return null; let a = Math.atan2(y - g.cy, x - g.cx) + Math.PI / 2; a = (a + TAU) % TAU; return [Math.min(6, Math.floor((r - g.r0) / g.dr)), Math.min(23, Math.floor(a / (TAU / 24)))]; };
    const sunArc = (g, k, h, pad) => { const a0 = -Math.PI / 2 + h * TAU / 24 + 0.004, a1 = a0 + TAU / 24 - 0.008; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r0 + k * g.dr + 1 - pad, a0, a1); ctx.arc(g.cx, g.cy, g.r0 + (k + 1) * g.dr - 1 + pad, a1, a0, true); ctx.closePath(); };
    function drawSun() { const g = sunGeo(), D = sunData; ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(lay('sun', vkey(), () => { for (let k = 0; k < 7; k++) for (let h = 0; h < 24; h++) { const c = D.cnt[k][h]; sunArc(g, k, h, 0); ctx.fillStyle = c ? rgba(gRgb(D.dom[k][h]), 0.1 + 0.8 * Math.sqrt(c / D.max)) : ink(0.035); ctx.fill(); } }), 0, 0, W, H);
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.strokeStyle = ink(0.25); ctx.lineWidth = 1; ctx.beginPath(); for (let h = 0; h < 24; h++) { const a = -Math.PI / 2 + h * TAU / 24, u = h % 6 ? 4 : 7, q0 = polar(g.cx, g.cy, g.M + 2, a), q1 = polar(g.cx, g.cy, g.M + 2 + u, a); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); } ctx.stroke();
      for (let h = 0; h < 24; h += 3) { const maj = h % 6 === 0, q = polar(g.cx, g.cy, g.M + 18, -Math.PI / 2 + h * TAU / 24); ctx.font = (maj ? '600 11px' : '10px') + ' -apple-system,sans-serif'; ctx.fillStyle = ink(maj ? 0.8 : 0.42); ctx.fillText(String(h).padStart(2, '0'), q[0], q[1]); } ctx.font = '10px -apple-system,sans-serif'; ctx.fillStyle = ink(0.5);
      ctx.textAlign = 'right'; for (let k = 0; k < 7; k++) ctx.fillText(SUNS[k], g.cx - 4, g.cy - (g.r0 + (k + 0.5) * g.dr)); ctx.textAlign = 'center';
      const bh = D.busy, a0 = -Math.PI / 2 + bh * TAU / 24; ctx.strokeStyle = 'rgba(255,213,106,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.M + 5, a0 + 0.01, a0 + TAU / 24 - 0.01); ctx.stroke();
      const hv = sunAt(mouse[0], mouse[1]); if (hv) { sunArc(g, hv[0], hv[1], 0); ctx.strokeStyle = ink(0.95); ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.fillStyle = ink(0.85); ctx.font = '600 18px -apple-system,sans-serif'; ctx.fillText(String(nodes.length), g.cx, g.cy - 6); ctx.font = '10px -apple-system,sans-serif'; ctx.fillStyle = ink(0.5); ctx.fillText('notes', g.cx, g.cy + 12);
      if (hv) { const t = SUND[hv[0]] + ' ' + String(hv[1]).padStart(2, '0') + ':00 · ' + D.cnt[hv[0]][hv[1]] + ' notes', [mx, my] = mouse; tipLine(t, mx, my + 14, 70); }
      HUDT('SUNDIAL · angle = hour of day, ring = weekday (inside out: Mon … Sun), colour = area written most at that time · yellow arc: busiest hour ' + String(D.busy).padStart(2, '0') + ':00 (' + D.hourTot[D.busy] + ' notes)'); }
    // ---- 17 "Wave": one EEG lane per area, daily note activity; a playhead scans the period in 12 s and flashes the notes of each day ----
    const waveDay = (n, D, t0) => range ? Math.floor(((n.mtime || 0) - t0) / DAY) : D - 1 - Math.floor((NOW0 - (n.mtime || 0)) / DAY);
    const waveGeo = () => memoL('wave', vkey() + (range ? range.join() : ''), () => { const v = vp(), G = groupNames.length, laneH = (v.h - 40) / G, x0 = v.x0 + 100, x1 = v.x1 - 60, old = Math.min(...nodes.map((n) => n.mtime || NOW0));
      const D = range ? Math.max(3, Math.min(200, Math.round((range[1] - range[0]) / DAY))) : Math.max(14, Math.min(120, Math.ceil((NOW0 - old) / DAY) + 1)), t0 = range ? range[0] : NOW0 - (D - 1) * DAY, cnt = groupNames.map(() => new Array(D).fill(0)), out = new Uint8Array(nodes.length), dayI = new Int16Array(nodes.length), idxIn = new Int16Array(nodes.length);
      nodes.forEach((n, i) => { const d = waveDay(n, D, t0); if (d < 0 || d >= D) { out[i] = 1; dayI[i] = Math.max(0, Math.min(D - 1, d)); return; } dayI[i] = d; idxIn[i] = cnt[n.gi][d]++; });
      const tot = new Array(D).fill(0); cnt.forEach((r) => r.forEach((c, d) => { tot[d] += c; }));
      const lanes = groupNames.map((_, gi) => { const top = v.y0 + 12 + gi * laneH, base = top + laneH - 2, c = cnt[gi], sm = c.map((q, d) => 0.25 * (c[d - 1] || 0) + 0.5 * q + 0.25 * (c[d + 1] || 0)), peak = Math.max(1, ...c), amp = laneH - 12; return { top, base, c, peak, amp, pts: sm.map((q, d) => [x0 + (d + 0.5) / D * (x1 - x0), base - 2 - Math.min(1, q / Math.max(1, peak * 0.9)) * amp]) }; });
      const pos = nodes.map((n, i) => { const L = lanes[Math.max(0, n.gi)], d = dayI[i], x = L.pts[d][0], hh = Math.max(4, L.base - 2 - L.pts[d][1]), c = Math.max(1, L.c[d]); return [x + (hsh[i] - 0.5) * 2, L.base - 3 - (out[i] ? 0 : (idxIn[i] + 0.5) / c * hh)]; });
      const byDay = Array.from({ length: D }, () => []); nodes.forEach((n, i) => { if (!out[i]) byDay[dayI[i]].push(i); });
      return { v, D, t0, x0, x1, laneH, lanes, pos, out, dayI, byDay, tot }; });
    function drawWave() { const g = waveGeo(), v = g.v; ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(lay('wave', vkey() + (range ? range.join() : '') + areaKey(), () => { ctx.font = '600 11px -apple-system,sans-serif'; ctx.textBaseline = 'middle'; g.lanes.forEach((L, gi) => { const on = !areaSet.size || areaSet.has(groupNames[gi] || ''), c = gRgb(gi), k = on ? 1 : 0.25;
          ctx.strokeStyle = ink(0.07); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g.x0, L.base); ctx.lineTo(g.x1, L.base); ctx.stroke(); ctx.textAlign = 'left'; ctx.fillStyle = rgba(c.map((q) => lerp(q, 255, 0.45) | 0), 0.95 * k); ctx.fillText(gName(gi), v.x0 + 4, L.base - g.laneH / 2 + 2); ctx.font = '10px -apple-system,sans-serif'; ctx.fillStyle = ink(0.45 * k); ctx.fillText(gCount[gi] + ' notes', v.x0 + 4, L.base - g.laneH / 2 + 15); ctx.font = '600 11px -apple-system,sans-serif';
          if (!L.pts.length) return; ctx.beginPath(); cat(L.pts, true); ctx.lineTo(L.pts[L.pts.length - 1][0], L.base); ctx.lineTo(L.pts[0][0], L.base); ctx.closePath(); ctx.fillStyle = rgba(c, 0.12 * k); ctx.fill(); ctx.beginPath(); cat(L.pts, true); ctx.strokeStyle = rgba(c.map((q) => lerp(q, 255, 0.3) | 0), 0.9 * k); ctx.lineWidth = 1.5; ctx.stroke();
          ctx.textAlign = 'left'; ctx.font = '10px -apple-system,sans-serif'; ctx.fillStyle = ink(0.4 * k); ctx.fillText('max ' + L.peak, g.x1 + 8, L.base - g.laneH / 2 + 2); ctx.font = '600 11px -apple-system,sans-serif'; }); }), 0, 0, W, H);
      ctx.font = '10px -apple-system,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = ink(0.5); const st = Math.max(1, Math.ceil(g.D / 9)); ctx.fillRect(Math.round(g.x0), Math.round(v.y1 - 22), Math.round(g.x1 - g.x0), 1); for (let d = 0; d < g.D; d += st) { const tx = Math.round(g.x0 + (d + 0.5) / g.D * (g.x1 - g.x0)) + 0.5; ctx.fillText(mmdd(g.t0 + d * DAY), tx, v.y1 - 12); ctx.fillRect(tx - 0.5, v.y1 - 22, 1, 4); }
      const [mx, my] = mouse; if (mx >= g.x0 && mx <= g.x1 && my >= v.y0 && my <= v.y1 && !(drag && drag.moved)) { const d = Math.max(0, Math.min(g.D - 1, Math.floor((mx - g.x0) / (g.x1 - g.x0) * g.D))), x = g.x0 + (d + 0.5) / g.D * (g.x1 - g.x0); ctx.strokeStyle = ink(0.3); ctx.beginPath(); ctx.moveTo(x, v.y0 + 6); ctx.lineTo(x, v.y1); ctx.stroke(); const t = mmdd(g.t0 + d * DAY) + ' · ' + g.tot[d] + ' notes'; tipLine(t, x, my + 14, 64); }
      if (!calm()) { const ph = (clock % 12) / 12, px = g.x0 + ph * (g.x1 - g.x0), gr = ctx.createLinearGradient(px - 40, 0, px, 0); gr.addColorStop(0, 'rgba(160,140,255,0)'); gr.addColorStop(1, S.day ? 'rgba(110,90,220,.18)' : 'rgba(190,175,255,.2)'); ctx.fillStyle = gr; ctx.fillRect(px - 40, v.y0 + 6, 40, v.y1 - v.y0 - 6); ctx.strokeStyle = S.day ? 'rgba(110,90,220,.8)' : 'rgba(210,200,255,.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px, v.y0 + 6); ctx.lineTo(px, v.y1); ctx.stroke();
        const dp = ph * g.D, back = 0.9 / 12 * g.D; ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter'; for (let d = Math.max(0, Math.floor(dp - back)); d <= Math.min(g.D - 1, Math.floor(dp)); d++) { const age = ((clock % 12) - (d + 0.5) / g.D * 12 + 12) % 12; if (age > 0.9) continue; for (const i of g.byDay[d]) { if (!isLit(nodes[i])) continue; const q = g.pos[i]; ctx.strokeStyle = rgba(tone(nodes[i].rgb).map((z) => lerp(z, 255, 0.5) | 0), 1 - age / 0.9); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(q[0], q[1], 3 + age * 16, 0, TAU); ctx.stroke(); } } ctx.globalCompositeOperation = 'source-over'; }
      HUDT('WAVE · one lane per area, height = daily note activity · the playhead scans the period in 12 s and flashes the notes of each day · drag on the timeline: select a period'); }
    const areaKey = () => [...areaSet].join('|');
    // ---- 18 "Coral": notes on an Archimedean spiral by creation date (oldest in the middle); rings mark year (or month) boundaries ----
    const coralGeo = () => memoL('coral', vkey(), () => { const v = vp(), n = nodes.length, R = Math.min(v.w, v.h) / 2 - 36, ord = nodes.map((_, i) => i).sort((a, b) => ctOf(nodes[a]) - ctOf(nodes[b]) || a - b), gap0 = 9, b0 = gap0 / TAU, ds0 = gap0 * 0.55, k = R / Math.sqrt(2 * b0 * n * ds0), pos = new Array(n), rad = new Float32Array(n), th = new Float32Array(n);
      ord.forEach((i, q) => { const t = Math.sqrt(2 * q * ds0 / b0), r = 6 + k * b0 * t; th[q] = t - Math.PI / 2; rad[q] = r; pos[i] = [v.cx + Math.cos(th[q]) * r, v.cy + Math.sin(th[q]) * r]; });
      const yr = (q) => new Date(ctOf(nodes[ord[q]])).getFullYear(), mo = (q) => { const d = new Date(ctOf(nodes[ord[q]])); return d.getFullYear() * 12 + d.getMonth(); }; let bnd = []; for (let q = 1; q < n; q++) if (yr(q) !== yr(q - 1)) bnd.push([q, String(yr(q))]);
      let unit = 'il'; if (!bnd.length) { unit = 'ay'; for (let q = 1; q < n; q++) if (mo(q) !== mo(q - 1)) bnd.push([q, MN3[new Date(ctOf(nodes[ord[q]])).getMonth()]]); }
      return { v, ord, pos, rad, th, bnd, unit, R, k, gap: k * gap0 }; });
    function drawCoral() { const g = coralGeo(), v = g.v; ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(lay('coral', vkey(), () => { ctx.strokeStyle = ink(0.06); ctx.lineWidth = 1; ctx.beginPath(); g.ord.forEach((i, q) => { q ? ctx.lineTo(g.pos[i][0], g.pos[i][1]) : ctx.moveTo(g.pos[i][0], g.pos[i][1]); }); ctx.stroke();
        ctx.font = '10px -apple-system,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; for (const [q, t] of g.bnd) { const r = g.rad[q]; ctx.strokeStyle = ink(0.15); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(v.cx, v.cy, r, 0, TAU); ctx.stroke(); ctx.fillStyle = ink(0.6); ctx.fillText(t, v.cx + 4, v.cy - r - 6); } }), 0, 0, W, H);
      const a = new Date(ctOf(nodes[g.ord[0]])).toISOString().slice(0, 10), b = new Date(ctOf(nodes[g.ord[g.ord.length - 1]])).toISOString().slice(0, 10);
      ctx.textAlign = 'center'; ctx.font = '10px -apple-system,sans-serif'; ctx.fillStyle = ink(0.55); ctx.fillText('oldest · ' + a, v.cx, v.cy + 16); const e = g.pos[g.ord[g.ord.length - 1]]; ctx.fillText('newest · ' + b, Math.min(e[0], W - 70), e[1] + 16);
      HUDT('CORAL · notes on a spiral by creation date (centre = oldest), size = link count · rings = ' + (g.unit === 'il' ? 'il' : 'ay') + ' boundaries'); }
    // ---- v9 view registry + shared view-switch tween (700 ms, ease-in-out cubic); format documented at the top of the renderer ----
    let vtT = 1, vE = 1, vFrom = null, vFromBody = true, stemA = stemT, stemB = stemT;
    const bodyPos = () => nodes.map((n) => { const q = proj(n.p); return [q[0], q[1]]; });
    const ringHit = (mx, my) => { const g = ringGeo(), dx = mx - g.cx, dy = my - g.cy, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx) - ringRot; let best = -1, bd = 144; if (r < g.R * 0.86 || r > g.R * 0.9 + 40) return -1;
      nodes.forEach((n, i) => { const da = Math.abs(Math.atan2(Math.sin(ringAng[i] - a), Math.cos(ringAng[i] - a))); if (da < 0.02 && da * 1000 < bd) { bd = da * 1000; best = i; } }); return best; };
    const matPos = () => { const b = matBase(); return nodes.map((n) => [b.left + (Math.max(0, b.D - 1 - Math.floor((b.now2 - (n.mtime || 0)) / DAY)) + 0.5) * b.cw, b.top + (Math.max(0, n.gi) + 0.5) * b.ch]); };
    const SVG = (d) => '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
    // ---- v11 batch B: ambient motion for every view. Time-based (clock), hue = area colour, off in calm mode / reduced motion. Static layers stay cached; only this overlay and the dot shimmer redraw. ----
    let ambOn = true; const amOn = () => ambOn && !calm();
    const gRaw = (gi) => gFirst[gi] ? gFirst[gi].rgb : [140, 150, 255], lite = (c, k) => c.map((v) => lerp(v, 255, k) | 0), fr = (x) => x - Math.floor(x);
    // glowing head with a 2-step tail along the unit direction (ux, uy); d = head diameter
    const comet = (x, y, ux, uy, c, a, d = 10) => { const hd = sprite(lite(c, 0.3)); ctx.globalAlpha = a * 0.22; ctx.drawImage(hd, x - ux * d * 1.5 - d * 0.3, y - uy * d * 1.5 - d * 0.3, d * 0.6, d * 0.6); ctx.globalAlpha = a * 0.5; ctx.drawImage(hd, x - ux * d * 0.8 - d * 0.4, y - uy * d * 0.8 - d * 0.4, d * 0.8, d * 0.8); ctx.globalAlpha = a; ctx.drawImage(hd, x - d / 2, y - d / 2, d, d); ctx.globalAlpha = 1; };
    const ease3 = (u) => u * u * (3 - 2 * u), fadeE = (u) => Math.sin(Math.PI * u);
    // a pulse travelling A -> (C) -> B at phase ph (0..1)
    const pulseQ = (A, C, B, ph, c, amp, d) => { const e = ease3(ph), q = qb(A, C, B, e), q2 = qb(A, C, B, Math.min(1, e + 0.02)); let ux = q2[0] - q[0], uy = q2[1] - q[1]; const L = Math.hypot(ux, uy) || 1; comet(q[0], q[1], ux / L, uy / L, c, amp * fadeE(ph), d); };
    const AL = (() => { const ix = links.map((_, i) => i).filter((i) => nodes[links[i][0]].kind !== 'spine' && nodes[links[i][1]].kind !== 'spine').sort((a, b) => hsh[links[a][0]] - hsh[links[b][0]]).slice(0, 640); return ix.filter((_, k) => k % 8 === 0); })();
    const ringSpan = groupNames.map((_, gi) => { const idx = ringOrder.filter((i) => nodes[i].gi === gi); return idx.length ? [ringAng[idx[0]], ringAng[idx[idx.length - 1]]] : null; });
    const linkPulses = (pos, ctlOf, rate, amp, ok) => { for (const li of AL) { const [a, b] = links[li]; if (!vis(nodes[a]) || !vis(nodes[b]) || !isLit(nodes[a]) || !isLit(nodes[b]) || (ok && !ok(a, b))) continue; const A = pos[a], B = pos[b]; if (!A || !B) continue; const c = ctlOf ? ctlOf(li, A, B) : [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]; pulseQ(A, c, B, fr(clock * (rate + 0.1 * hsh[a]) + hsh[b] * 3), nodes[a].rgb, amp); } };
    const dendCub = (g, f, t) => { const p = f.par, A = g.fp(p), B = g.fp(f), rm = (g.rF(p.depth) + g.rF(f.depth)) / 2, c1 = polar(g.cx, g.cy, rm, p === g.root ? f.am : p.am), c2 = polar(g.cx, g.cy, rm, f.am), u = 1 - t; return [u * u * u * A[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * B[0], u * u * u * A[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * B[1]]; };
    const along2 = (pts, t) => { const n = pts.length - 1, f = Math.min(n - 1e-6, Math.max(0, t * n)), i = Math.floor(f), u = f - i, A = pts[i], B = pts[i + 1], L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; return [lerp(A[0], B[0], u), lerp(A[1], B[1], u), (B[0] - A[0]) / L, (B[1] - A[1]) / L, i]; };
    const AMB = {
      'Ring': () => { const g = ringGeo(), r0 = g.R * 0.8, rb = ribGeo().rib.filter((x) => x.ga !== x.gb).sort((a, b) => b.c - a.c).slice(0, 24);
        rb.forEach((x, k) => { const ma = (x.a0 + x.a1) / 2 + ringRot, mb = (x.b0 + x.b1) / 2 + ringRot, A = [g.cx + Math.cos(ma) * r0, g.cy + Math.sin(ma) * r0], B = [g.cx + Math.cos(mb) * r0, g.cy + Math.sin(mb) * r0], C = [g.cx + (Math.cos(ma) + Math.cos(mb)) * g.R * 0.12, g.cy + (Math.sin(ma) + Math.sin(mb)) * g.R * 0.12]; pulseQ(A, C, B, fr(clock * 0.13 + k * 0.371), gRaw(x.ga), 0.85, 11); });
        ringSpan.forEach((sp, gi) => { if (!sp) return; const a = sp[0] + (sp[1] - sp[0] + 0.004) * fr(clock * 0.06 + gi * 0.29) + ringRot; comet(g.cx + Math.cos(a) * g.R * 0.82, g.cy + Math.sin(a) * g.R * 0.82, -Math.sin(a), Math.cos(a), gRaw(gi), 0.7, 8); }); },
      'Matrix': () => { if (!matGeo) return; const m = matGeo, w = m.D * m.cw, h = groupNames.length * m.ch, px = m.left - 40 + fr(clock * 0.09) * (w + 80), gr = ctx.createLinearGradient(px - 40, 0, px + 40, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.07)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.save(); ctx.beginPath(); ctx.rect(m.left, m.top, w, h); ctx.clip(); ctx.fillStyle = gr; ctx.fillRect(px - 40, m.top, 80, h); ctx.restore(); },
      'Cortex map': () => { const T = tmBuild(); ctx.globalCompositeOperation = 'source-over'; for (let i = 0; i < nodes.length; i++) { const w = T.rw[i]; if (!(w > 6) || !vis(nodes[i]) || !isLit(nodes[i])) continue; const cx = T.rx[i] + w / 2, cy = T.ry[i] + T.rh[i] / 2, d = fr((cx + cy * 0.6) / (W * 1.3) - clock * 0.055), k = d < 0.12 ? Math.sin(d / 0.12 * Math.PI) : 0; if (k < 0.03) continue; ctx.fillStyle = rgba(lite(gRgb(nodes[i].gi), 0.6), 0.2 * k); rr(T.rx[i] + 1, T.ry[i] + 1, w - 2, T.rh[i] - 2, Math.min(6, w / 3, T.rh[i] / 3)); ctx.fill(); } },
      'Time river': () => { const g = rivGeo(); ctx.save(); ctx.beginPath(); for (let l = 0; l < rorder.length; l++) { cat(g.tops[l], true); cat(g.bots[l], false); ctx.closePath(); } ctx.clip(); const px = g.x0 - 120 + fr(clock * 0.06) * (g.x1 - g.x0 + 240), gr = ctx.createLinearGradient(px - 110, 0, px + 110, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, S.day ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gr; ctx.fillRect(px - 110, g.py0 - 10, 220, g.py1 - g.py0 + 20); ctx.restore();
        for (let l = 0; l < rorder.length; l++) { const gi = rorder[l], q = along2(g.tops[l], fr(clock * (0.04 + 0.012 * (l % 5)) + l * 0.17)); if (Math.abs(g.lo[l][q[4]] - g.hi[l][q[4]]) < 2.5) continue; comet(q[0], q[1], q[2], q[3], gRaw(gi), 0.8, 10); } },
      'Constellation map': (pos) => { groupNames.forEach((_, gi) => { const E = skyGeo().mst[gi]; if (!E.length) return; const t = clock * 0.5 + gi * 1.7, e = E[Math.floor(t) % E.length], A = pos[e[0]], B = pos[e[1]]; if (!A || !B || !isLit(nodes[e[0]]) || !isLit(nodes[e[1]])) return; const ph = fr(t), L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; comet(lerp(A[0], B[0], ease3(ph)), lerp(A[1], B[1], ease3(ph)), (B[0] - A[0]) / L, (B[1] - A[1]) / L, gRaw(gi), 0.9 * fadeE(ph), 9); });
        const v = skyGeo().v, per = 9, seed = Math.floor(clock / per), u = (clock % per) / per / 0.14; if (u < 1) { const r = rnd('ss' + seed), sx = v.x0 + r() * v.w * 0.6, sy = v.y0 + r() * v.h * 0.35, hx = sx + u * 300 * 0.85, hy = sy + u * 300 * 0.5, gr = ctx.createLinearGradient(hx - 85 * 0.85, hy - 85 * 0.5, hx, hy); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,' + 0.7 * fadeE(u) + ')'); ctx.strokeStyle = gr; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(hx - 85 * 0.85, hy - 85 * 0.5); ctx.lineTo(hx, hy); ctx.stroke(); } },
      'Ego radial': () => { const g = egoGeo(), c = tone(nodes[g.c].rgb), u = (clock % 3.5) / 3.5; ctx.strokeStyle = rgba(c, 0.28 * (1 - u)); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R[1] * g.s * u, 0, TAU); ctx.stroke(); let n = 0;
        for (const [p, j] of g.tree) { if (n > 60 || !isLit(nodes[j])) continue; n++; const A = g.pos[p], B = g.pos[j], mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2; pulseQ(A, [mx + (g.cy - my) * 0.06, my + (mx - g.cx) * 0.06], B, fr(clock * (g.lvl[j] === 1 ? 0.2 : 0.14) + hsh[j] * 3), nodes[j].rgb, g.lvl[j] === 1 ? 0.9 : 0.6, 9); } },
      'Spinal section': () => { const g = csGeo(), br = 0.05 + 0.035 * Math.sin(clock * TAU / 5), gr = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, 100 * g.s); gr.addColorStop(0, 'rgba(190,200,255,' + br + ')'); gr.addColorStop(1, 'rgba(190,200,255,0)'); ctx.fillStyle = gr; ctx.fillRect(g.cx - 100 * g.s, g.cy - 100 * g.s, 200 * g.s, 200 * g.s);
        linkPulses(g.pos, (li, A, B) => [g.cx + ((A[0] + B[0]) / 2 - g.cx) * 0.35, g.cy + ((A[1] + B[1]) / 2 - g.cy) * 0.35], 0.16, 0.85, (a, b) => csDim(a) >= 1 && csDim(b) >= 1); },
      'Neuron': () => { const g = neyGeo(), u = (clock % 3) / 3, c = tone(nodes[g.c].rgb); ctx.strokeStyle = rgba(c, 0.3 * (1 - u)); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.rS * (1.2 + u * 2.2), 0, TAU); ctx.stroke(); },
      'Reflex arc': () => { const g = refGeo(), R = g.R, dk = g.demo ? 0.85 : 1; if (!R.length) { const u = (clock % 3.2) / 3.2; ctx.strokeStyle = ink(0.14 * (1 - u)); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(g.v.cx, g.v.cy, 24 + 70 * u, 0, TAU); ctx.stroke(); return; }
        R.forEach((i, k) => { const u = fr(clock * 0.5 + k * 0.23), q = g.chain[k]; ctx.strokeStyle = rgba(tone(nodes[i].rgb), 0.5 * dk * (1 - u)); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(q[0], q[1], 9 + 18 * u, 0, TAU); ctx.stroke(); });
        if (g.pl.length > 1 && refP().p >= 1) for (let j = 0; j < (g.demo ? 6 : 1); j++) { const q = along2(g.pl, 1 - fr(clock / (1.7 * Math.max(1, R.length - 1)) + j / 6)); comet(q[0], q[1], -q[2], -q[3], [190, 220, 255], 0.8 * dk, g.demo ? 22 : 9); } },
      'Synapse network': (pos) => { const ctl = netCtl(pos); linkPulses(pos, (li, A, B) => ctl[li] || [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], 0.17, 0.9, (a, b) => aOk(nodes[a]) && aOk(nodes[b])); },
      '3D brain': (pos) => { linkPulses(pos, null, 0.15, 0.85, (a, b) => b3In[a] && b3In[b]); },
      'Dendrite tree': () => { const g = dendGeo(), L = memoL('dAmb', vkey(), () => g.all.filter((f) => f.par).sort((a, b) => b.cnt - a.cnt).slice(0, 40)); L.forEach((f, k) => { const ph = fr(clock * 0.15 + k * 0.317), t = 1 - ph, q = dendCub(g, f, t), q2 = dendCub(g, f, Math.max(0, t - 0.03)); let ux = q2[0] - q[0], uy = q2[1] - q[1]; const d = Math.hypot(ux, uy) || 1; comet(q[0], q[1], ux / d, uy / d, gRaw(f.dom), 0.9 * fadeE(ph), 9); }); },
      'Sundial': () => { const g = sunGeo(), D = sunData, an = (clock * 0.26) % TAU, h = Math.floor(an / TAU * 24); if (ctx.createConicGradient) { const cg = ctx.createConicGradient(an - Math.PI / 2, g.cx, g.cy); cg.addColorStop(0, 'rgba(255,255,255,0.13)'); cg.addColorStop(0.1, 'rgba(255,255,255,0)'); cg.addColorStop(0.86, 'rgba(255,255,255,0)'); cg.addColorStop(1, 'rgba(255,255,255,0.13)'); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.M, 0, TAU); ctx.arc(g.cx, g.cy, g.r0, 0, TAU, true); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let k = 0; k < 7; k++) if (D.cnt[k][h]) { sunArc(g, k, h, 0); ctx.fill(); } },
      'Wave': () => { const g = waveGeo(); g.lanes.forEach((L, gi) => { if (!L.pts.length || (areaSet.size && !areaSet.has(groupNames[gi] || ''))) return; const q = along2(L.pts, fr(clock * (0.05 + 0.01 * (gi % 5)) + gi * 0.13)); comet(q[0], q[1], q[2], q[3], gRaw(gi), 0.85, 9); }); },
      'Coral': (pos) => { const g = coralGeo(), n = g.ord.length, q = Math.floor(fr(clock * 0.07) * n); for (let j = 0; j < 12; j++) { const i = g.ord[(q - j + n) % n], P = pos[i]; if (!P) continue; const d = 14 * (1 - j * 0.05); ctx.globalAlpha = 0.9 * (1 - j / 12); ctx.drawImage(sprite(lite(nodes[i].rgb, 0.25)), P[0] - d, P[1] - d, d * 2, d * 2); } ctx.globalAlpha = 1; }
    };
    const VIEWS = {
      'Body': { icon: SVG('<circle cx="8" cy="3.2" r="2"/><path d="M8 5.5v5M4 7h8M8 10.5l-2.5 4M8 10.5l2.5 4"/>'), body: true, layout: bodyPos },
      'Brainstem': { icon: SVG('<circle cx="8" cy="3.5" r="2.5"/><path d="M8 6v9"/>'), body: true, layout: bodyPos },
      'Ring': { icon: SVG('<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="1.2"/>'), layout: () => { const R = ringGeo().R * 0.9; return nodes.map((n, i) => ringPt(i, R)); }, backdrop: drawRing, hit: ringHit },
      'Matrix': { icon: SVG('<rect x="2" y="2" width="4.5" height="4.5"/><rect x="9.5" y="2" width="4.5" height="4.5"/><rect x="2" y="9.5" width="4.5" height="4.5"/><rect x="9.5" y="9.5" width="4.5" height="4.5"/>'), layout: matPos, backdrop: drawMatrix, hit: () => -1 },
      'Heat body': { icon: SVG('<path d="M8 14.2c-3 0-4.6-2-4.6-4.2 0-2.6 2-3.6 2.6-6.2 1 .9 1.5 1.9 1.5 3 .8-.6 1.2-1.6 1.2-2.7 2 1.3 3.9 3 3.9 6 0 2.4-1.7 4.1-4.6 4.1z"/>'), body: true, heat: true, layout: bodyPos },
      'Cortex map': { icon: SVG('<rect x="2" y="2" width="7" height="12"/><rect x="9" y="2" width="5" height="5.5"/><rect x="9" y="7.5" width="5" height="6.5"/>'), layout: () => tmBuild().pos, backdrop: drawTree, hud: true,
        hit: (mx, my) => { const T = tmBuild(); for (let i = 0; i < nodes.length; i++) if (T.rw[i] > 1 && mx >= T.rx[i] && mx <= T.rx[i] + T.rw[i] && my >= T.ry[i] && my <= T.ry[i] + T.rh[i] && vis(nodes[i])) return i; return -1; },
        click: (mx, my) => { const T = tmBuild(); for (const g of T.groups) if (mx >= g.x && mx <= g.x + g.w && my >= g.y && my <= g.y + g.h) { tmZoom = tmZoom === g.gi ? -1 : g.gi; memo.tmZ = null; wake(); return true; } return false; }, esc: () => { if (tmZoom < 0) return false; tmZoom = -1; wake(); return true; } },
      'Time river': { icon: SVG('<path d="M1.5 6c2-3 3.5-3 5 0s3.5 3 5 0 2-2 3-1.5M1.5 11c2-3 3.5-3 5 0s3.5 3 5 0 2-2 3-1.5"/>'), dots: true, hud: true, layout: () => rivGeo().pos, backdrop: drawRiver, hit: dotHit,
        dim: (i) => { const [mx, my] = mouse, g = rivGeo(); return mx >= g.x0 - g.st / 2 && mx <= g.x1 + g.st / 2 && my >= g.py0 - 8 && my <= g.py1 + 8 ? (rwk[i] === rivWeek(mx) ? 1 : 0.35) : 0.65; }, size: () => 0.7,
        drag: (sx, sy, x) => { const a = rivWeek(sx), b = rivWeek(x); range = [RT0 + Math.min(a, b) * WKr, RT0 + (Math.max(a, b) + 1) * WKr]; drawTimeline(); } },
      'Constellation map': { icon: SVG('<path d="M3 11l3-5 4 3 3-6"/><circle cx="3" cy="11" r="1"/><circle cx="6" cy="6" r="1"/><circle cx="10" cy="9" r="1"/><circle cx="13" cy="3" r="1"/>'), dots: true, hud: true, layout: skyPos, backdrop: drawSky, hit: dotHit, dim: skTw, size: (i) => 0.8 + 1.1 * Math.sqrt(deg[i] / maxDeg) },
      'Ego radial': { icon: SVG('<circle cx="8" cy="8" r="1.6"/><circle cx="8" cy="8" r="4"/><circle cx="8" cy="8" r="6.5" stroke-dasharray="1 2"/>'), dots: true, hud: true, ego: true, layout: () => egoGeo().pos, backdrop: drawEgo, hit: dotHit, can: (i) => egoGeo().lvl[i] >= 0,
        dim: (i) => { const l = egoGeo().lvl[i]; return l < 0 ? 0.07 : 1; }, size: (i) => { const l = egoGeo().lvl[i]; return l < 0 ? 0.5 : l === 0 ? 2.6 : l === 1 ? 1.3 : 1; } },
      'Spinal section': { icon: SVG('<circle cx="8" cy="8" r="6"/><path d="M8 4v8M5.5 6c-1.5 1-1.5 3 0 4M10.5 6c1.5 1 1.5 3 0 4"/>'), dots: true, hud: true, layout: () => csGeo().pos, backdrop: drawCross, hit: dotHit, dim: csDim, size: () => 0.8, click: csClick, esc: () => { if (csDepth < 0) return false; csDepth = -1; wake(); return true; } },
      'Neuron': { icon: SVG('<circle cx="8" cy="8" r="2.2"/><path d="M6.2 7L2.5 3.5M6.2 9L2.5 12.5M10.2 8h4M2.5 3.5v2M2.5 12.5v-2"/>'), dots: true, hud: true, ego: true, layout: () => neyGeo().pos, backdrop: drawNey, hit: dotHit, can: (i) => neyGeo().role[i] > 0, dim: (i) => neyGeo().role[i] ? 1 : 0.05, size: (i) => { const r = neyGeo().role[i]; return r === 3 ? 0.9 : r === 0 ? 0.4 : 1.4; } },
      'Reflex arc': { icon: SVG('<circle cx="2.5" cy="12" r="1.3"/><circle cx="13.5" cy="12" r="1.3"/><path d="M3.5 11C5 2 11 2 12.5 11"/>'), dots: true, hud: true, layout: () => refGeo().pos, backdrop: drawRef, hit: dotHit, can: (i) => refGeo().role[i] > 0, dim: (i) => { const g = refGeo(), r = g.role[i]; return r === 2 ? (g.demo ? 0.55 : 1) : r === 1 ? 0.5 : 0.05; }, size: (i) => { const r = refGeo().role[i]; return r === 2 ? 2.2 * refFl(i) : r === 1 ? 0.7 : 0.4; } },
      'Synapse network': { icon: SVG('<circle cx="3" cy="4" r="1.3"/><circle cx="12" cy="3" r="1.3"/><circle cx="8" cy="9" r="1.3"/><circle cx="3.5" cy="13" r="1.3"/><circle cx="13" cy="12" r="1.3"/><path d="M3 4l5 5M12 3L8 9M8 9l-4.5 4M8 9l5 3"/>'), dots: true, hud: true, layout: fsPos, backdrop: drawNet, hit: dotHit, size: (i) => Math.max(0.35, (2 + 1.4 * Math.sqrt(deg[i])) / (3 + nodes[i].size * 0.9) * 1.3), drag: fsDrag, dbl: () => { fsN.pin.clear(); fsN.it = Math.min(fsN.it, fsN.tot - 120); fsKick(); wake(); } },
      '3D brain': { icon: SVG('<path d="M8 1.5l5.5 3v7L8 14.5l-5.5-3v-7z"/><path d="M2.5 4.5L8 8l5.5-3.5M8 8v6.5"/>'), dots: true, hud: true, layout: () => b3Pos().pos, backdrop: drawB3, hit: dotHit, can: (i) => b3In[i], dim: (i) => b3In[i] ? 0.35 + 0.65 * b3D(i) : 0, size: (i) => b3In[i] ? 1.4 * (0.6 + 0.6 * b3D(i)) : 0, drag: b3Drag },
      'Dendrite tree': { icon: SVG('<circle cx="8" cy="13.2" r="1.2"/><path d="M8 12V7M8 9L4.5 5.5M8 9l3.5-3.5M4.5 5.5V2.5M4.5 5.5L2.5 3.5M11.5 5.5l2-2M11.5 5.5v-3"/>'), dots: true, hud: true, layout: () => dendGeo().pos, backdrop: drawDend, hit: dotHit, size: () => 0.55 },
      'Sundial': { icon: SVG('<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>'), dots: true, hud: true, layout: () => sunGeo().pos, backdrop: drawSun, hit: dotHit, size: () => 0.55 },
      'Wave': { icon: SVG('<path d="M1 8.5h2.5l1.5-5 2.2 10 2-8 1.3 3H15"/>'), dots: true, hud: true, layout: () => waveGeo().pos, backdrop: drawWave, hit: dotHit, can: (i) => !waveGeo().out[i], dim: (i) => waveGeo().out[i] ? 0.05 : 1, size: () => 0.5 },
      'Coral': { icon: SVG('<path d="M8 8c0-1 1.3-1 1.3 0s-1.8 1.9-2.7 0.5S8 3.8 10.2 4.4 13.6 8 12 10.8 6.4 13.6 4.6 11 3.4 4.6 6.2 2.8"/>'), dots: true, hud: true, layout: () => coralGeo().pos, backdrop: drawCoral, hit: dotHit, size: (i) => 0.8 + 1.8 * Math.sqrt(deg[i] / maxDeg) } };
    Object.entries({ 'Coral': 2.2, 'Synapse network': 1.4, 'Ego radial': 1.2, 'Time river': 1, 'Dendrite tree': 1, 'Sundial': 0.8, 'Spinal section': 1.2, 'Constellation map': 0.8, 'Wave': 0.8, '3D brain': 0.8 }).forEach(([k, v]) => { VIEWS[k].sway = v; });   // px of slow idle drift per dot
    if (!VIEWS[S.view]) S.view = 'Body';
    const shownPos = () => { const V = VIEWS[S.view], to = V.body && lastPP ? lastPP : V.layout();
      return vFrom && vtT < 1 && !V.body ? to.map((q, i) => [lerp(vFrom[i][0], q[0], vE), lerp(vFrom[i][1], q[1], vE)]) : to; };
    function switchView(name) { if (!VIEWS[name] || name === S.view) return; const cur = VIEWS[S.view], nxt = VIEWS[name], from = shownPos();
      toneFrom = bgToneRaw(); S.view = name; save(); hover = -1; fly = null; vRel = false; entT = calm() ? 9 : 0; inr.on = false; if (cOpen !== (nxt.body ? S.chips !== false : false)) { cOpen = nxt.body ? S.chips !== false : false; paintLcol(); } vFromBody = !!cur.body; stemA = stemT; stemB = name === 'Brainstem' ? 1 : 0; if (!(cur.body && nxt.body)) stemA = stemB;
      vFrom = REDUCE || (cur.body && nxt.body) ? null : from; vtT = REDUCE ? 1 : 0; paintSeg(); wake(); }
    const dotsPass = (pos, a) => { const V = VIEWS[S.view], nb = selNb(), qm = query && matches.size, bdl = []; ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter';
      for (let i = 0; i < nodes.length; i++) { const n = nodes[i]; if (!vis(n)) continue; const hit = qm && matches.has(i); ctx.globalAlpha = a * (inRange(n) && aOk(n) ? 0.85 : 0.08) * (n.stale ? 0.45 : 1) * (V.dim ? V.dim(i) : 1) * (nb && !nb.has(i) ? 0.35 : 1) * (qm && !hit ? 0.35 : 1) * (amOn() ? 1 + 0.15 * Math.sin(clock * TAU / (3 + 3 * hsh[i]) + hsh[i] * 50) : 1);
        const r = (3 + n.size * 0.9) * (V.size ? V.size(i) : 1) * (i === sel || hit ? 1.6 : 1) * hs[i] * (entT < 1 ? entS(pos[i]) : 1); ctx.drawImage(sprite(n.drgb), pos[i][0] - r, pos[i][1] - r, r * 2, r * 2);
        if (r > 0 && isLit(n) && (calm() || (r * 0.5 >= 2.4 && ctx.globalAlpha > 0.05))) bdl.push(i, r, ctx.globalAlpha); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; return bdl; };
    // 2 cached layers (glow dots, beads) refreshed at 12 Hz for the shimmer; instantly when the selection, filter, hover or layout changes
    const dotC = (() => { const a = document.createElement('canvas'), b = document.createElement('canvas'); return { a, b, ax: a.getContext('2d'), bx: b.getContext('2d'), k: '', src: null, mt: null }; })();
    const drawDots = (pos, a, src) => { if (!src) { beadPass(dotsPass(pos, a), pos); return; }
      let hsum = 0; for (const i of hAct) hsum += hs[i]; const k = [S.view, S.day, S.theme, calm(), amOn() ? Math.floor(clock * 12) : 0, dpr, canvas.width, canvas.height, sel, query, S.notes, S.record, S.stale, todayOn, range ? range.join() : '', areaKey(), hAct.size, hsum].join();
      if (dotC.k !== k || dotC.src !== src || dotC.mt !== matches) { dotC.k = k; dotC.src = src; dotC.mt = matches; const sv = ctx;
        try { for (const c of [dotC.a, dotC.b]) { if (c.width !== canvas.width || c.height !== canvas.height) { c.width = canvas.width; c.height = canvas.height; } const g = c === dotC.a ? dotC.ax : dotC.bx; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.setTransform(dpr, 0, 0, dpr, 0, 0); ctx = g; if (c === dotC.a) var bdl = dotsPass(pos, a); else beadPass(bdl, pos); } } finally { ctx = sv; } }
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter'; ctx.drawImage(dotC.a, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(dotC.b, 0, 0); ctx.restore(); };
    // static body layer (outline, skeleton, dust) cached offscreen; repainted when view/zoom/pan/rotation/theme/size change
    const layer = document.createElement('canvas'), bctx = layer.getContext('2d'); let bodyKey = '';
    // cached background (gradient + 3 soft auras behind the body) and overlay (vignette + grain)
    const bgL = document.createElement('canvas'), bgx = bgL.getContext('2d'), ovL = document.createElement('canvas'), ovx = ovL.getContext('2d'), bl = document.createElement('canvas'), blc = bl.getContext('2d'); let bgKey = '', ovKey = '', blKey = '';
    function bgLayer(bodyA) { const key = [W, H, dpr, S.day, S.theme, S.day ? 0 : bgToneNow().join(), zoom, panX, panY, Math.round(pitch * 50), S.timeline, Math.round(stemT * 50), Math.round(bodyA * 50)].join(); if (key === bgKey) return; bgKey = key;
      bgL.width = canvas.width; bgL.height = canvas.height; const g = bgx; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bgc = S.day ? ['#fbfaf7', '#e9e7e1'] : bgToneNow().map((c) => 'rgb(' + c.join(',') + ')'), bg = g.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H / 2, Math.max(W, H) * 0.8); bg.addColorStop(0, bgc[0]); bg.addColorStop(1, bgc[1]); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      if (!S.day && bodyA > 0.02) { const k = [camK, camX, camY]; camK = 1; camX = camY = 0; const sc = scale() / 380;
        for (const [p, col, a, r] of [[P(0, 1.02), '106,76,255', 0.10, 260], [P(0, 0.5), '47,211,255', 0.07, 320], [P(0, 0.05), '255,95,176', 0.06, 280]]) { const q = proj(p), R = r * sc, gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
          gr.addColorStop(0, `rgba(${col},${a * bodyA * (1 - 0.5 * stemT)})`); gr.addColorStop(1, `rgba(${col},0)`); g.save(); g.translate(q[0], q[1]); g.scale(0.75, 1.2); g.fillStyle = gr; g.fillRect(-R, -R, R * 2, R * 2); g.restore(); }
        [camK, camX, camY] = k; } }
    function overlay() { const key = [W, H, dpr, S.day, gFirst.length, KIN()].join(); if (key !== ovKey) { ovKey = key; ovL.width = canvas.width; ovL.height = canvas.height; const g = ovx; g.setTransform(dpr, 0, 0, dpr, 0, 0);
        const R = Math.hypot(W, H) * 0.75, gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, R);
        if (S.day) { gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.55, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(70,60,50,0.3)'); }
        else { gr.addColorStop(0, 'rgba(40,28,80,0.22)'); gr.addColorStop(0.55, 'rgba(10,8,24,0)'); gr.addColorStop(1, KIN() ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.18)'); }
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        if (!S.day) { g.globalCompositeOperation = 'lighter'; [[0, 0, 0], [W, H, 1]].forEach(([x, y, k]) => { const c = gFirst[Math.min(k, gFirst.length - 1)], rgb = c ? c.rgb : [120, 130, 255], Rl = Math.max(W, H) * 0.34, lg = g.createRadialGradient(x, y, 0, x, y, Rl); lg.addColorStop(0, rgba(rgb, 0.07)); lg.addColorStop(1, rgba(rgb, 0)); g.fillStyle = lg; g.fillRect(x - Rl, y - Rl, Rl * 2, Rl * 2); }); g.globalCompositeOperation = 'source-over'; } }   // A11 edge light leak: two corners, hues of the two largest areas
      grain();   // vignette + grain are baked into one layer (re-baked every 80 ms when the grain tile shifts), then blitted once
      const gk = ovKey + '|' + gOx + ',' + gOy + '|' + canvas.width + '|' + canvas.height; if (gk !== ovGk) { ovGk = gk; ovG.width = canvas.width; ovG.height = canvas.height; ovGx.drawImage(ovL, 0, 0);
        ovGx.save(); ovGx.setTransform(1, 0, 0, 1, -gOx, -gOy); ovGx.globalAlpha = KIN() ? 0.035 : 0.025; ovGx.fillStyle = grainP; ovGx.fillRect(gOx, gOy, canvas.width, canvas.height); ovGx.restore(); }
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(ovG, 0, 0); ctx.restore(); }
    function paintBody(bodyA, dim) { const k0 = [camK, camX, camY]; camK = 1; camX = camY = 0;   // static layer is painted at rest; the idle camera moves it as an image
      const ba = bodyA * (1 - stemT), sw = Math.sqrt(zoom);
      if (!S.day && ba > 0.02) { const c = proj(BRAIN.c), e = proj(P(BRAIN.c.x, BRAIN.c.y + 0.17, BRAIN.c.z)), R = Math.hypot(e[0] - c[0], e[1] - c[1]) * 1.0, gr = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], R);   // brain body glow, tone-mapped
        for (const [t, col, a] of [[0, '243,234,255', 0.9], [0.25, '201,168,255', 0.6], [0.6, '123,92,255', 0.22], [1, '123,92,255', 0]]) gr.addColorStop(t, `rgba(${col},${a * 0.07 * ba})`); ctx.fillStyle = gr; ctx.fillRect(c[0] - R, c[1] - R, R * 2, R * 2); }
      { const a = proj(P(-0.42, 1.15)), b = proj(P(0.42, -1.12)), mk = (c, a0, a1) => { const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, `rgba(${c},${a0 * ba})`); g.addColorStop(1, `rgba(${c},${a1 * ba})`); return g; };   // rim light from the upper left
        if (!S.day) { const o = mk('120,100,255', 0.11, 0.02); for (const p of OUTLINE) drawPath(p, o, 6); }
        const inn = S.day ? mk('60,40,80', 0.22, 0.06) : mk('170,200,255', 0.32, 0.07); for (const p of OUTLINE) drawPath(p, inn, 1); }
      if (ba > 0.02) { const c0 = proj(P(0, 0.3)), R0 = scale() * 0.85, gr = ctx.createRadialGradient(c0[0], c0[1], 0, c0[0], c0[1], R0), col = S.day ? '60,40,80' : '165,190,255'; gr.addColorStop(0, `rgba(${col},${0.05 * ba})`); gr.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = gr;   // v10 B1: faint body fill + vertebra ticks under the nerves
        for (const o of OUTLINE) { ctx.beginPath(); o.forEach((p0, i) => { const v = proj(p0); i ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1]); }); ctx.closePath(); ctx.fill(); }
        ctx.strokeStyle = `rgba(${col},${0.07 * ba})`; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i <= 26; i++) { const q = along(N.cord, i / 26), a = proj(P(q.x - 0.024, q.y, q.z)), b = proj(P(q.x + 0.024, q.y, q.z)); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke(); }
      for (const g of SKG) { const c = lr(g.kind, tone(colOf(g.kind))), km = g.kind === 'armR' ? 1.5 : g.kind === 'armL' ? 0.85 : 1;
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${g.a * bodyA * km * (S.day ? 1.5 : 1)})`; ctx.lineWidth = g.w * sw; ctx.beginPath();
        for (const sg of g.segs) sg.forEach((q0, i) => { const v = proj(q0); i ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1]); }); ctx.stroke(); }
      { const cyw = Math.cos(yaw), syw = Math.sin(yaw), cpw = Math.cos(pitch), spw = Math.sin(pitch), s0 = Math.min(W / 1.0, (H - TLH()) / FIT) * zoom * camK, ox = CX() + panX + camX, oy = (H - TLH()) / 2 + camY, bk = new Map();   // v10: one inlined projection, dust bucketed by colour x alpha level (one fillStyle per bucket instead of 12k)
        for (const d of dust) { if (d.rec && !S.record) continue; const p = stemT < 0.001 ? d.p : T(d.p); let x = p.x * cyw - p.z * syw, z = p.x * syw + p.z * cyw; const y = p.y - 0.015 + panY, y2 = y * cpw - z * spw; z = y * spw + z * cpw; const f = 3.2 / (3.2 + z);
          const km = d.kind === 'armR' ? 1.6 : d.kind === 'armL' ? 0.85 : 1, bm = d.nerve ? (d.rec ? 0.2 : 1) : 0.1, lv = Math.round(Math.max(0.04, 0.62 * f - 0.28) * bodyA * dim * km * bm * (S.day ? 1.3 : 1) * 40); if (lv <= 0) continue;
          const ck = d.ck !== undefined ? d.ck : (d.ck = dustCk(d)), key = ((ck * 2 + (d.nerve ? 1 : 0)) * 64) + Math.min(63, lv); let e = bk.get(key); if (!e) bk.set(key, e = { d, a: [] }); e.a.push(ox + x * f * s0, oy - y2 * f * s0); }
        for (const [key, e] of bk) { const d = e.d, c = lr(d.kind, tone(d.rgb)), sz = d.s * (d.nerve ? 1 : 1 + 1.6 * stemT); ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(key & 63) / 40})`; const A = e.a; ctx.beginPath(); for (let i = 0; i < A.length; i += 2) ctx.rect(A[i], A[i + 1], sz, sz); ctx.fill(); }   // v12: one path per bucket instead of ~10k fillRect calls
      }
      [camK, camX, camY] = k0;
    }
    // ---- v10 A global polish + D interaction: spring hover, beads, grain, dust, ripples, inertia, idle ambient ----
    const hs = new Float32Array(nodes.length).fill(1), hvl = new Float32Array(nodes.length), hg = new Float32Array(nodes.length), hAct = new Set(), hubs = nodes.map((_, i) => i).filter((i) => nodes[i].kind !== 'spine').sort((a, b) => deg[b] - deg[a]).slice(0, Math.max(1, Math.ceil(nodes.length * 0.02)));
    let hovPrev = -1, hovT0 = 0, hnb = new Set(), ripples = [], inr = { on: false, vx: 0, vy: 0, m: '' }, zoomT = null, zoomA = null, lastWheel = 0, lastAny = performance.now(), ambV = 0, ambNext = 0, ambK = -1;
    function hoverStep(dt, tn) {   // D1: critically-ish damped spring (k 220, c 18), neighbours 40 ms later, link glow 120 ms
      if (hover !== hovPrev) { hovPrev = hover; hovT0 = tn; hnb = hover >= 0 ? new Set(adj[hover]) : new Set(); if (hover >= 0) { hAct.add(hover); for (const j of hnb) hAct.add(j); } }
      if (!hAct.size) return; const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n, kg = Math.min(1, dt / 0.2);
      for (const i of hAct) { const cur = i === hover || hnb.has(i), tg = calm() ? 1 : i === hover ? 1.35 : hnb.has(i) && tn - hovT0 > 0.04 ? 1.12 : 1; let s = hs[i], v = hvl[i]; for (let k = 0; k < n; k++) { v += (220 * (tg - s) - 18 * v) * h; s += v * h; } hs[i] = s; hvl[i] = v;
        hg[i] += ((i === hover ? 1 : 0) - hg[i]) * (calm() ? 1 : kg); if (!cur && Math.abs(s - 1) < 0.002 && Math.abs(v) < 0.02 && hg[i] < 0.003) { hs[i] = 1; hvl[i] = 0; hg[i] = 0; hAct.delete(i); } } }
    const entS = (q) => { const d = Math.min(0.35, Math.hypot(q[0] - W / 2, q[1] - H / 2) * 0.0004); return backOut(cl01((entT - d) / 0.26)); };   // A12 staggered entrance
    function tintStep(dt) { const c = (gFirst[areaSet.size ? Math.max(0, groupNames.indexOf([...areaSet][0])) : 0] || { rgb: tintCur }).rgb, k = 1 - Math.exp(-dt / 0.2); for (let q = 0; q < 3; q++) tintCur[q] += (c[q] - tintCur[q]) * k; }   // A10
    function inertStep(dt) { if (!inr.on) return; if (drag) { inr.on = false; return; } const f = Math.pow(0.92, dt * 60), ms = dt * 1000; inr.vx *= f; inr.vy *= f; if (Math.hypot(inr.vx, inr.vy) < 0.02) { inr.on = false; return; }
      if (inr.m === 'body') { yaw += inr.vx * ms * 0.008; pitch = Math.max(-1.2, Math.min(1.2, pitch + inr.vy * ms * 0.008)); }
      else if (inr.m === 'b3') { b3.yaw += inr.vx * ms * 0.009; b3.pitch = Math.max(-1.4, Math.min(1.4, b3.pitch + inr.vy * ms * 0.009)); b3.hold = performance.now(); }
      else if (inr.m === 'pan') { fsN.px += inr.vx * ms; fsN.py += inr.vy * ms; fsN.ver++; } }   // D3 inertia: x0.92 per 60 Hz frame until < 0.02 px/ms
    function zoomStep(dt) { if (zoomT == null) return; const now = performance.now(), z0 = zoom;
      if (now - lastWheel > 120) zoomT = Math.max(0.5, Math.min(6, zoomT));
      const k = calm() ? 1 : 1 - Math.exp(-dt / (zoom < 0.5 || zoom > 6 ? 0.07 : 0.045)); zoom = z0 + (zoomT - z0) * k;
      if (zoomA && VIEWS[S.view].body && z0 > 0) { const r = zoom / z0; panX += (zoomA[0] - CX() - panX) * (1 - r); panY += ((zoomA[1] - (H - TLH()) / 2) / (scale() / r)) * (1 - 1 / r); }
      if (Math.abs(zoomT - zoom) < 0.0015 && now - lastWheel > 150 && zoomT >= 0.5 && zoomT <= 6) { zoom = zoomT; zoomT = null; zoomA = null; } }
    function ambStep(ts, dt) { const want = !calm() && ts - lastAny > 20000 ? 1 : 0; ambV = want ? Math.min(1, ambV + dt / 0.7) : Math.max(0, ambV - dt / 0.2);
      if (want) { if (ts > ambNext) { if (ambNext && hubs.length) ripples.push({ i: hubs[(Math.random() * hubs.length) | 0], x: 0, y: 0, t0: performance.now(), amb: 1 }); ambNext = ts + 6000 + Math.random() * 3000; } } else ambNext = 0;
      const k = Math.round(ambV * 100); if (k !== ambK) { ambK = k; for (const x of [gear, lcol, seg, seg2, helpBtn, search]) x.style.opacity = 1 - 0.75 * ambV; } }   // D6
    const tabNav = (d) => { const V = VIEWS[S.view], ids = nodes.map((_, i) => i).filter((i) => vis(nodes[i]) && isLit(nodes[i]) && (!V.can || V.can(i))).sort((a, b) => nodes[a].gi - nodes[b].gi || deg[b] - deg[a] || a - b); if (!ids.length) return;
      let k = ids.indexOf(sel); k = k < 0 ? (d > 0 ? 0 : ids.length - 1) : (k + d + ids.length) % ids.length; sel = ids[k]; selT = performance.now(); showCard(sel); flash = { i: sel, t0: clock }; wake(); };
    // beads (A2) and contact shadow (A7): one sprite per colour x 4 size buckets, drawn over the glow for the bigger dots
    const rgb2hsl = (c) => { const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2; let h = 0, s = 0; if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; };
    const hsl2rgb = ([h, s, l]) => { const f = (n) => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; };
    const beads = {}, bead = (rgb0, bk) => { const rgb = tone(rgb0), key = rgb.join(',') + '|' + bk + (S.day ? 'd' : ''); if (beads[key]) return beads[key];
      const hl = rgb2hsl(rgb), out = hsl2rgb([hl[0], hl[1], S.day ? 0.4 : 0.55]), inn = hsl2rgb([hl[0], hl[1] * 0.8, S.day ? 0.7 : 0.85]), px = bk * 2 + 8, c = document.createElement('canvas'); c.width = c.height = px * 2; const g = c.getContext('2d'); g.scale(2, 2); const m = bk + 4;
      if (bk >= 5) { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(m, m + 0.9 * bk, 0.8 * bk, 0.25 * bk, 0, 0, TAU); g.fill(); }
      g.fillStyle = rgba(out, 1); g.beginPath(); g.arc(m, m, bk, 0, TAU); g.fill(); g.fillStyle = rgba(inn, 1); g.beginPath(); g.arc(m, m, bk * 0.45, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.beginPath(); g.arc(m, m, bk * 0.78, 2.88, 4.97); g.stroke(); return (beads[key] = c); };
    function shapeMark(x, y, r, gi) { const k = gi % 5; ctx.beginPath();
      if (k === 0) ctx.arc(x, y, r, 0, TAU); else if (k === 1) ctx.rect(x - r, y - r, r * 2, r * 2); else if (k === 2) { ctx.moveTo(x, y - r * 1.3); ctx.lineTo(x + r * 1.3, y); ctx.lineTo(x, y + r * 1.3); ctx.lineTo(x - r * 1.3, y); ctx.closePath(); }
      else if (k === 3) { ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.2, y + r * 0.9); ctx.lineTo(x - r * 1.2, y + r * 0.9); ctx.closePath(); } else { for (let q = 0; q < 6; q++) { const a = q * TAU / 6; q ? ctx.lineTo(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15) : ctx.moveTo(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15); } ctx.closePath(); } ctx.stroke(); }
    function beadPass(l, pos) { if (!l.length) return; const cm = calm(); ctx.save(); ctx.globalCompositeOperation = 'source-over'; if (cm) { ctx.lineWidth = 1.2; ctx.strokeStyle = ink(1); }
      for (let k = 0; k < l.length; k += 3) { const i = l[k], r = l[k + 1], n = nodes[i], q = pos[i], br = r * 0.5; ctx.globalAlpha = Math.min(1, l[k + 2] * 1.1);
        if (br >= 2.4) { const bk = br <= 3 ? 3 : br <= 5 ? 5 : br <= 8 ? 8 : 12, sz = (bk * 2 + 8) * br / bk; ctx.drawImage(bead(n.drgb, bk), q[0] - sz / 2, q[1] - sz / 2, sz, sz); }
        if (cm) { ctx.globalAlpha = 0.9; shapeMark(q[0], q[1], Math.max(2.2, br * 1.1), Math.max(0, n.gi)); } }
      ctx.restore(); }
    // A1 animated film grain (a 256 px tile, offset every 80 ms), drawn over everything in overlay()
    const grainT = (() => { const t = document.createElement('canvas'); t.width = t.height = 256; const tg = t.getContext('2d'), im = tg.createImageData(256, 256), rr0 = rnd('grain2'); for (let i = 0; i < 65536; i++) { const v = rr0() * 255 | 0; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } tg.putImageData(im, 0, 0); return t; })();
    let grainP = null, gOx = 0, gOy = 0, gLast = 0;
    const ovG = document.createElement('canvas'), ovGx = ovG.getContext('2d'); let ovGk = '';
    function grain() { if (!grainP) grainP = ctx0.createPattern(grainT, 'repeat'); const now = performance.now(); if (!calm() && now - gLast > 80) { gLast = now; gOx = (Math.random() * 256) | 0; gOy = (Math.random() * 256) | 0; } }
    // A5 chromatic fringe: the 1/4-res bloom copied twice, tinted red / blue, shifted -1 / +1 px
    const glR = document.createElement('canvas'), glB = document.createElement('canvas');
    function fringe(gw, gh) { if (calm() || !KIN()) return; for (const cv of [glR, glB]) if (cv.width !== gw || cv.height !== gh) { cv.width = gw; cv.height = gh; } const g = glR.getContext('2d'), h = glB.getContext('2d');   // one blit: red copy -1 px + blue copy +1 px (at 1/4 res = 0.25 px), added together
      h.globalCompositeOperation = 'source-over'; h.drawImage(gl, 0, 0, gw + 0.5, gh); h.globalCompositeOperation = 'multiply'; h.fillStyle = '#3c78ff'; h.fillRect(0, 0, gw, gh); h.globalCompositeOperation = 'source-over';
      g.globalCompositeOperation = 'source-over'; g.drawImage(gl, -0.5, 0, gw + 0.5, gh); g.globalCompositeOperation = 'multiply'; g.fillStyle = '#ff3c3c'; g.fillRect(0, 0, gw, gh); g.globalCompositeOperation = 'lighter'; g.drawImage(glB, 0, 0); g.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.06; ctx.drawImage(glR, 0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1; }
    // A6 dust motes: 60 specks, three parallax layers
    const MOTES = Array.from({ length: 60 }, (_, i) => { const r = rnd('mote' + i); return { x: r() * 1400, y: r() * 1000, l: i % 3, r: 0.6 + r() * 1.2, a: 0.05 + r() * 0.13, v: 4 + r() * 6, an: r() * TAU, g: r() * 997 | 0 }; });
    const DUSTOFF = new Set(['Matrix', 'Cortex map', 'Time river', 'Wave', 'Sundial', 'Heat body']);
    function drawDust(dt) { if (calm() || S.day || !W || DUSTOFF.has(S.view)) return; const PAR = [0.3, 0.6, 1.0]; ctx.globalCompositeOperation = 'source-over';
      let mk = 0; for (const m of MOTES) { if (!KIN() && ++mk > 30) break; const p = PAR[m.l], sp = m.v * (0.6 + 0.4 * p) * dt; m.x = ((m.x + Math.cos(m.an) * sp) % W + W) % W; m.y = ((m.y + Math.sin(m.an) * sp) % H + H) % H;
        const gf = gFirst[m.g % gFirst.length], c = gf ? gf.rgb : [200, 200, 255]; ctx.globalAlpha = KIN() ? m.a : Math.min(0.12, m.a); ctx.fillStyle = 'rgb(' + ((255 + (c[0] - 255) * 0.1) | 0) + ',' + ((255 + (c[1] - 255) * 0.1) | 0) + ',' + ((255 + (c[2] - 255) * 0.1) | 0) + ')'; ctx.beginPath(); ctx.arc(((m.x + panX * p) % W + W) % W, ((m.y + panY * 200 * p) % H + H) % H, m.r, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
    // A13 hub rings, D4 selection ring, D2 ripples (drawn from drawMarks, so every view gets them)
    const dotR = (i, q, body) => { const n = nodes[i], V = VIEWS[S.view]; return body ? (1.5 + n.size * 1.6) * q[2] * Math.sqrt(zoom) * n.zs : (3 + n.size * 0.9) * (V.size ? V.size(i) : 1); };
    function hubRings(pos, body) { const V = VIEWS[S.view], rot = calm() ? 0 : clock * TAU / 14; ctx.lineWidth = 0.75;
      for (const i of hubs) { const n = nodes[i], q = pos[i]; if (!q || !vis(n) || !isLit(n) || (V.dim && V.dim(i) < 0.2) || (V.can && !V.can(i))) continue; const r0 = dotR(i, q, body) * 0.45, c = tone(n.rgb);
        ctx.strokeStyle = rgba(c, 0.35); ctx.beginPath(); ctx.arc(q[0], q[1], r0 + 4, rot, rot + TAU - 0.7); ctx.stroke(); ctx.strokeStyle = rgba(c, 0.15); ctx.beginPath(); ctx.arc(q[0], q[1], r0 + 9, -rot, -rot + TAU - 0.7); ctx.stroke(); } }
    function selRing(pos, body) { if (sel < 0 || !pos[sel] || !vis(nodes[sel])) return; const q = pos[sel], rr0 = Math.max(9, dotR(sel, q, body) * 0.5 + 5), c = tone(nodes[sel].rgb), cm = calm();
      ctx.setLineDash([4, 4]); ctx.lineDashOffset = cm ? 0 : -clock * 20; ctx.strokeStyle = ink(0.95); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q[0], q[1], rr0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
      ctx.strokeStyle = rgba(c, cm ? 0.35 : 0.25 + 0.15 * (0.5 + 0.5 * Math.sin(clock * TAU / 1.6))); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q[0], q[1], rr0 + 5, 0, TAU); ctx.stroke(); ctx.lineWidth = 1; }
    function drawRipples() { if (!ripples.length) return; const now = performance.now(); ctx.globalCompositeOperation = 'source-over';
      for (let k = ripples.length - 1; k >= 0; k--) { const rp = ripples[k], age = (now - rp.t0) / 1000, dur = rp.amb ? 1.2 : 0.42, R = rp.amb ? 70 : 46; if (age > dur + 0.1) { ripples.splice(k, 1); continue; }
        const has = rp.i >= 0 && lastPP && lastPP[rp.i], q = has ? lastPP[rp.i] : [rp.x, rp.y], col = rp.i >= 0 ? tone(nodes[rp.i].rgb).map((v) => lerp(v, 255, 0.5) | 0) : [180, 185, 200];
        for (const d of [0, 0.09]) { const u = (age - d) / dur; if (u <= 0 || u >= 1) continue; ctx.strokeStyle = rgba(col, (rp.i >= 0 ? 0.6 : 0.3) * (1 - u)); ctx.lineWidth = 2 - 1.5 * u; ctx.beginPath(); ctx.arc(q[0], q[1], R * (1 - (1 - u) * (1 - u)), 0, TAU); ctx.stroke(); } } }
    // A8 type tiers: text outline in the backdrop colour instead of shadow blur (alpha 1 in calm mode), 13 px uppercase area titles with 0.08em tracking
    const tOut = (t, x, y) => { ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = S.day ? 'rgba(251,250,247,' + (calm() ? 1 : 0.85) + ')' : 'rgba(4,5,14,' + (calm() ? 1 : 0.85) + ')'; ctx.strokeText(t, x, y); ctx.restore(); };
    const title = (t, x, y, al) => { ctx.save(); ctx.font = '600 12px -apple-system,sans-serif'; try { ctx.letterSpacing = '1px'; } catch (e) {} ctx.textAlign = al || 'center'; ctx.textBaseline = 'middle'; const f = ctx.fillStyle; tOut(t, x, y); ctx.fillStyle = f; ctx.fillText(t, x, y); ctx.restore(); };
    // A9: hub names fade in at zoom 0.5-0.7, the next 60 notes at 0.9-1.3, with a 6 px rise; label boxes may not overlap
    const hubTop = hubs.slice(0, 14), noteTop = nodes.map((_, i) => i).filter((i) => nodes[i].kind !== 'spine' && !hubs.includes(i)).sort((a, b) => deg[b] - deg[a]).slice(0, 60);
    const txC = new Map(), txw = (t, w) => { const k = w + t; let v = txC.get(k); if (v == null) { v = ctx.measureText(t).width; if (txC.size > 2000) txC.clear(); txC.set(k, v); } return v; };   // widths of the lobe labels (font already set by the caller)
    // v12: canvas tooltip card, same glass / radius / border / shadow as the preview card (8 px radius, 8 x 12 padding)
    const tipBg = (x, y, w, h) => { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.24)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4; ctx.fillStyle = 'rgba(22,18,44,.9)'; rr(x, y, w, h, 8); ctx.fill(); ctx.restore(); ctx.strokeStyle = 'rgba(160,140,255,.16)'; ctx.lineWidth = 1; rr(x, y, w, h, 8); ctx.stroke(); ctx.fillStyle = '#e8eaff'; };
    const tipLine = (t, mx, my, minY) => { ctx.font = '600 12px -apple-system,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; const w = ctx.measureText(t).width + 24, h = 28, bx = mx + 12 + w > W - 8 ? Math.max(8, mx - 12 - w) : mx + 12, by = Math.max(minY, Math.min(my - 14, H - TLH() - h - 4)); tipBg(bx, by, w, h); ctx.fillText(t, bx + 12, by + h / 2); };
    const lwC = new Map(), lw = (t, f) => { const k = f + t; let w = lwC.get(k); if (w == null) { ctx.font = f; w = ctx.measureText(t).width; if (lwC.size > 4000) lwC.clear(); lwC.set(k, w); } return w; };
    function hubLabels(pp) { const aH = calm() ? (zoom >= 0.6 ? 1 : 0) : smooth01(0.5, 0.7, zoom), aN = calm() ? (zoom >= 1.1 ? 1 : 0) : smooth01(0.9, 1.3, zoom); if (aH < 0.02) return; const boxes = []; let nLab = 0; ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      for (const [list, al, hub] of [[hubTop, aH, true], [noteTop, aN, false]]) { if (al < 0.02) continue; for (const i of list) { const n = nodes[i], q = pp[i]; if (!vis(n) || !isLit(n) || fdv[i] < 0.9) continue; let t = n.name.length > 24 ? n.name.slice(0, 23) + '…' : n.name; ctx.font = (hub ? '600' : '400') + ' 11px -apple-system,sans-serif';
          if (nLab >= 60) break; const fnt = ctx.font; let t2 = t; while (t2.length > 4 && lw(t2, fnt) > 160) t2 = t2.slice(0, -2) + '…'; if (t2 !== t) t = t2; ctx.font = fnt; const w = lw(t, fnt) + (hub ? 26 : 0), x = q[0] + 8, y = q[1] - 8 + (1 - al) * (calm() ? 0 : 6); if (x + w > W - 4 || x < 4 || boxes.some((b) => x < b[0] + b[2] && x + w > b[0] && Math.abs(y - b[1]) < 13)) continue; boxes.push([x, y, w]); nLab++;
          ctx.globalAlpha = al * (hub ? 0.85 : 0.6); tOut(t, x, y); ctx.fillStyle = ink(1); ctx.fillText(t, x, y); if (hub) { ctx.font = '10px -apple-system,sans-serif'; ctx.globalAlpha = al * 0.55; ctx.fillStyle = ink(1); ctx.fillText(String(deg[i]), x + w - 22, y); } } } ctx.restore(); }
    let toneFrom = null;
    const lerpC = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k)), bgToneRaw = () => { const to = VT[S.view] || VT['Body'], fr = toneFrom || to, k = vtT < 1 ? vE : 1; return [0, 1].map((j) => lerpC(fr[j], to[j], k)); };
    const bgToneNow = () => { const r = bgToneRaw(); if (S.theme === 'Original') return r; const th = BG[S.theme] || BG.Original; return r.map((c, j) => lerpC(c, hexToRgb(parseInt(th[j].slice(1), 16)), 0.5)); };
    let egoAt = 0, refKey = '', refT0 = 0;
    function draw(ts) {
      const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; clock += dt * S.speed; introT = REDUCE ? 9 : introT + dt; if (tourOn) { tourT += dt; if (tourT > 4.5) { tourI++; tourGo(); } }
      if (S.turning && !calm() && !drag) yaw = 0.45 * Math.sin(clock * 0.18);
      layoutT += (S.layout - layoutT) * Math.min(1, dt * 4);
      hoverStep(dt, ts / 1000); entT = Math.min(9, entT + dt); tintStep(dt); inertStep(dt); zoomStep(dt); ambStep(ts, dt);
      if (camTw) { const u = Math.min(1, camTw.t += dt / 0.4), e = ezIO(u); zoom = lerp(camTw.z0, camTw.z1, e); panX = lerp(camTw.x0, camTw.x1, e); panY = lerp(camTw.y0, camTw.y1, e); if (u >= 1) camTw = null; }
      nodes.forEach((n) => { n.p.x = lerp(n.body.x, n.grp.x, layoutT); n.p.y = lerp(n.body.y, n.grp.y, layoutT); n.p.z = lerp(n.body.z, n.grp.z, layoutT); });
      const bodyA = 1 - layoutT;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      vtT = REDUCE ? 1 : Math.min(1, vtT + dt / 0.4); vE = ezIO(vtT); stemT = lerp(stemA, stemB, vE); if (vtT >= 1) vFrom = null; paintPills();
      // idle breathing camera (off for reduced motion, resets on any input)
      if (calm()) camE = 0; camE += ((!calm() && !drag && !pinch && !fly && ts - lastIn > 4000 ? 1 : 0) - camE) * Math.min(1, dt * 2); const tt = ts / 1000;
      camK = 1 + 0.012 * (0.5 - 0.5 * Math.cos(tt * TAU / 8)) * camE; camX = 6 * Math.sin(tt * TAU / 11) * camE; camY = 4 * Math.sin(tt * TAU / 14) * camE;
      if (ambV > 0.001) { camK *= 1 + ambV * 0.015 * Math.sin(tt * TAU / 30); camX += ambV * 19 * Math.sin(tt * TAU / 60); camY += ambV * 12 * Math.sin(tt * TAU / 47); }   // v10 D6 idle drift
      // selection focus: 220 ms ease, 1-hop stays, 2-hop half, rest dim
      if (sel >= 0 && sel !== fSel) { fSel = sel; fAdj = new Set(adj[sel]); f2 = new Set(); for (const j of adj[sel]) for (const k of adj[j]) f2.add(k); }
      selFade = REDUCE ? (sel >= 0 ? 1 : 0) : cl01(selFade + (sel >= 0 ? 1 : -1) * dt / 0.2); if (sel < 0 && selFade === 0) fSel = -1;
      const selE = 1 - Math.pow(1 - selFade, 3), focusLv = (i) => { if (fSel < 0 || selE <= 0) return 1; const t = i === fSel || fAdj.has(i) ? 1 : f2.has(i) ? 0.5 : 0.18; return 1 - (1 - t) * selE; };
      labT = calm() ? (zoom >= 1.1 ? 1 : 0) : smooth01(0.9, 1.3, zoom);   // v10 A9: fade by zoom, not pop
      bgLayer(bodyA); ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (calm()) ctx.drawImage(bgL, 0, 0); else { const bw = canvas.width, bh = canvas.height, bs = Math.sin(tt * TAU / (KIN() ? 9 : 12)), bk = 1 + (KIN() ? 0.015 : 0.01) * (1 + bs); ctx.drawImage(bgL, (bw - bw * bk) / 2, (bh - bh * bk) / 2, bw * bk, bh * bk); if (!S.day) { ctx.globalAlpha = (KIN() ? 0.02 : 0.01) * (0.5 - 0.5 * bs); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, bw, bh); ctx.globalAlpha = 1; } }   // v10 A4: the cached backdrop swells +-3% on a 9 s sine
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!S.day) { ctx.fillStyle = 'rgb(191,180,255)'; for (const st of stars) { const [sz, a, par] = STAR_L[st.l]; ctx.globalAlpha = a * (st.tw && !calm() ? 0.5 + 0.5 * Math.sin(ts / 1000 * TAU / st.tw + st.ph) : 1);
          ctx.fillRect(((st.x * W + panX * par) % W + W) % W, ((st.y * H + panY * 200 * par) % H + H) % H, sz, sz); } ctx.globalAlpha = 1; }
      drawDust(dt);
      const V = VIEWS[S.view], vBody = vFromBody || vtT >= 1 ? 1 : vE; heatT = cl01(heatT + ((V.heat ? 1 : 0) - heatT) * Math.min(1, dt * 5));
      if (!V.body) { if (V.ego && sel !== egoK) { egoK = sel; egoAt = performance.now(); if (lastPP && !REDUCE && vtT >= 1 && lastPP.length === nodes.length) { vFrom = lastPP.map((q) => [q[0], q[1]]); vtT = 0; vE = 0; vRel = true; } }   // ego: a new centre glides the dots over
        const tw = vFrom && vtT < 1; ctx.globalAlpha = tw ? (vRel ? Math.abs(2 * vE - 1) : vE) : 1; V.backdrop(dt); ctx.globalAlpha = 1;
        const to = V.layout(), pos = tw ? to.map((q, i) => [lerp(vFrom[i][0], q[0], vE), lerp(vFrom[i][1], q[1], vE)]) : to; let pos2 = pos; if (V.sway && amOn() && !tw) pos2 = pos.map((q, i) => [q[0] + V.sway * Math.sin(clock * TAU / (5 + 4 * hsh[i]) + hsh[i] * 30), q[1] + V.sway * Math.cos(clock * TAU / (6 + 4 * hsh[i]) + hsh[i] * 20)]); lastPP = pos2; if (V.dots || tw) drawDots(pos2, V.dots ? 1 : 1 - 0.8 * vE, !tw && V.dots && !V.dim && entT >= 1 && !drag && !pinch ? to : null);
        if (amOn() && !tw && AMB[S.view]) { ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter'; AMB[S.view](pos2); ctx.restore(); }
        drawMarks(pos2, false); if (V.hud) { overlay(); drawHud(null); } return; }
      ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter';
      if (bodyA > 0.02) { const dim = range ? 0.45 : 1, key = [Math.round(yaw * (drag || pinch ? 333 : 250)), pitch, zoom, panX, panY, W, H, dpr, S.theme, S.day, S.record, S.timeline, Math.round(bodyA * 100), Math.round(stemT * 100), dim, layoutT < 1].join();
        if (key !== bodyKey) { bodyKey = key; ctx = bctx; layer.width = canvas.width; layer.height = canvas.height; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalCompositeOperation = S.day ? 'source-over' : 'lighter'; paintBody(bodyA, dim); ctx = ctx0; }
        if (selE > 0.01 && glowOk && blKey !== key) { blKey = key; bl.width = Math.max(1, layer.width >> 2); bl.height = Math.max(1, layer.height >> 2); blc.filter = 'blur(1.5px)'; blc.drawImage(layer, 0, 0, bl.width, bl.height); blc.filter = 'none'; }   // 1/4-res copy = the soft background while a note is focused
        const fi = introT < 1 ? easeOut(cl01(introT / 0.7)) : 1, tlh = TLH(); ctx.setTransform(camK, 0, 0, camK, (CX() * (1 - camK) + camX) * dpr, ((H - tlh) / 2 * (1 - camK) + camY) * dpr);
        ctx.globalAlpha = fi * (1 - 0.75 * selE) * vBody * (todayOn ? 0.4 : 1); ctx.drawImage(layer, 0, 0); if (selE > 0.01 && glowOk) { ctx.globalAlpha = fi * 0.55 * selE; ctx.drawImage(bl, 0, 0, layer.width, layer.height); } ctx.globalAlpha = 1; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
      if (fly) { const n = nodes[fly.i], q = proj(n.p), cy = (H - TLH()) / 2, k = Math.min(1, dt * 6); fly.t += dt;
        zoom += (fly.z - zoom) * k; panX += (CX() - q[0]) * k; panY -= (cy - q[1]) / (q[2] * scale()) * k;
        if ((fly.t > 0.4 && Math.hypot(CX() - q[0], cy - q[1]) < 2 && Math.abs(fly.z - zoom) < 0.02) || fly.t > 2.5) fly = null; }
      const pp = lastPP = nodes.map((n) => proj(n.p)); if (vFrom && vtT < 1) for (let i = 0; i < pp.length; i++) { pp[i][0] = lerp(vFrom[i][0], pp[i][0], vE); pp[i][1] = lerp(vFrom[i][1], pp[i][1], vE); }
      nodes.forEach((n, i) => { const x = cl01((introT - n.dl) / 0.26); fdv[i] = introT > 1.6 ? 1 : x * (2 - x); });
      const vis = (n) => S.notes && (S.record || n.kind !== 'spine') && (S.stale || !n.stale);
      for (let i = 0; i < nodes.length; i++) { const n = nodes[i]; vA[i] = vis(n) ? 1 : 0; lA[i] = isLit(n) ? 1 : 0; }   // per-frame flags so the 2.4k-link loop does no per-link function calls
      ctx.lineWidth = 0.6;
      { const fast = introT > 1.6, kf = (S.day ? 1.6 : 1) * (calm() ? 1.6 : 1), bt = new Map(), cs = (c) => c === 0 ? 0.01 : c === 1 ? 0.018 : 0.06; ctx.globalAlpha = calm() ? 1 : cl01((entT - 0.2) / 0.3);   // links fade in 200 ms after a view switch
        for (let li = 0; li < links.length; li++) { const L2 = links[li], a = L2[0], b = L2[1]; if (!vA[a] || !vA[b]) continue; const A = pp[a], B = pp[b], c = nodes[a].rgb, hot = sel === a || sel === b, hv = hg[a] > hg[b] ? hg[a] : hg[b];
          const lit = lA[a] && lA[b], cat = !lit ? 0 : (isSp[a] || isSp[b]) ? 1 : 2, nb = cs(cat);
          if (fast && !hot && hv < 0.003 && !topL.has(li)) { const ga = nodes[a].gi, gb = nodes[b].gi, key = (cat * 64 + ga) * 64 + gb; let e = bt.get(key); if (!e) bt.set(key, e = [new Path2D(), ga === gb ? null : new Path2D(), ga === gb ? null : new Path2D()]);
            if (!e[1]) { e[0].moveTo(A[0], A[1]); e[0].lineTo(B[0], B[1]); } else { const x1 = lerp(A[0], B[0], 0.25), y1 = lerp(A[1], B[1], 0.25), x2 = lerp(A[0], B[0], 0.75), y2 = lerp(A[1], B[1], 0.75); e[0].moveTo(A[0], A[1]); e[0].lineTo(x1, y1); e[1].moveTo(x1, y1); e[1].lineTo(x2, y2); e[2].moveTo(x2, y2); e[2].lineTo(B[0], B[1]); } continue; }
          const lf = introT > 1.6 ? 1 : easeOut(cl01((introT - 0.12 - Math.max(nodes[a].dl, nodes[b].dl)) / 0.26)), base = nb * (1 - 0.75 * selE), al = (hot ? 0.75 : hv > 0.003 ? lerp(base, 0.7, hv) : base) * lf * kf, tc2 = tone(c);
          if (!hot && hv < 0.003 && topL.has(li)) { const c3 = tone(nodes[b].rgb), gr = ctx.createLinearGradient(A[0], A[1], B[0], B[1]); gr.addColorStop(0, `rgba(${tc2[0]},${tc2[1]},${tc2[2]},${Math.min(1, al * 1.8)})`);
            gr.addColorStop(0.5, `rgba(${(tc2[0] + c3[0]) >> 1},${(tc2[1] + c3[1]) >> 1},${(tc2[2] + c3[2]) >> 1},${al})`); gr.addColorStop(1, `rgba(${c3[0]},${c3[1]},${c3[2]},${Math.min(1, al * 1.8)})`); ctx.strokeStyle = gr; ctx.lineWidth = 0.9; }
          else { ctx.strokeStyle = `rgba(${tc2[0]},${tc2[1]},${tc2[2]},${al})`; ctx.lineWidth = hot ? 1.3 : lerp(0.55, 1.3, hv); }
          ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); }
        const kb = (1 - 0.75 * selE) * kf; ctx.lineWidth = 0.55;
        for (const [key, e] of bt) { const gb = key & 63, ga = (key >> 6) & 63, cat = key >> 12, al = cs(cat) * kb, ca = gRgb(ga);
          if (!e[1]) { ctx.strokeStyle = rgba(ca, al); ctx.stroke(e[0]); } else { const cb = gRgb(gb); ctx.strokeStyle = rgba(ca, al * 1.3); ctx.stroke(e[0]); ctx.strokeStyle = rgba([(ca[0] + cb[0]) >> 1, (ca[1] + cb[1]) >> 1, (ca[2] + cb[2]) >> 1], al * 0.7); ctx.stroke(e[1]); ctx.strokeStyle = rgba(cb, al * 1.3); ctx.stroke(e[2]); } }   // cross-area links: end quarters take each area's hue (A3)
        ctx.globalAlpha = 1; ctx.lineWidth = 0.6; }
      if (S.view === 'Brainstem' && stemT > 0.3 && !calm()) { ctx.save(); ctx.setLineDash([3, 9]); ctx.lineDashOffset = -clock * 12; ctx.strokeStyle = `rgba(190,215,255,${0.25 * cl01((stemT - 0.3) / 0.5)})`; ctx.lineWidth = 1; ctx.beginPath();
        for (const li of topS) { const [a, b] = links[li]; if (!vis(nodes[a]) || !vis(nodes[b])) continue; let A = pp[a], B = pp[b]; if (A[1] < B[1]) [A, B] = [B, A]; ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); } ctx.stroke(); ctx.restore(); }   // B14: dashes flow from the stem toward the brain (150 thickest links)
      // the selected note's tract: its nerve back to the spinal cord and up into the brain, with pulses
      if (sel >= 0 && nodes[sel].route && bodyA > 0.3) { const rt = nodes[sel].route, c = nodes[sel].rgb;
        drawPath(rt, `rgba(${c[0]},${c[1]},${c[2]},0.85)`, 2.2); drawPath(rt, 'rgba(235,228,255,0.3)', 0.8);
        for (let k = 0; k < 4; k++) { const q = proj(along(rt, ((clock * 0.35 + k / 4) % 1))); ctx.drawImage(sprite(c), q[0] - 9, q[1] - 9, 18, 18); } }
      if (calm()) sparks.length = 0; if (!calm() && bodyA > 0.3 && sparks.length < 50 && Math.random() < 0.6) { const pth = ALL[(Math.random() * ALL.length) | 0]; sparks.push({ p: pth, t: 0, v: 0.25 + Math.random() * 0.5 }); }
      for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.t += dt * s.v * S.speed; if (s.t >= 1) { sparks.splice(i, 1); continue; }
        const q = proj(along(s.p, s.t)); ctx.globalAlpha = bodyA; ctx.drawImage(sprite([170, 200, 255]), q[0] - 5, q[1] - 5, 10, 10); ctx.globalAlpha = 1; }
      if (S.flow && !calm() && bodyA > 0.3) { const f = sprite([190, 215, 255]), TA = [0.7, 0.45, 0.2];
        const dot = (a, b, k) => { const A = pp[a], B = pp[b], dur = 1.4 + 0.8 * ((k * 0.37) % 1), t = (clock / dur + k * 0.37) % 1, e = 0.5 - 0.5 * Math.cos(Math.PI * t), dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, x = lerp(A[0], B[0], e), y = lerp(A[1], B[1], e), sp = sprite(nodes[a].rgb);
          for (let j = 3; j >= 1; j--) { ctx.globalAlpha = TA[j - 1]; const sz = 8 - j; ctx.drawImage(sp, x - ux * 5 * j - sz / 2, y - uy * 5 * j - sz / 2, sz, sz); }   // comet tail
          ctx.globalAlpha = 0.9; ctx.drawImage(sp, x - 4, y - 4, 8, 8); ctx.drawImage(f, x - 2.2, y - 2.2, 4.4, 4.4); };
        const fo = hover >= 0 ? hover : sel; if (fo !== fkey) { fkey = fo; flinks = fo < 0 ? [] : links.filter(([a, b]) => a === fo || b === fo).slice(0, 24); }
        flinks.forEach(([a, b], k) => { if (vis(nodes[a]) && vis(nodes[b])) dot(a, b, k); });
        if (Math.floor(clock / 8) !== ambT) { ambT = Math.floor(clock / 8); amb = Array.from({ length: Math.min(16, links.length) }, () => links[(Math.random() * links.length) | 0]); }
        amb.forEach(([a, b], k) => { if (vis(nodes[a]) && vis(nodes[b])) dot(a, b, k + 30); }); ctx.globalAlpha = 1; }
      for (let k = beats.length - 1; k >= 0; k--) { const age = clock - beats[k]; if (age > 1.8) { beats.splice(k, 1); continue; } if (stemT > 0.5 || !S.heart) continue; const q = proj(HEART);
        for (const d of [0, 0.25]) { const a = age - d; if (a < 0) continue; ctx.strokeStyle = `rgba(255,120,140,${0.7 * (1 - a / 1.8)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q[0], q[1], 5 + a * 32 * zoom, 0, TAU); ctx.stroke(); } }
      for (const [i, t0] of born) { const age = clock - t0; if (age > 6) { born.delete(i); continue; } const n = nodes[i], c = tone(n.rgb), q = pp[i];
        if (age < 1.6) { const u = age / 1.6, e = 1 - (1 - u) * (1 - u), src = proj(along(N.cord, 0.3)); q[0] = lerp(src[0], q[0], e); q[1] = lerp(src[1], q[1], e); }
        const rr = 6 + age * 26; ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, 0.8 - age / 6)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q[0], q[1], rr, 0, TAU); ctx.stroke(); }
      // heartbeat: a ring of brightness travels out from the chest (two beats, the 2nd weaker), nodes in the band gain alpha
      const rings = [], hp = proj(HEART); if (S.heart && !calm() && stemT < 0.5 && bodyA > 0.3) { const ph = tt % 1.1, sc = scale();
        for (let k = 0; k < 2; k++) { const a = ph - 0.18 * k; if (a >= 0 && a < 0.9) { const u = a / 0.9; rings.push([(1 - Math.pow(1 - u, 3)) * sc * 1.15, sc * 0.11, (k ? 0.6 : 1) * (1 - 0.6 * u)]); } } }
      if (heatT > 0.01) drawHeat(pp);
      const bdl = [], dof = zoom < 1.8 && heatT < 0.5, farMode = false;
      for (const i of order) { const n = nodes[i]; if (!vis(n) || fdv[i] <= 0.01) continue; const q = pp[i], fd = fdv[i], foc = focusLv(i), lit0 = inRange(n) && (!query || matches.has(i)) && aOk(n), lit = lit0 && foc > 0.3;
        const r = (1.5 + n.size * 1.6) * q[2] * (i === sel || (query && matches.has(i)) ? 2.3 : born.has(i) ? 3 : 1) * hs[i] * (entT < 1 ? entS(q) : 1) * Math.sqrt(zoom) * n.zs * (todayOn && !calm() && todaySet.has(i) ? 1 + 0.3 * (0.5 + 0.5 * Math.sin(clock * TAU / 2.4)) : 1);
        const sp0 = n.kind === 'spine'; let bb = 0; for (const [R, bw, st] of rings) { const d = Math.abs(Math.hypot(q[0] - hp[0], q[1] - hp[1]) - R); if (d < bw) bb += (1 - d / bw) * 0.35 * st; }
        if (lit && heatT < 0.5) { const h = n.hot * (sp0 ? 0.5 : 1) * 0.6 + (threadSet.has(i) ? 0.2 + 0.14 * Math.sin(clock * 2.2 + i) : 0); if (h > 0.05) { const pul = calm() ? 0.5 : 0.5 + 0.5 * Math.sin(clock * TAU / 1.8 + i);   // coloured hot halo
            ctx.globalAlpha = Math.min(1, h * 1.6) * (0.4 + 0.2 * pul) * fd * foc; const hr = r * 3.2; ctx.drawImage(hsprite(n.rgb), q[0] - hr, q[1] - hr, hr * 2, hr * 2); } }
        if (n.orphan && lit && layoutT < 0.95) { const b = n.b0, v = proj(P(lerp(b.x, n.grp.x, layoutT), lerp(b.y, n.grp.y, layoutT), lerp(b.z, n.grp.z, layoutT))), c = tone(n.rgb), an = Math.atan2(q[1] - v[1], q[0] - v[0]);
          ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.4 * (n.stale ? 0.5 : 1)})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(v[0], v[1]); ctx.lineTo(q[0], q[1]);
          for (const d of [-0.6, 0.6]) { ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + Math.cos(an + d) * 5, q[1] + Math.sin(an + d) * 5); } ctx.stroke(); }
        ctx.globalAlpha = Math.min(1, (sp0 ? 0.1 : 0.85) * n.za * (n.kind === 'armR' ? 1.5 : n.kind === 'armL' ? 0.85 : n.kind === 'brain' || n.kind === 'core' ? 0.09 : 1) * (lit0 ? 1 : todayOn ? 0.10 : 0.08) * (n.stale ? 0.45 : 1) * (n.orphan ? 0.35 : 1) * (1 - 0.7 * heatT) * fd * foc + bb * foc);
        if (dof && n.z < 0.33) { const rf = r * 1.35; ctx.drawImage(hsprite(n.drgb), q[0] - rf, q[1] - rf, rf * 2, rf * 2); } else ctx.drawImage(sprite(n.drgb), q[0] - r, q[1] - r, r * 2, r * 2);   // A14: far third = soft wide glow, no bright core (a half-res layer cost 17 ms)
        if (!(dof && n.z < 0.33) && r > 0 && lit0 && heatT < 0.5 && (calm() || (r * 0.5 >= 2.4 && ctx.globalAlpha > 0.05))) bdl.push(i, r, ctx.globalAlpha);
        if (n.orphan && lit) { const c = tone(n.rgb); ctx.globalAlpha = 0.85 * fd * foc; ctx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q[0], q[1], 3, 0, TAU); ctx.stroke(); }   // open ring = orphan
        if (agentSet.has(i) && lit) { const x = q[0] + r * 0.8 + 3, y = q[1] - r * 0.8 - 3; ctx.globalAlpha = 1; ctx.fillStyle = S.day ? '#a06a00' : '#ffd56a'; ctx.beginPath(); ctx.moveTo(x, y - 3.5); ctx.lineTo(x + 3, y); ctx.lineTo(x, y + 3.5); ctx.lineTo(x - 3, y); ctx.closePath(); ctx.fill(); } }
      beadPass(bdl, pp);
      drawMarks(pp, true);
      if (flash) { const age = clock - flash.t0; if (age > 1.6) flash = null; else { const q = pp[flash.i], c = tone(nodes[flash.i].rgb); ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${1 - age / 1.6})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(q[0], q[1], 8 + (age * 2.5 % 1) * 30, 0, TAU); ctx.stroke(); } }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (S.glow && glowOk && !S.day) { const gw = canvas.width >> 2, gh = canvas.height >> 2; if (gl.width !== gw || gl.height !== gh) { gl.width = gw; gl.height = gh; blN = 0; }   // bloom from a 1/4-res blur, refreshed every 4th frame (7% additive glow: the lag is invisible)
        if (blN++ % 4 === 0 || drag || pinch || fly || camTw) {   // only the box around the notes is blurred / blitted (the rest of the frame holds just stars)
          let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < pp.length; i++) { const q = pp[i]; if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
          if (x1 > x0 && y1 > y0 && isFinite(x0 + x1 + y0 + y1)) { const m = 72 * dpr, ax = Math.max(0, (x0 * dpr - m) >> 2), ay = Math.max(0, (y0 * dpr - m) >> 2); blR = [ax, ay, Math.max(1, Math.min(gw, ((x1 * dpr + m) >> 2) + 1) - ax), Math.max(1, Math.min(gh, ((y1 * dpr + m) >> 2) + 1) - ay)]; } else blR = [0, 0, gw, gh];
          gctx.clearRect(0, 0, gw, gh); gctx.filter = 'blur(3px)'; gctx.drawImage(canvas, blR[0] * 4, blR[1] * 4, blR[2] * 4, blR[3] * 4, blR[0], blR[1], blR[2], blR[3]); gctx.filter = 'none'; }
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = KIN() ? 0.15 : 0.075; ctx.drawImage(gl, blR[0], blR[1], blR[2], blR[3], blR[0] * 4, blR[1] * 4, blR[2] * 4, blR[3] * 4); ctx.globalAlpha = 1; fringe(gw, gh); ctx.globalCompositeOperation = 'source-over'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
      for (const i of order) { const n = nodes[i]; if ((n.kind !== 'brain' && n.kind !== 'core') || !vis(n) || fdv[i] < 0.5 || !inRange(n) || !aOk(n)) continue; const q = pp[i], c = tone(n.rgb).map((v) => lerp(v, 255, 0.45) | 0);   // crisp cores after the bloom keep single notes visible in the head
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.9 * focusLv(i) * Math.min(1, fdv[i])})`; ctx.beginPath(); ctx.arc(q[0], q[1], 1.5, 0, TAU); ctx.fill(); }
      overlay();
      drawHud(pp);
    }
    // v6: loop pauses when hidden, idles at ~30 fps when nothing moves
    let visible = true, dead = false, lastDraw = 0;
    const idle = () => !drag && !pinch && !S.turning && !born.size && !fly && !flash && !beats.length && Math.abs(S.layout - layoutT) < 0.002 && vtT >= 1 && !todayOn && !camTw && !thrOn && !ripples.length && !inr.on && zoomT == null && Math.abs((VIEWS[S.view].heat ? 1 : 0) - heatT) < 0.01;
    function loop(ts) { raf = 0; if (dead || document.hidden || !visible) return; raf = requestAnimationFrame(loop);
      if (idle() && ts - lastDraw < 32) return; lastDraw = ts; draw(ts); }
    const wake = () => { if (!raf && !dead && !document.hidden && visible) raf = requestAnimationFrame(loop); };
    const groups = data.groups || [], mmOn = () => layoutT < 0.5 && zoom > 1.05 && VIEWS[S.view].body, mmRect = () => ({ x: W - 78, y: H - TLH() - 152, w: 64, h: 128 });
    function drawMini() { const m = mmRect(); ctx.save(); ctx.globalAlpha = Math.abs(mouse[0] - (m.x + m.w / 2)) < m.w / 2 + 8 && Math.abs(mouse[1] - (m.y + m.h / 2)) < m.h / 2 + 8 ? 1 : 0.55; drawMini2(m); ctx.restore(); }
    function drawMini2(m) { const  mx = (p) => m.x + (p.x + 0.6) / 1.2 * m.w, my = (p) => m.y + (1.25 - p.y) / 2.4 * m.h, ink = S.day ? '30,30,50' : '200,210,255', cl = (v, a, b) => Math.max(a, Math.min(b, v));
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(m.x - 3, m.y - 3, m.w + 6, m.h + 6, 8) : ctx.rect(m.x - 3, m.y - 3, m.w + 6, m.h + 6);
      ctx.fillStyle = S.day ? 'rgba(255,255,255,.55)' : 'rgba(22,18,44,.55)'; ctx.fill(); ctx.strokeStyle = S.day ? 'rgba(110,90,200,.4)' : 'rgba(160,140,255,.4)'; ctx.lineWidth = 1; ctx.stroke(); ctx.strokeStyle = `rgba(${ink},.35)`;
      for (const o of [...OUTLINE, N.cord, N.stem]) { ctx.beginPath(); o.forEach((p0, i) => { const p = T(p0); i ? ctx.lineTo(mx(p), my(p)) : ctx.moveTo(mx(p), my(p)); }); ctx.stroke(); }
      const cc = {}; for (const n of nodes) { if (!vis(n)) continue; const p = T(n.body); ctx.fillStyle = cc[n.gi] || (cc[n.gi] = 'rgba(' + n.rgb.join(',') + ',.85)'); ctx.fillRect(mx(p), my(p), 1, 1); }
      const s = scale(), Hc = H - TLH(), x0 = cl(mx({ x: (-CX() - panX) / s }), m.x, m.x + m.w), x1 = cl(mx({ x: (W - CX() - panX) / s }), m.x, m.x + m.w),
        y0 = cl(my({ y: Hc / 2 / s + 0.015 - panY }), m.y, m.y + m.h), y1 = cl(my({ y: -Hc / 2 / s + 0.015 - panY }), m.y, m.y + m.h);
      ctx.strokeStyle = S.day ? 'rgba(0,120,170,.8)' : 'rgba(47,211,255,.7)'; ctx.strokeRect(x0, y0, Math.max(2, x1 - x0), Math.max(2, y1 - y0)); }
    // v12 legend: bottom-left chip; colour = area (chips panel / labels), so only size and intensity encodings get a key
    const LEG = { 'Body': ['ramp', 'glow = recency', 'old', 'new', [96, 106, 170], [255, 226, 160]], 'Brainstem': ['ramp', 'spine = time order', 'old', 'new', [96, 106, 170], [255, 226, 160]], 'Ring': ['size', 'lane width = link count'], 'Matrix': ['ramp', 'notes / day', '0', 'many', [60, 70, 120], [150, 180, 255]],
      'Heat body': ['ramp', 'heat', 'cold', 'hot', [60, 80, 170], [255, 190, 80]], 'Cortex map': ['size', 'cell = link count'], 'Time river': ['size', 'thickness = notes per week', 'few', 'many'], 'Constellation map': ['size', 'brightness = link count'], 'Sundial': ['ramp', 'note count', 'few', 'many', [60, 66, 100], [255, 226, 160]],
      'Synapse network': ['size', 'size = link count'], 'Wave': ['size', 'height = notes / day', 'few', 'many'], 'Coral': ['size', 'size = link count'] };
    function drawLegend() { const L = LEG[S.view]; if (!L) return; const v = vp(), w = 112, h = 50, x = v.x0, y = v.y1 - h; ctx.save(); ctx.globalAlpha = 0.9; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; tipBg(x, y, w, h); ctx.globalAlpha = 1;
      ctx.font = '10px -apple-system,sans-serif'; ctx.fillStyle = 'rgba(232,234,255,.62)'; let cap = L[1]; while (cap.length > 6 && ctx.measureText(cap).width > w - 16) cap = cap.slice(0, -2) + '…'; ctx.fillText(cap, x + 8, y + 11);
      if (L[0] === 'ramp') { const gr = ctx.createLinearGradient(x + 8, 0, x + w - 8, 0); gr.addColorStop(0, rgba(L[4], 1)); gr.addColorStop(1, rgba(L[5], 1)); ctx.fillStyle = gr; rr(x + 8, y + 22, w - 16, 8, 4); ctx.fill(); ctx.fillStyle = 'rgba(232,234,255,.62)'; ctx.fillText(L[2], x + 8, y + 40); ctx.textAlign = 'right'; ctx.fillText(L[3], x + w - 8, y + 40); }
      else { const vals = L[2] ? [L[2], '', L[3]] : [1, Math.max(2, Math.round(maxDeg / 4)), maxDeg]; [3, 5, 8].forEach((r, k) => { const cx = x + 16 + k * 34; ctx.fillStyle = 'rgba(180,170,255,.55)'; ctx.beginPath(); ctx.arc(cx, y + 26, r * 0.8, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(232,234,255,.62)'; ctx.textAlign = 'center'; if (String(vals[k]) !== '') ctx.fillText(String(vals[k]), cx, y + 41); }); }
      ctx.restore(); }
    let hudA = 1;
    const SUBT = { 'Body': 'colour = area · glow = recency', 'Brainstem': 'colour = area · spine = time order', 'Ring': 'colour = area · lane width = link count', 'Matrix': 'colour = area · brightness = notes per day', 'Heat body': 'heat = recency / links', 'Cortex map': 'area = folder · cell size = links', 'Time river': 'colour = area · thickness = notes per week', 'Constellation map': 'colour = area · brightness = link count', 'Ego radial': 'centre = selected note · ring = step', 'Spinal section': 'ring = folder depth · sector = area', 'Neuron': 'dendrite = incoming, axon = outgoing link', 'Reflex arc': 'shortest path between two notes', 'Synapse network': 'colour = area · size = link count', '3D brain': 'colour = area · point cloud = brain lobes', 'Dendrite tree': 'branch = folder · leaf = note', 'Sundial': 'angle = hour · ring = weekday', 'Wave': 'lane = area · height = daily notes', 'Coral': 'spiral = creation date · size = link count' };
    function emptyCard() { ctx.save(); ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const cx = (L0() + W) / 2, cy = (H - TLH()) / 2; ctx.font = '600 14px -apple-system, Segoe UI, sans-serif'; ctx.fillStyle = ink(0.9); ctx.fillText('No matching notes', cx, cy - 8); ctx.font = '12px -apple-system, Segoe UI, sans-serif'; ctx.fillStyle = ink(0.55); ctx.fillText('Clear the search, area selection or period · Esc', cx, cy + 14); ctx.restore(); showClr(true, cx, cy + 46); }
    function drawHud(pp) {
      ctx.font = '11px -apple-system, Segoe UI, sans-serif'; ctx.textBaseline = 'middle';
      let y = 20; const hi = performance.now() - lastIn > 4000 ? 0.4 : 1; hudA += (hi - hudA) * 0.12; ctx.save(); ctx.globalAlpha = hudA; ctx.font = '600 18px -apple-system, Segoe UI, sans-serif'; ctx.fillStyle = S.day ? 'rgba(20,20,30,0.85)' : 'rgba(255,255,255,0.9)'; ctx.fillText(S.view, 16, y); const tw0 = ctx.measureText(S.view).width;
      { const nLit = nodes.filter((n) => vis(n) && isLit(n) && (!query || matches.has(nodes.indexOf(n)))).length, filt = nLit !== nodes.length; ctx.font = '12px -apple-system, Segoe UI, sans-serif'; ctx.fillStyle = S.day ? 'rgba(20,20,30,0.62)' : 'rgba(255,255,255,0.62)'; ctx.fillText('  ' + (filt ? nfmt(nLit) + ' / ' : '') + nfmt(nodes.length) + ' notes · ' + nfmt(links.length) + ' links' + (SUBT[S.view] ? ' · ' + SUBT[S.view] : ''), 16 + tw0, y + 1); if (!nLit) emptyCard(); else { showClr(false); drawLegend(); } } ctx.restore(); ctx.font = '11px -apple-system, Segoe UI, sans-serif';
      if (pp && mmOn()) drawMini();
      if (pp && S.labels && layoutT < 0.5 && stemT < 0.5) {
        const ink = S.day ? '30,30,55' : '220,215,255', F = (w) => w + ' 12px -apple-system, "SF Pro Text", Segoe UI, sans-serif';
        const tx = (x, y0, name, desc, align, al) => { if (al < 0.02) return; const y = y0 + (1 - al) * (calm() ? 0 : 6); ctx.save(); ctx.globalAlpha = al; try { ctx.letterSpacing = '0.44px'; } catch (e) {} ctx.textAlign = 'left'; ctx.font = F(600); const w1 = txw(name, 600); ctx.font = F(400);
          const dd = desc ? ' · ' + desc : '', w2 = dd ? txw(dd, 400) : 0, x0 = align === 'right' ? x - w1 - w2 : x;
          ctx.font = F(600); tOut(name, x0, y); ctx.fillStyle = `rgba(${ink},${S.day ? 0.85 : 0.78})`; ctx.fillText(name, x0, y); if (dd) { ctx.font = F(400); tOut(dd, x0 + w1, y); ctx.fillStyle = `rgba(${ink},0.6)`; ctx.fillText(dd, x0 + w1, y); } ctx.restore(); };
        const lead = (q, x, y, al) => { if (al < 0.02) return; ctx.save(); ctx.globalAlpha = al; ctx.strokeStyle = `rgba(${ink},0.35)`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(x, y); ctx.stroke();
          ctx.fillStyle = `rgba(${ink},0.55)`; ctx.beginPath(); ctx.arc(q[0], q[1], 2, 0, TAU); ctx.fill(); ctx.restore(); };
        const hc = proj(BRAIN.c), used = REGIONS.map((R, i) => [R, i]).filter(([, i]) => regLobes[i].length);
        const left = used.filter(([R], k) => R.d.x < 0 || (R.d.x === 0 && k % 2 === 0)), right = used.filter((u) => !left.includes(u));
        const colX = { l: proj(P(-0.55, 0.4))[0], r: proj(P(0.55, 0.4))[0] }, rowH = 15;   // one column per side shared by head and limb labels
        [[left, 'l'], [right, 'r']].forEach(([arr, side]) => arr.forEach(([R, i], k) => {
          const d = R.d, L = Math.hypot(d.x, d.y, d.z), q = proj(P(BRAIN.c.x + d.x / L * BRAIN.r.x * 0.9, BRAIN.c.y + d.y / L * BRAIN.r.y * 0.9, BRAIN.c.z + d.z / L * BRAIN.r.z * 0.9));
          const ty = hc[1] - (arr.length - 1) * rowH / 2 + k * rowH, x = colX[side], al = k === 0 ? 1 : labT;   // 2 brain labels at rest, the rest fade in when zoomed
          lead(q, x + (side === 'l' ? -1 : 1), ty, al); tx(x + (side === 'l' ? -5 : 5), ty, R.name, regLobes[i].join(', '), side === 'l' ? 'right' : 'left', al); }));
        hubLabels(pp);
        const cnt = (k) => nodes.filter((n) => n.kind === k).length;
        for (const [k, p, sd, name, desc] of [['armL', P(-0.33, 0.30), -1, 'Left arm', 'Skills'], ['armR', P(0.32, 0.30), 1, 'Right arm', 'Agents'], ['legL', P(-0.17, -0.60), -1, 'Left leg', 'notes'], ['legR', P(0.17, -0.60), 1, 'Right leg', 'other'],
          ['spine', P(0.0, 0.50), 1, 'Spine', 'receipts + daily + operations'], ['stem', P(0.0, 0.86), -1, 'Brainstem', 'Companion']]) { const q = proj(p), cx = sd < 0 ? colX.l : colX.r;
          lead(q, cx, q[1], 1); tx(cx + (sd < 0 ? -5 : 5), q[1], name, desc + ' ' + cnt(k), sd < 0 ? 'right' : 'left', 1); }
        ctx.textAlign = 'left'; }
      if (pp && layoutT >= 0.5 && S.labels) { ctx.font = '11px -apple-system, Segoe UI, sans-serif'; ctx.fillStyle = S.day ? 'rgba(30,30,45,0.8)' : 'rgba(255,255,255,0.7)';
        groupNames.forEach((g, i) => { const q = proj(gPos[i]); ctx.fillText(g || 'other', q[0] + 12, q[1] - 14); }); }
      const pq = pp || (VIEWS[S.view].hud ? lastPP : null); if (pq && query && matches.size) { ctx.font = '11px -apple-system,sans-serif'; let k = 0;
        for (const i of matches) { if (k++ >= 12) break; const q = pq[i]; ctx.fillStyle = S.day ? 'rgba(20,20,30,.85)' : 'rgba(255,255,255,.9)'; ctx.fillText(nodes[i].name, q[0] + 9, q[1] - 9); } }
      if (hover >= 0) { const q = pp ? pp[hover] : (S.view === 'Ring' ? ringPt(hover, ringGeo().R * 0.9 + 30) : lastPP && lastPP[hover] ? lastPP[hover] : [0, 0]), n = nodes[hover], t = n.name + (n.region ? ' · ' + n.region : '') + (pp ? '' : ' · ' + deg[hover] + ' links · ' + (ageD(n) < 1 ? 'today' : Math.round(ageD(n)) + ' days')); ctx.font = '12px -apple-system, Segoe UI, sans-serif';
        tipLine(t, q[0] + 4, q[1], 4); }
    }
    // ---- DOM: controls panel, selection card, timeline (lives over the canvas) ----
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const el = (tag, css, html) => { const e = document.createElement(tag); if (tag === 'button') e.className = 'sn-b'; if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; };
    const UI = 'font:12px -apple-system,Segoe UI,sans-serif;color:#e8eaff;';
    const gear = el('button', UI + 'height:28px;background:rgba(22,18,44,.55);backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);border:1px solid rgba(160,140,255,.16);border-radius:14px;padding:0 12px;cursor:pointer', '⚙︎ View');
    const panel = el('div', UI + 'position:absolute;top:42px;right:12px;z-index:4;width:230px;background:rgba(22,18,44,.78);backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);border:1px solid rgba(160,140,255,.16);border-radius:12px;padding:10px 12px;display:none;line-height:1.9');
    const row = (label, ctrl) => { const r = el('div', 'display:flex;justify-content:space-between;align-items:center;gap:8px'); r.append(el('span', '', label), ctrl); panel.append(r); return ctrl; };
    const chk = (k) => { const c = el('input'); c.type = 'checkbox'; c.checked = !!S[k]; c.onchange = () => { S[k] = c.checked; save(); if (k === 'timeline') { tl.style.display = S.timeline ? 'block' : 'none'; card.style.bottom = cardB(); drawTimeline(); } }; return c; };
    const themeSel = el('select', 'background:#1a1d33;color:#e8eaff;border:1px solid #333a66;border-radius:4px'); Object.keys(THEMES).forEach((t) => themeSel.append(new Option(t, t))); themeSel.value = S.theme;
    themeSel.onchange = () => { S.theme = themeSel.value; save(); applyTheme(); drawTimeline(); paintChips(); };
    panel.append(el('div', 'opacity:.6;font-size:10px;letter-spacing:.08em', 'VIEW'));
    const viewSel = el('select', 'background:#1a1d33;color:#e8eaff;border:1px solid #333a66;border-radius:4px'); Object.keys(VIEWS).forEach((t) => viewSel.append(new Option(t, t))); viewSel.value = S.view;
    viewSel.onchange = () => switchView(viewSel.value);
    row('View', viewSel); row('Day mode', (() => { const c = chk('day'); const o = c.onchange; c.onchange = () => { o(); for (const k in sprites) delete sprites[k]; }; return c; })());
    row('Colour theme', themeSel); row('Labels', chk('labels')); row('Notes', chk('notes')); row('Spine (note records)', chk('record')); row('Glow', chk('glow')); row('Show stale (' + nStale + ')', chk('stale'));
    panel.append(el('div', 'opacity:.6;font-size:10px;letter-spacing:.08em;margin-top:4px', 'MOTION'));
    row('Sway', chk('turning')); row('Signal flow', chk('flow')); row('Heartbeat', chk('heart')); row('Effect', (() => { const w = el('div', 'display:flex;gap:2px;background:rgba(255,255,255,.06);border-radius:6px;padding:2px'), bs = {}; const paint = () => { for (const k in bs) { bs[k].style.background = S.fx === k ? 'rgba(160,140,255,.35)' : 'none'; bs[k].setAttribute('aria-pressed', S.fx === k); } };
      for (const [k, t] of [['calm', 'Calm'], ['std', 'Standard'], ['kin', 'Cinematic']]) { const b = el('button', 'font:inherit;font-size:11px;color:inherit;border:0;border-radius:4px;padding:0 6px;cursor:pointer;line-height:20px;box-shadow:none', t); b.onclick = () => { S.fx = k; S.calm = k === 'calm'; save(); ovKey = ''; bgKey = ''; wake(); paint(); }; bs[k] = b; w.append(b); } paint(); return w; })());
    const sp = el('input', 'width:110px'); sp.type = 'range'; sp.min = 0.2; sp.max = 3; sp.step = 0.1; sp.value = S.speed; sp.oninput = () => { S.speed = +sp.value; save(); }; row('Speed', sp);
    const ly = el('input', 'width:110px'); ly.type = 'range'; ly.min = 0; ly.max = 1; ly.step = 0.01; ly.value = S.layout; ly.oninput = () => { S.layout = +ly.value; save(); }; row('Body ↔ Groups', ly);
    row('Timeline', chk('timeline'));
    const reset = el('button', UI + 'margin-top:6px;width:100%;background:#22264a;border:1px solid #39407a;border-radius:5px;padding:4px;cursor:pointer', 'Reset');
    reset.onclick = () => { zoomT = null; tmZoom = -1; csDepth = -1; panX = 0; fly = null; yaw = 0; pitch = 0.02; zoom = 1; panY = 0; sel = -1; range = null; S.layout = 0; ly.value = 0; closePrev(); drawTimeline(); save(); }; const expBtn = el('button', UI + 'margin-top:6px;width:100%;background:#22264a;border:1px solid #39407a;border-radius:5px;padding:4px;cursor:pointer', 'Save PNG (E)'); expBtn.onclick = () => exportPNG(); panel.append(reset, expBtn);
    gear.onclick = () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; };
    const card = el('div', UI + 'position:absolute;left:14px;bottom:' + cardB() + ';z-index:3;max-width:320px;background:rgba(22,18,44,.55);backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);border:1px solid rgba(160,140,255,.16);border-radius:12px;padding:10px 12px;display:none');
    function showCard(i) { const n = nodes[i]; live.textContent = n.name + ' · ' + (n.group || 'other') + ' · ' + deg[i] + ' links'; card.innerHTML = ''; card.style.bottom = cardB(); card.append(el('div', 'font-weight:600;margin-bottom:4px', n.name),
        el('div', 'opacity:.7', (n.group || 'other') + (n.region ? ' · ' + n.region : (PART_LABEL[n.kind] ? ' · ' + PART_LABEL[n.kind] : '')) + ' · ' + new Date(n.mtime || 0).toISOString().slice(0, 10)),
        el('div', 'opacity:.7', adj[i].length + ' links · path lit'));
      const b = el('button', UI + 'margin-top:6px;background:#2b3170;border:1px solid #4651a8;border-radius:5px;padding:3px 10px;cursor:pointer', 'Open note'); b.onclick = (e) => open(n, e.metaKey || e.ctrlKey);
      const x = el('button', UI + 'margin:6px 0 0 6px;background:transparent;border:1px solid #444;border-radius:5px;padding:3px 10px;cursor:pointer', 'Close'); x.onclick = () => { sel = -1; closePrev(); };
      card.append(b, x); card.style.display = opts.readText ? 'none' : 'block'; if (prevOn) showPrev(i); else { clearTimeout(prevT); prevT = setTimeout(() => { if (sel === i) showPrev(i); }, 320); } }   // delayed so a double-click on a node under the panel's spot still lands on the canvas
    // timeline: weekly stacked bars by group + day heatmap; drag to select a period, the body lights it
    const tl = el('div', 'position:absolute;left:0;right:0;bottom:' + INS + 'px;height:' + TLB + 'px;z-index:2;background:rgba(14,12,30,.6);border-top:1px solid rgba(160,140,255,.12);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:' + (S.timeline ? 'block' : 'none'));
    const tc = el('canvas', 'width:100%;height:100%;display:block;cursor:crosshair'); tl.append(tc);
    const now = data.now || Date.now(), oldest = Math.min(...nodes.map((n) => n.mtime || now)), WEEKS0 = Math.max(8, Math.min(26, Math.ceil((now - oldest) / (7 * 864e5)) + 1));
    const WK = 7 * 864e5, wkN = new Array(WEEKS0).fill(0); nodes.forEach((n) => { const i = Math.floor(((n.mtime || 0) - (now - WEEKS0 * WK)) / WK); if (i >= 0 && i < WEEKS0) wkN[i]++; });
    const skipW = Math.max(0, Math.min(WEEKS0 - 8, wkN.findIndex((c) => c >= 3)));   // the axis starts at the first week with real data (not fewer than 8 weeks)
    const WEEKS = WEEKS0 - skipW, t0 = now - WEEKS * 7 * 864e5;
    let tlDrag = null;
    function drawTimeline() { if (!S.timeline) return; const r = tc.getBoundingClientRect(); if (!r.width) return; const w = r.width, h = r.height; tc.width = w * dpr; tc.height = h * dpr;
      const g = tc.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); g.font = '10px -apple-system,sans-serif'; g.textBaseline = 'middle';
      const x0 = 70, x1 = w - 20, bw = (x1 - x0) / WEEKS, gs = groupNames.length, by = 52, bh = 34, sy = 56, sh = 16;
      const wk = Array.from({ length: WEEKS }, () => new Array(gs).fill(0)); const days = new Array(WEEKS * 7).fill(0), gc = groupNames.map((_, gi) => ((nodes.find((m) => m.gi === gi) || { rgb: [140, 150, 255] }).rgb).join(','));
      for (const n of nodes) { const d = Math.floor((n.mtime - t0) / 864e5); if (d < 0 || d >= WEEKS * 7) continue; wk[Math.floor(d / 7)][Math.max(0, n.gi)]++; days[d]++; }
      const mx = Math.max(1, ...wk.map((a) => a.reduce((s, v) => s + v, 0))), md = Math.max(1, ...days);
      g.fillStyle = 'rgba(220,215,255,.5)'; g.fillText('WEEKLY', 10, 24); g.fillText('ACTIVITY', 10, sy + sh / 2);
      wk.forEach((a, i) => { let y = by; const segs = a.map((v, gi) => [v, gi]).filter((q) => q[0]), x = x0 + i * bw + 1, sw = bw - 2;
        segs.forEach(([v, gi], si) => { const hh = Math.max(1, v / mx * bh - 1), top = y - hh; g.fillStyle = `rgba(${gc[gi]},.85)`;   // real group colour, 1 px gap between segments
          if (si === segs.length - 1 && g.roundRect) { g.beginPath(); g.roundRect(x, top, sw, hh, [3, 3, 0, 0]); g.fill(); } else g.fillRect(x, top, sw, hh); y = top - 1; });
        if (i === WEEKS - 1 && segs.length) { g.save(); g.globalCompositeOperation = 'lighter'; const gl2 = g.createRadialGradient(x + sw / 2, y, 0, x + sw / 2, y, 18); gl2.addColorStop(0, 'rgba(160,140,255,.45)'); gl2.addColorStop(1, 'rgba(160,140,255,0)'); g.fillStyle = gl2; g.fillRect(x - 18, y - 18, sw + 36, 36); g.restore(); g.fillStyle = 'rgba(240,236,255,.9)'; g.fillRect(x, y, sw, 1); } });
      const dw = bw / 7, dm = days.indexOf(md);   // activity: theme accent (violet to cyan) by value, one warm highlight for the busiest day
      days.forEach((v, d) => { if (!v) return; const q = v / md, hh = Math.max(2, q * sh); g.fillStyle = d === dm ? 'rgba(255,213,106,.95)' : `rgba(${lerp(123, 47, q) | 0},${lerp(92, 211, q) | 0},255,${0.35 + 0.65 * q})`; g.fillRect(x0 + d * dw, sy + sh - hh, Math.max(1, dw - 0.6), hh); });
      if (days[dm]) { const bx = x0 + dm * dw, right = bx + dw + 4 < w - 28; g.fillStyle = 'rgba(255,213,106,.95)'; g.textAlign = right ? 'left' : 'right'; g.fillText(days[dm], right ? bx + dw + 4 : bx - 4, sy + sh / 2); g.textAlign = 'left'; }
      g.fillStyle = 'rgba(220,215,255,.55)'; for (let i = WEEKS - 1; i >= 0; i -= 2) { const st = new Date(t0 + i * 7 * 864e5).toISOString().slice(5, 10), tw = g.measureText(st).width, cx = Math.min(x0 + i * bw + bw / 2, w - 8 - tw / 2); g.fillText(st, cx - tw / 2, 77); }
      if (range) { const a = x0 + (range[0] - t0) / (7 * 864e5) * bw, b = x0 + (range[1] - t0) / (7 * 864e5) * bw; g.fillStyle = 'rgba(160,140,255,0.12)'; g.fillRect(a, 8, b - a, h - 12); g.strokeStyle = 'rgba(160,140,255,.55)'; g.strokeRect(a, 8, b - a, h - 12); }
      tc._geo = { x0, bw }; }
    const tAt = (ev) => { const r = tc.getBoundingClientRect(), x = ev.clientX - r.left, gq = tc._geo; return t0 + Math.max(0, Math.min(WEEKS, (x - gq.x0) / gq.bw)) * 7 * 864e5; };
    tc.addEventListener('pointerdown', (ev) => { tlDrag = tAt(ev); range = [tlDrag, tlDrag + 864e5]; drawTimeline(); });
    tc.addEventListener('pointermove', (ev) => { if (tlDrag == null) return; const t = tAt(ev); range = [Math.min(tlDrag, t), Math.max(tlDrag, t) + 864e5]; drawTimeline(); });
    tc.addEventListener('pointerup', () => { tlDrag = null; });
    tc.addEventListener('dblclick', () => { range = null; drawTimeline(); });
    const search = el('input', UI + 'position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:3;width:min(320px,max(120px,calc(100% - 800px)));height:28px;box-sizing:border-box;background:rgba(22,18,44,.55);backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);border:1px solid rgba(160,140,255,.16);border-radius:14px;padding:0 14px;outline:none');
    search.className = 'neural-search'; const css = el('style', '', '.neural-search::placeholder{color:rgba(220,215,255,.58)}.neural-search:focus{box-shadow:0 0 0 2px rgba(123,92,255,.35)}.sn-b{transition:transform .2s cubic-bezier(.2,0,0,1),border-color .2s cubic-bezier(.2,0,0,1),background .2s cubic-bezier(.2,0,0,1),opacity .2s cubic-bezier(.2,0,0,1)}.sn-b:hover{transform:translateY(-1px);border-color:rgba(160,140,255,.35)!important}.sn-b:active{transform:scale(.97)}.sn-b:focus-visible{outline:2px solid rgba(160,140,255,.6);outline-offset:1px}canvas.sn-cv{outline:none}canvas.sn-cv:focus-visible{outline:2px solid rgba(160,140,255,.7);outline-offset:-2px}@media (prefers-reduced-motion:reduce){.sn-b{transition:none}.sn-b:hover,.sn-b:active{transform:none}}');
    search.placeholder = '🔍 Search notes (Enter: select, Esc: clear)';
    const runSearch = () => { query = orphF ? 'unlinked' : search.value.trim().toLocaleLowerCase('few'); matches = new Set();
      if (orphF) nodes.forEach((n, i) => { if (!deg[i]) matches.add(i); }); else if (query) nodes.forEach((n, i) => { if ((n.name + ' ' + (n.group || '') + ' ' + (n.lobe || '') + ' ' + (n.tags || []).map((t) => '#' + t).join(' ')).toLocaleLowerCase('few').includes(query)) matches.add(i); }); mList = [...matches]; mi = -1; };
    search.addEventListener('input', () => { orphF = false; runSearch(); });
    let mList = [], mi = -1;
    const go = (k) => { mi = (k + mList.length) % mList.length; const i = mList[mi]; sel = i; showCard(i); if (VIEWS[S.view].body) { fly = { i, z: Math.max(zoom, 2.2), t: 0 }; wake(); } flash = { i, t0: clock }; wake(); };
    search.addEventListener('keydown', (e) => { e.stopPropagation(); if (mList.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); go(mi + (e.key === 'ArrowDown' ? 1 : -1)); }
      if (e.key === 'Enter' && mList.length) go(mi < 0 ? 0 : mi);
      if (e.key === 'Escape') { search.value = ''; orphF = false; runSearch(); search.blur(); } });
    const lcol = el('div', UI + 'position:absolute;left:12px;top:34px;z-index:3;display:flex;flex-direction:column;align-items:stretch;gap:8px;width:292px;box-sizing:border-box;padding:10px;border-radius:12px;font-size:11px;max-height:calc(100% - 110px);overflow:auto;background:rgba(22,18,44,.55);backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);border:1px solid rgba(160,140,255,.16);');
    const BTN = 'font:inherit;color:#e8eaff;border-radius:11px;height:22px;padding:0 10px;cursor:pointer;border:1px solid rgba(160,140,255,.2);background:rgba(255,255,255,.05)', CHIP = 'font:inherit;font-size:11px;color:#e8eaff;border-radius:11px;height:22px;box-sizing:border-box;padding:0 9px;cursor:pointer;display:flex;align-items:center;gap:5px;min-width:0;overflow:hidden;white-space:nowrap;text-align:left;transition:background .2s cubic-bezier(.2,0,0,1),opacity .2s cubic-bezier(.2,0,0,1),transform .2s cubic-bezier(.2,0,0,1),border-color .2s cubic-bezier(.2,0,0,1)';
    const stat = el('div', 'display:flex;gap:8px;align-items:center;flex-wrap:wrap'), orphBtn = el('button', BTN, 'Unlinked: ' + nOrph); orphBtn.title = 'Notes with no links';
    orphBtn.onclick = () => { orphF = !orphF; search.value = orphF ? 'Unlinked' : ''; runSearch(); wake(); }; stat.append(orphBtn);
    const todayBtn = el('button', BTN, 'Today'); todayBtn.title = 'Only notes changed today (T)'; todayBtn.onclick = () => toggleToday(); const statBtn = el('button', BTN, 'Statistics'); statBtn.title = 'Statistics panel (S)'; statBtn.onclick = () => toggleStats(); const brkBtn = el('button', BTN, 'Broken: 0'); brkBtn.title = 'Unresolved links (broken synapses)'; brkBtn.onclick = () => toggleBroken(); if (!opts.unresolved) brkBtn.style.display = 'none'; stat.append(todayBtn, statBtn, brkBtn);
    if (opts.agentToday) stat.append(el('span', 'opacity:.85', 'Agent today: ' + agentSet.size + ' notes'));
    const chips = el('div', 'display:grid;grid-template-columns:1fr 1fr;gap:6px');
    const chipEls = []; const gcol = (g) => { const n = nodes.find((m) => m.group === g.name); return n ? n.rgb : hexToRgb(g.color); };
    const chip = (name, count, g) => { const b = el('button', CHIP + (g ? '' : ';grid-column:1/-1;justify-content:center')), dot = el('span', 'flex:none;width:7px;height:7px;border-radius:50%;display:' + (g ? 'inline-block' : 'none')); b.append(dot, el('span', 'overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;text-align:' + (g ? 'left' : 'center'))); b.children[1].textContent = name.replace(/^[^\p{L}\p{N}]+/u, ''); b.title = name + (count != null ? ' · ' + count : ''); if (count != null) b.append(el('span', 'flex:none;opacity:.6;margin-left:auto', String(count)));
      b.onclick = () => { if (!g) areaSet.clear(); else areaSet.has(name) ? areaSet.delete(name) : areaSet.add(name); S.areas = [...areaSet]; save(); paintChips(); }; chipEls.push([b, g ? name : null, dot, g]); chips.append(b); };
    chip('All'); for (const g of data.groups || []) chip(g.name, g.count, g);
    function paintChips() { for (const [b, name, dot, g] of chipEls) { const on = name == null ? !areaSet.size : areaSet.has(name); b.style.background = on ? 'rgba(123,92,255,.28)' : 'rgba(255,255,255,.04)'; b.style.borderColor = on ? 'rgba(160,140,255,.55)' : 'rgba(255,255,255,.1)'; b.style.boxShadow = on ? 'inset 0 0 7px rgba(123,92,255,.5)' : 'none'; b.style.opacity = on ? 1 : 0.6; b.setAttribute('aria-pressed', on); if (g) dot.style.background = `rgb(${gcol(g).join(',')})`; } paintCmp(); } paintChips();
    const lbody = el('div', 'display:flex;flex-direction:column;gap:8px'); lbody.append(stat, chips);
    const thr = opts.threads || [];
    if (thr.length) { const tb = el('button', BTN, ''), tl2 = el('div', 'display:none;flex-direction:column;gap:2px;padding:4px 6px;background:rgba(255,255,255,.04);border:1px solid rgba(160,140,255,.12);border-radius:8px'); let o = false;
      const paintT = () => { tb.textContent = 'Open threads: ' + thr.length + (o ? ' ▾' : ' ▸'); tl2.style.display = o ? 'flex' : 'none'; }; tb.onclick = () => { o = !o; thrOn = o; paintT(); wake(); }; paintT();
      thr.forEach((t) => { const a = el('button', 'font:inherit;color:#c9cfff;background:none;border:0;padding:0;text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'); a.textContent = t.title; a.title = t.title; a.onclick = () => frameThread(t); tl2.append(a); }); const ta = el('button', 'font:inherit;color:#8f78ff;background:none;border:0;padding:0;text-align:left;cursor:pointer', 'Open Threads.md ↗'); ta.onclick = () => opts.onOpen && opts.onOpen({ path: opts.threadsPath }, false); tl2.append(ta);
      lbody.append(tb, tl2); }
    const brkList = el('div', 'display:none;flex-direction:column;gap:1px;padding:4px 6px;max-height:160px;overflow:auto;background:rgba(255,255,255,.04);border:1px solid rgba(240,92,160,.25);border-radius:8px'); lbody.append(brkList);
    // v9: segmented view row, help button, range / today pills, help overlay
    const GLASS = 'background:rgba(22,18,44,.55);backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);border:1px solid rgba(160,140,255,.16)';
    const seg = el('div', UI + 'position:absolute;top:10px;right:160px;z-index:3;height:28px;box-sizing:border-box;display:flex;align-items:stretch;padding:0 4px;gap:2px;border-radius:14px;' + GLASS); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'View'); const segB = {}; const seg2 = el('div', UI + 'position:absolute;top:44px;right:160px;z-index:3;height:28px;box-sizing:border-box;display:flex;align-items:stretch;padding:0 4px;gap:2px;border-radius:14px;' + GLASS); seg2.setAttribute('role', 'group'); seg2.setAttribute('aria-label', 'View (Shift)');
    const CLUS = [['Body views', ['Body', 'Brainstem', 'Heat body', 'Spinal section', 'Neuron', '3D brain', 'Reflex arc'], seg], ['Time', ['Matrix', 'Time river', 'Sundial', 'Wave'], seg], ['Diagrams', ['Ring', 'Cortex map', 'Constellation map', 'Ego radial', 'Synapse network', 'Dendrite tree', 'Coral'], seg2]];
    const clusEl = {}; CLUS.forEach(([lab, , row]) => { if (row.childNodes.length) row.append(el('span', 'width:1px;height:16px;margin:0 3.5px;flex:none;align-self:center;background:rgba(160,140,255,.28)')); const d = el('div', 'display:flex;align-items:stretch;gap:2px'); d.setAttribute('role', 'group'); d.setAttribute('aria-label', lab); d.title = lab; clusEl[lab] = d; row.append(d); });
    Object.keys(VIEWS).forEach((nm, i) => { const b = el('button', 'font:inherit;color:#e8eaff;width:28px;padding:0;box-shadow:none;background:none;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:6px', VIEWS[nm].icon); b.title = nm + (i < 10 ? ' (' + (i + 1) + ')' : ' (Shift+' + (i - 9) + ')'); b.setAttribute('aria-label', nm); b.onclick = () => switchView(nm); segB[nm] = b; clusEl[CLUS.find((c) => c[1].includes(nm))[0]].append(b); });
    function paintSeg() { for (const nm in segB) { const on = nm === S.view; segB[nm].style.opacity = on ? 1 : 0.55; segB[nm].style.boxShadow = on ? 'inset 0 -2px 0 #8f78ff' : 'none'; segB[nm].setAttribute('aria-pressed', on); } viewSel.value = S.view; try { paintCtl(); } catch (e) {} } paintSeg();
    const helpBtn = el('button', UI + 'width:28px;height:28px;border-radius:14px;cursor:pointer;padding:0;' + GLASS, '?'); helpBtn.title = 'Help and keys (?)'; helpBtn.setAttribute('aria-label', 'Help'); helpBtn.onclick = () => toggleHelp();
    const tools = el('div', 'position:absolute;top:10px;right:12px;z-index:3;display:flex;align-items:center;gap:8px'); tools.setAttribute('role', 'group'); tools.setAttribute('aria-label', 'Tools'); tools.title = 'Tools'; tools.append(helpBtn, gear);
    const sepTb = el('span', 'position:absolute;top:16px;right:151px;z-index:3;width:1px;height:16px;background:rgba(160,140,255,.28);pointer-events:none');
    const pills = el('div', 'position:absolute;top:44px;left:50%;transform:translateX(-50%);z-index:3;display:flex;gap:6px;pointer-events:none;white-space:nowrap');
    const PILL = UI + 'font-size:11px;height:22px;box-sizing:border-box;padding:0 10px;border-radius:11px;align-items:center;gap:6px;background:rgba(22,18,44,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(160,140,255,.3);pointer-events:auto;display:none';
    const rPill = el('div', PILL), tPill = el('div', PILL), rX = el('button', 'font:inherit;color:inherit;background:none;border:0;padding:0 0 0 2px;cursor:pointer;opacity:.7', '×'); rX.title = 'Clear period filter'; rX.setAttribute('aria-label', 'Clear period filter');
    rX.onclick = () => { range = null; drawTimeline(); }; rPill.append(el('span'), rX); pills.append(rPill, tPill);
    const fmt = (t) => new Date(t).toISOString().slice(5, 10); let pillKey = '';
    function paintPills() { const k = (range ? range.join() : '') + '|' + todayOn; if (k === pillKey) return; pillKey = k;
      rPill.style.display = range ? 'flex' : 'none'; if (range) { const a = fmt(range[0]), b = fmt(range[1] - 1); rPill.firstChild.textContent = (a === b ? a : a + ' → ' + b) + ' · ' + nodes.filter(inRng).length + ' notes'; }
      tPill.style.display = todayOn ? 'flex' : 'none'; if (todayOn) tPill.textContent = 'Today: ' + nToday + ' notes, ' + agentSet.size + ' agent';
      todayBtn.setAttribute('aria-pressed', todayOn); todayBtn.style.background = todayOn ? 'rgba(123,92,255,.35)' : 'rgba(255,255,255,.05)'; }
    function toggleToday() { todayOn = !todayOn; if (todayOn) calcToday(); paintPills(); wake(); }
    const help = el('div', UI + 'position:absolute;inset:0;z-index:5;display:none;align-items:center;justify-content:center;background:rgba(5,4,14,.45);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)'); help.setAttribute('role', 'dialog'); help.setAttribute('aria-label', 'Help');
    const hcard = el('div', 'width:min(540px,calc(100% - 32px));max-height:82%;overflow:auto;box-sizing:border-box;padding:16px 20px;border-radius:14px;line-height:1.7;background:rgba(22,18,44,.88);border:1px solid rgba(160,140,255,.25);box-shadow:0 12px 50px rgba(0,0,0,.5)'); help.append(hcard);
    let helpOpen = false; help.onclick = (e) => { if (e.target === help) toggleHelp(false); };
    function toggleHelp(f) { helpOpen = f == null ? !helpOpen : f; help.style.display = helpOpen ? 'flex' : 'none'; if (!helpOpen) return;
      const dim = (t) => '<span style="opacity:.65">' + t + '</span>', kb = (k, t) => '<div style="display:flex;gap:10px"><b style="min-width:74px;font-weight:600;color:#c9bfff">' + k + '</b>' + dim(t) + '</div>';
      const grp = (data.groups || []).map((g) => '<span style="display:inline-flex;align-items:center;gap:5px;margin:0 12px 2px 0"><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:rgb(' + gcol(g).join(',') + ')"></i>' + (g.name || 'other') + ' ' + dim(g.count) + '</span>').join('');
      hcard.innerHTML = '<div style="font-weight:600;font-size:14px;margin-bottom:8px">Help</div><div style="opacity:.6;font-size:10px;letter-spacing:.08em">SYMBOLS</div>'
        + '<div>Colour ' + dim('= area (folder)') + '</div><div>Size ' + dim('= link count') + '</div><div>Brightness ' + dim('= recency (warm halo for the last 7 days)') + '</div><div>Open ring ' + dim('= unlinked note') + '</div><div>Yellow diamond ' + dim('= touched by an agent today') + '</div><div>Short broken line + × ' + dim('= unresolved link') + '</div><div>Rotating dotted ring ' + dim('= note in an open thread') + '</div><div>Double slow-turning ring ' + dim('= hub (top 2% most linked)') + '</div><div>Calm mode ' + dim('= static, high contrast, area = shape') + '</div>'
        + '<div style="margin:6px 0 0">' + grp + '</div><div style="opacity:.6;font-size:10px;letter-spacing:.08em;margin-top:10px">KEYS</div>'
        + kb('1 – 9, 0', 'change view (' + Object.keys(VIEWS).slice(0, 10).join(', ') + ')') + kb('Shift 1 – 8', Object.keys(VIEWS).slice(10).join(', ')) + kb('Tab', 'move selection to the next note (Shift+Tab: back)') + kb('Shift+click', 'path: A, then B (P: set selected note as A/B, N: next path)') + kb('G', 'tour of hubs (any touch stops it)') + kb('L', 'tag layer') + kb('M', 'sound (off)') + kb('Backspace', 'Neuron: previous soma') + kb('[  ]', 'previous / next view') + kb('/', 'search') + kb('← ↑ → ↓', 'jump to the nearest note') + kb('Enter', 'open note (Ctrl/Cmd: new tab)') + kb('Esc', 'clear selection and period') + kb('T', 'today mode') + kb('S', 'statistics panel') + kb('E', 'save PNG (assets/neural/)') + kb('C', 'hide / show the areas panel') + kb('Ctrl 1–5', 'save view to bookmark') + kb('Alt 1–5', 'open bookmark') + kb('F', 'fit to screen') + kb('?', 'this window')
        + '<div style="margin-top:10px">' + dim('Drag on the timeline: select a period, double-click: reset.') + '</div>'; }
    // ---- v9 batch 2 DOM: collapsible chip panel, preview (11), stats (16), broken list (17), export (21), bookmarks (20), view controls ----
    const clrBtn = el('button', UI + BTN + ';position:absolute;z-index:3;display:none;transform:translateX(-50%);height:28px;padding:0 16px', 'Clear filter'); clrBtn.setAttribute('aria-label', 'Clear filter'); let clrOn = false;
    const showClr = (on, x, y) => { if (on) { clrBtn.style.left = Math.round(x) + 'px'; clrBtn.style.top = Math.round(y) + 'px'; } if (on !== clrOn) { clrOn = on; clrBtn.style.display = on ? 'block' : 'none'; } };
    clrBtn.onclick = () => { areaSet = new Set(); S.areas = []; save(); paintChips(); search.value = ''; orphF = false; runSearch(); range = null; if (todayOn) toggleToday(); drawTimeline(); wake(); };
    const toastEl = el('div', UI + 'position:absolute;left:50%;bottom:' + (INS + 56) + 'px;transform:translateX(-50%);z-index:6;padding:6px 14px;border-radius:14px;opacity:0;pointer-events:none;transition:opacity .2s cubic-bezier(.2,0,0,1);max-width:80%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' + GLASS); let toastT = 0;
    function toast(m) { toastEl.textContent = m; toastEl.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.opacity = 0; }, 2400); }
    const dotEl = (c) => { const i = el('i', 'display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;flex:none;background:rgb(' + c.join(',') + ')'); return i; };
    const ROW = 'display:flex;align-items:center;width:100%;font:inherit;color:#c9cfff;background:none;border:0;padding:1px 0;text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden';
    const prev = el('div', UI + 'position:absolute;top:80px;right:12px;z-index:3;width:280px;max-height:calc(100% - ' + (TLB + INS + 102) + 'px);overflow:auto;box-sizing:border-box;padding:12px 16px;border-radius:8px;line-height:1.35;font-variant-numeric:tabular-nums;box-shadow:0 4px 16px rgba(0,0,0,.24);opacity:0;visibility:hidden;transform:translateX(8px);transform-origin:100% 0;transition:transform .2s cubic-bezier(.2,0,0,1),opacity .2s cubic-bezier(.2,0,0,1),visibility .2s;' + GLASS); prev.setAttribute('role', 'complementary'); prev.setAttribute('aria-label', 'Note preview');
    let prevTok = 0, prevOn = false, prevT = 0, selT = 0;
    const rowBtn = (j, extra) => { const b = el('button', ROW), s = el('span', 'overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;text-align:left'); s.textContent = nodes[j].name; b.append(dotEl(nodes[j].rgb), s); if (extra != null) b.append(el('span', 'flex:none;opacity:.6;margin-left:8px', String(extra))); b.onclick = () => selectNode(j); return b; };
    function rowsOf(title, list) { const box = el('div', 'margin-top:8px'); box.append(el('div', 'opacity:.6;font-size:10px;letter-spacing:.08em;margin-bottom:2px', title + ' (' + list.length + ')')); if (!list.length) box.append(el('div', 'opacity:.5', '—'));
      list.slice(0, 8).forEach((j) => box.append(rowBtn(j))); if (list.length > 8) box.append(el('div', 'opacity:.55', '+' + (list.length - 8) + '  more')); return box; }
    function showPrev(i) { if (!opts.readText) return; const n = nodes[i], tok = ++prevTok; prev.innerHTML = '';
      const hd2 = el('div', 'display:flex;align-items:flex-start;gap:8px'), t = el('div', 'font-weight:600;font-size:12px;flex:1;min-width:0;word-break:break-word'), x = el('button', 'font:inherit;color:inherit;padding:0 4px;box-shadow:none;background:none;border:0;cursor:pointer;opacity:.7;font-size:14px;line-height:1', '×');
      t.textContent = n.name; x.setAttribute('aria-label', 'Close'); x.onclick = () => { sel = -1; closePrev(); }; hd2.append(t, x);
      const meta = el('div', 'display:flex;align-items:center;flex-wrap:wrap;gap:2px 12px;margin-top:4px;opacity:.75;font-size:11px'), g = el('span', 'display:inline-flex;align-items:center'), a = ageD(n); g.append(dotEl(n.rgb), document.createTextNode(n.group || 'other'));
      const s2 = el('span'); s2.textContent = a < 1 ? 'today' : Math.round(a) + ' days ago'; const s3 = el('span'); s3.textContent = deg[i] + ' links'; meta.append(g, s2, s3);
      const tx = el('div', 'margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.05);font-size:11px;opacity:.85;white-space:pre-wrap;word-break:break-word', '…');
      Promise.resolve().then(() => opts.readText(n.path)).then((s) => { if (tok !== prevTok) return; const body = String(s || '').replace(/^---\r?\n[\s\S]*?\r?\n---\s*(\r?\n|$)/, ''), ls = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6).map((l) => l.length > 140 ? l.slice(0, 139) + '…' : l); tx.textContent = ls.length ? ls.join('\n') : '(empty note)'; })
        .catch(() => { if (tok === prevTok) tx.textContent = '(text could not be read)'; });
      const ob = el('button', UI + 'margin-top:10px;background:#2b3170;border:1px solid #4651a8;border-radius:5px;padding:3px 12px;cursor:pointer', 'Open'); ob.onclick = (e) => open(n, e.metaKey || e.ctrlKey);
      const pb = el('button', UI + 'margin:10px 0 0 8px;background:#3a2748;border:1px solid #a04a78;border-radius:5px;padding:3px 12px;cursor:pointer', 'Yol (P)'); pb.title = 'A / B point: shortest path between two notes'; pb.onclick = () => setPathPt(i);
      prev.append(hd2, meta, tx, rowsOf('Backlinks', inA[i]), rowsOf('Outgoing links', outA[i]), sugRows(i), ob, pb);
      prevOn = true; { const q = lastPP && lastPP[i], rc = prev.getBoundingClientRect(), cr = canvas.getBoundingClientRect(); if (q && rc.width) prev.style.transformOrigin = cl01((q[0] + cr.left - rc.left) / rc.width) * 100 + '% ' + cl01((q[1] + cr.top - rc.top) / rc.height) * 100 + '%'; prev.style.transitionDuration = calm() ? '0s' : ''; }
      prev.style.visibility = 'visible'; prev.style.opacity = 1; prev.style.transform = 'scale(1)'; }
    function closePrev() { card.style.display = 'none'; prevTok++; prevOn = false; clearTimeout(prevT); prev.style.opacity = 0; prev.style.transform = 'scale(.92)'; prev.style.visibility = 'hidden'; }
    function selectNode(j) { sel = j; showCard(j); flash = { i: j, t0: clock }; wake(); }
    // stats panel
    const stats = el('div', 'box-sizing:border-box;padding:8px 10px;border-radius:10px;line-height:1.6;font-size:11px;display:none;background:rgba(255,255,255,.04);border:1px solid rgba(160,140,255,.12)'); lbody.append(stats); let statsOpen = false, statsFold = false;
    const med = (a) => { if (!a.length) return 0; a = a.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
    function buildStats() { stats.innerHTML = ''; const hd2 = el('button', UI + 'display:flex;width:100%;justify-content:space-between;background:none;border:0;padding:0;cursor:pointer;font-size:10px;letter-spacing:.08em;opacity:.8', '<span>STATISTICS</span><span>' + (statsFold ? '▸' : '▾') + '</span>'); hd2.onclick = () => { statsFold = !statsFold; buildStats(); }; stats.append(hd2); if (statsFold) return;
      const L = (a, b) => { const r = el('div', 'display:flex;justify-content:space-between;gap:8px'); r.append(el('span', 'opacity:.7', a)); r.append(el('span', '', b)); return r; };
      const dens = groupNames.map((_, gi) => [gi, links.filter((l) => nodes[l[0]].gi === gi).length / Math.max(1, gCount[gi])]).sort((a, b) => b[1] - a[1]), stale = groupNames.map((_, gi) => [gi, med(nodes.filter((n) => n.gi === gi).map(ageD))]).sort((a, b) => b[1] - a[1])[0];
      stats.append(L('Notes', String(nodes.length)), L('Links', String(links.length)), L('Unlinked', String(nOrph)), L('Oldest area', stale ? gName(stale[0]) + ' · ' + Math.round(stale[1]) + ' days' : '—'));
      const days = new Array(30).fill(0); nodes.forEach((n) => { const d = 29 - Math.floor((NOW0 - (n.mtime || 0)) / DAY); if (d >= 0 && d < 30) days[d]++; }); const cv = el('canvas', 'width:120px;height:24px;display:block;margin:4px 0'); cv.width = 240; cv.height = 48; const g = cv.getContext('2d'), mx = Math.max(1, ...days);
      const grd = g.createLinearGradient(0, 0, 240, 0); grd.addColorStop(0, '#7b5cff'); grd.addColorStop(1, '#2fd3ff'); g.fillStyle = grd; days.forEach((v, d) => { const h = Math.max(1, v / mx * 44); g.fillRect(d * 8, 48 - h, 6, h); });
      stats.append(el('div', 'opacity:.6;font-size:10px;letter-spacing:.08em;margin-top:6px', 'LAST 30 DAYS · notes changed per day (max ' + mx + ')'), cv, el('div', 'opacity:.6;font-size:10px;letter-spacing:.08em;margin-top:4px', 'TOP 10 MOST LINKED'));
      deg.map((d, i) => i).filter((i) => nodes[i].kind !== 'spine').sort((a, b) => deg[b] - deg[a]).slice(0, 10).forEach((i) => stats.append(rowBtn(i, deg[i])));
      stats.append(el('div', 'opacity:.6;font-size:10px;letter-spacing:.08em;margin-top:6px', 'AREA DENSITY (links / note)')); dens.slice(0, 8).forEach(([gi, d]) => stats.append(L(gName(gi), d.toFixed(2)))); }
    function toggleStats(f) { if (!cOpen && f !== false) { relayout(); cOpen = true; if (VIEWS[S.view].body) { S.chips = true; save(); } paintLcol(); } statsOpen = f == null ? !statsOpen : f; stats.style.display = statsOpen ? 'block' : 'none'; statBtn.setAttribute('aria-pressed', statsOpen); statBtn.style.background = statsOpen ? 'rgba(123,92,255,.35)' : 'rgba(255,255,255,.05)'; if (statsOpen) buildStats(); }
    // broken synapses
    function setUnresolved(u) { broken = new Map(); nBroken = 0; for (const p in (u || {})) { const i = pidx.get(p); if (i == null) continue; const t = Object.keys(u[p]); if (!t.length) continue; broken.set(i, t); nBroken += t.length; } paintBroken(); wake(); }
    function paintBroken() { brkBtn.textContent = 'Broken: ' + nBroken; brkList.innerHTML = ''; let k = 0; for (const [i, ts] of broken) for (const t of ts) { if (k++ >= 80) break; const b = el('button', ROW); b.append(dotEl([240, 92, 160]));
        const s = el('span', 'overflow:hidden;text-overflow:ellipsis'); s.textContent = nodes[i].name + ' → ' + t; b.title = nodes[i].path + ' → [[' + t + ']]'; b.append(s); b.onclick = () => { selectNode(i); open(nodes[i], false); }; brkList.append(b); }
      if (!nBroken) brkList.append(el('div', 'opacity:.6', 'No broken links')); }
    let brkOpen = false; function toggleBroken() { brkOpen = !brkOpen; brkList.style.display = brkOpen ? 'flex' : 'none'; brkBtn.setAttribute('aria-pressed', brkOpen); brkBtn.style.background = brkOpen ? 'rgba(240,92,160,.3)' : 'rgba(255,255,255,.05)'; wake(); }
    // threads: frame the notes of one open thread
    function frameThread(t) { const ids = idxs(t.paths); if (!ids.size) { toast('No note found for this thread'); return; } thrOn = true; query = 'thread'; matches = ids; mList = [...ids]; mi = 0; search.value = ''; if (VIEWS[S.view].body) fly = { i: mList[0], z: 1.8, t: 0 }; else { flash = { i: mList[0], t0: clock }; } wake(); }
    // export PNG at 2x, no UI, small footer; the wrapper writes it into assets/neural/
    async function exportPNG() { if (!opts.saveBlob) { toast('PNG not saved: unavailable here'); return; }
      const od = dpr; dpr = od * 2; canvas.width = W * dpr; canvas.height = H * dpr; draw(last); const g = ctx0; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalCompositeOperation = 'source-over'; g.font = '11px -apple-system,sans-serif'; g.textBaseline = 'middle'; g.fillStyle = S.day ? 'rgba(30,30,45,.7)' : 'rgba(235,238,255,.7)';
      g.fillText((opts.vaultName || 'vault') + ' · Neural System · ' + S.view + ' · ' + new Date().toISOString().slice(0, 10) + ' · ' + nodes.length + ' notes · ' + links.length + ' links', 14, H - 10);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png')); resize(); draw(last); wake(); if (!blob) { toast('PNG failed'); return; }
      const name = 'neural-' + S.view.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-') + '-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.png';
      try { const p = await opts.saveBlob(await blob.arrayBuffer(), name); toast('Saved: ' + p); return p; } catch (e) { toast('Save failed: ' + (e && e.message || e)); } }
    // saved view bookmarks (20): Ctrl+1..5 save, Alt+1..5 restore (600 ms camera tween), stored in the existing localStorage state
    function bmSave(k) { S.bm = S.bm || {}; S.bm[k] = { view: S.view, zoom, panX, panY, areas: [...areaSet], sel: sel >= 0 ? nodes[sel].path : null, range, depth: S.depth, heat: S.heat }; save(); toast('Bookmark ' + k + ' saved · ' + S.view); }
    function bmGo(k) { const b = S.bm && S.bm[k]; if (!b) { toast('Bookmark ' + k + ' is empty (Ctrl+' + k + ' to save)'); return; } fly = null; if (VIEWS[b.view]) switchView(b.view); areaSet = new Set(b.areas || []); S.areas = [...areaSet]; paintChips(); range = b.range || null; drawTimeline();
      S.depth = b.depth || 2; depthSl.value = S.depth; S.heat = b.heat || 0; save(); paintCtl(); const i = b.sel ? pidx.get(b.sel) : undefined; if (i != null) selectNode(i); else { sel = -1; closePrev(); }
      if (REDUCE) { zoom = b.zoom; panX = b.panX; panY = b.panY; } else camTw = { t: 0, z0: zoom, x0: panX, y0: panY, z1: b.zoom, x1: b.panX, y1: b.panY }; wake(); toast('Bookmark ' + k + ' opened'); }
    // collapsible chip panel (state remembered for the body views; other views start collapsed)
    function relayout() { const V = VIEWS[S.view]; if (V.body || REDUCE || !V.dots) return; vFrom = shownPos().map((q) => [q[0], q[1]]); vtT = 0; vE = 0; vRel = true; wake(); }
    const hdB = el('button', 'font:inherit;font-size:10px;letter-spacing:.08em;color:#e8eaff;opacity:.8;background:none;border:0;cursor:pointer;display:block;text-align:left;padding:0;height:14px;line-height:14px'); hdB.onclick = () => { relayout(); cOpen = !cOpen; if (VIEWS[S.view].body) { S.chips = cOpen; save(); } paintLcol(); wake(); };
    function paintLcol() { lcol.style.width = cOpen ? '292px' : '30px'; lcol.style.padding = cOpen ? '10px' : '6px 7px'; lbody.style.display = cOpen ? 'flex' : 'none'; hdB.textContent = cOpen ? 'AREAS  ‹' : '›'; hdB.title = cOpen ? 'Hide panel (C)' : 'Show areas panel (C)'; hdB.setAttribute('aria-expanded', cOpen); }
    // view-specific controls: heat metric (8), ego depth (9)
    const SMALL = 'font:inherit;color:#e8eaff;border-radius:9px;height:18px;padding:0 8px;cursor:pointer;border:1px solid rgba(160,140,255,.2);background:rgba(255,255,255,.05)';
    const heatBar = el('div', PILL), heatB = ['Recency', 'Link count', 'Agent today'].map((t, k) => { const b = el('button', SMALL, t); b.onclick = () => { S.heat = k; save(); paintCtl(); wake(); }; return b; }); heatBar.append(el('span', 'opacity:.65', 'Metric:'), ...heatB);
    const depthBar = el('div', PILL), depthSl = el('input', 'width:90px'), depthV = el('span', 'min-width:10px'); depthSl.type = 'range'; depthSl.min = 1; depthSl.max = 3; depthSl.step = 1; depthSl.value = S.depth; depthSl.setAttribute('aria-label', 'Depth');
    depthSl.oninput = () => { relayout(); S.depth = +depthSl.value; save(); paintCtl(); wake(); }; depthBar.append(el('span', 'opacity:.65', 'Depth'), depthSl, depthV);
    function paintCtl() { heatBar.style.display = S.view === 'Heat body' ? 'flex' : 'none'; depthBar.style.display = S.view === 'Ego radial' ? 'flex' : 'none'; depthV.textContent = S.depth; heatB.forEach((b, k) => { b.style.background = S.heat === k ? 'rgba(123,92,255,.4)' : 'rgba(255,255,255,.05)'; }); }
    pills.append(heatBar, depthBar); paintCtl();
    lcol.append(hdB, lbody); paintLcol(); setUnresolved(opts.unresolved);
    // v9 batch 3 DOM: compare box, tag row, path pill, tool buttons (tags / tour / sound) in the second view row
    cmpEl = el('div', UI + 'position:absolute;left:50%;transform:translateX(-50%);z-index:3;display:none;padding:10px 14px;border-radius:14px;line-height:1.5;max-width:min(640px,calc(100% - 380px));' + GLASS); paintCmp();
    pathPillEl = el('div', PILL); { const pX = el('button', 'font:inherit;color:inherit;background:none;border:0;padding:0 0 0 2px;cursor:pointer;opacity:.7', '×'); pX.title = 'Clear path (P)'; pX.setAttribute('aria-label', 'Clear path'); pX.onclick = () => clearPath(); pathPillEl.append(el('span'), pX); pills.append(pathPillEl); }
    const tagCnt = new Map(); nodes.forEach((n) => (n.tags || []).forEach((t) => tagCnt.set(t, (tagCnt.get(t) || 0) + 1)));
    const tagRow = el('div', UI + 'position:absolute;top:76px;left:50%;transform:translateX(-50%);z-index:3;display:none;flex-wrap:wrap;justify-content:center;gap:5px;max-width:50%;pointer-events:none');
    function paintTags() { tagRow.innerHTML = ''; tagRow.style.display = S.tags ? 'flex' : 'none'; if (!S.tags) return; const top = [...tagCnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
      if (!top.length) { tagRow.append(el('span', BTN + ';line-height:20px', 'no tags found')); return; }
      top.forEach(([t, c]) => { const b = el('button', BTN + ';pointer-events:auto;height:20px;font-size:11px;padding:0 8px;background:' + (search.value === '#' + t ? 'rgba(123,92,255,.4)' : 'rgba(22,18,44,.72)')); b.textContent = '#' + t + ' ' + c; b.onclick = () => { search.value = search.value === '#' + t ? '' : '#' + t; orphF = false; runSearch(); paintTags(); wake(); }; tagRow.append(b); }); }
    function toggleTags(f) { S.tags = f == null ? !S.tags : f; save(); paintTags(); paintTools(); }
    const tbtn = (icon, title, f) => { const b = el('button', 'font:inherit;color:#e8eaff;width:28px;padding:0;box-shadow:none;background:none;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:6px', icon); b.title = title; b.setAttribute('aria-label', title); b.onclick = f; return b; };
    const tagB = tbtn(SVG('<path d="M6 2L5 14M11 2l-1 12M2.5 6h11M2 10.5h11"/>'), 'Tag layer (L)', () => toggleTags()), tourB = tbtn(SVG('<path d="M5 3l8 5-8 5z"/>'), 'Tour of hubs (G) · any touch stops it', () => tourToggle()),
      sndB = tbtn(SVG('<path d="M2.5 6v4h2.5l3.5 3V3L5 6z"/><path d="M11 5.5c1.2 1.3 1.2 3.7 0 5"/>'), 'Sound: tick when a new note is born (M)', () => toggleSound());
    seg2.append(el('i', 'width:1px;background:rgba(160,140,255,.25);margin:5px 3px'), tagB, tourB, sndB);
    function paintTools() { for (const [b, on] of [[tagB, !!S.tags], [tourB, tourOn], [sndB, !!S.sound]]) { b.style.opacity = on ? 1 : 0.55; b.style.boxShadow = on ? 'inset 0 -2px 0 #8f78ff' : 'none'; b.setAttribute('aria-pressed', on); } }
    function toggleSound() { S.sound = !S.sound; save(); paintTools(); toast(S.sound ? 'Sound on' : 'Sound off'); if (S.sound) beep(); }
    paintTools(); paintTags();
    const live = el('div', 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)'); live.setAttribute('aria-live', 'polite'); host.append(live);
    host.append(tools, sepTb, panel, card, prev, tl, search, lcol, css, seg, seg2, pills, tagRow, cmpEl, help, clrBtn, toastEl);
    // ---- interaction on the body ----
    let drag = null;
    const pick = (mx, my) => { let best = -1, bd = 144;
      { const V = VIEWS[S.view]; if (V.hit) return V.hit(mx, my); }
      if (!lastPP) return best; if (gridFor !== lastPP) { grid.clear(); lastPP.forEach((q, i) => { const k = (q[0] / 24 | 0) * 4096 + (q[1] / 24 | 0); (grid.get(k) || grid.set(k, []).get(k)).push(i); }); gridFor = lastPP; }
      const cx = mx / 24 | 0, cy = my / 24 | 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const i of grid.get((cx + a) * 4096 + cy + b) || []) { if (!vis(nodes[i])) continue; const q = lastPP[i], d = (q[0] - mx) ** 2 + (q[1] - my) ** 2; if (d < bd) { bd = d; best = i; } } return best; };
    const grid = new Map(); let gridFor = null;
    const vis = (n) => S.notes && (S.record || n.kind !== 'spine') && (S.stale || !n.stale);
    const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const touches = new Map(); let pinch = null;
    const onDown = (e) => { touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: zoom, y: (a[1] + b[1]) / 2, pan: panY }; drag = null; return; }
      tourStop(); fly = null; lastIn = performance.now(); camE = 0; inr.on = false; drag = { lt: 0, lcx: e.clientX, lcy: e.clientY, vx: 0, vy: 0, x: e.clientX, y: e.clientY, yaw, pitch, moved: false, lx: local(e)[0], ly: local(e)[1] }; };
    const onMove = (e) => { if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && touches.size === 2) { const [a, b] = [...touches.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        zoomT = null; zoom = Math.max(0.5, Math.min(6, pinch.z * d / Math.max(1, pinch.d))); panY = pinch.pan + ((a[1] + b[1]) / 2 - pinch.y) * -0.003; return; }
      if (drag) { lastIn = performance.now(); camE = 0; { const nt = performance.now(); if (drag.lt && nt > drag.lt) { const dm = nt - drag.lt; drag.vx = 0.5 * drag.vx + 0.5 * (e.clientX - drag.lcx) / dm; drag.vy = 0.5 * drag.vy + 0.5 * (e.clientY - drag.lcy) / dm; } drag.lt = nt; drag.lcx = e.clientX; drag.lcy = e.clientY; } const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) { drag.moved = true; if (!VIEWS[S.view].drag) S.turning = false; }
        if (drag.moved && VIEWS[S.view].drag) { const [x, y] = local(e); mouse = [x, y]; VIEWS[S.view].drag(drag.lx, drag.ly, x, y); } else if (drag.moved) { yaw = drag.yaw + dx * 0.008; pitch = Math.max(-1.2, Math.min(1.2, drag.pitch + dy * 0.008)); } }
      else if (e.target === canvas) { const [x, y] = local(e); mouse = [x, y]; hover = pick(x, y); canvas.style.cursor = hover >= 0 ? 'pointer' : 'grab'; } };
    let lastOpen = 0; const open = (n, tab) => { const t = performance.now(); if (t - lastOpen < 500) return; lastOpen = t; opts.onOpen && opts.onOpen(n, tab); };
    const onUp = (e) => { touches.delete(e.pointerId); if (pinch) { if (touches.size < 2) pinch = null; drag = null; return; }
      if (drag && drag.moved && !calm() && performance.now() - drag.lt < 90 && Math.hypot(drag.vx, drag.vy) > 0.05) { const V = VIEWS[S.view], m = V.body && !V.drag ? 'body' : S.view === '3D brain' ? 'b3' : S.view === 'Synapse network' && fsN.node < 0 ? 'pan' : ''; if (m) { inr = { on: true, vx: drag.vx, vy: drag.vy, m }; wake(); } }
      if (drag && !drag.moved && e.target === canvas && mmOn()) { const [x, y] = local(e), m = mmRect();
        if (x >= m.x - 3 && x <= m.x + m.w + 3 && y >= m.y - 3 && y <= m.y + m.h + 3) { panX = -((x - m.x) / m.w * 1.2 - 0.6) * scale(); panY = 0.015 - (1.25 - (y - m.y) / m.h * 2.4); fly = null; drag = null; return; } }
      if (drag && !drag.moved && e.target === canvas && S.view === 'Matrix' && matGeo) { const [x] = local(e), d = Math.floor((x - matGeo.left) / matGeo.cw);
        if (d >= 0 && d < matGeo.D) { const day0 = matGeo.now2 - (matGeo.D - 1 - d) * 864e5; range = [day0 - 864e5 / 2, day0 + 864e5 / 2]; drawTimeline(); } drag = null; return; }
      if (drag && !drag.moved && e.target === canvas) { const [x, y] = local(e); const i = pick(x, y); if (!calm() && i >= 0) { ripples.push({ i, x, y, t0: performance.now() }); wake(); } { const V = VIEWS[S.view]; if (i < 0 && V.click && V.click(x, y)) { drag = null; return; } }
        if (i >= 0 && e.shiftKey) { setPathPt(i); drag = null; return; }
        if (i >= 0 && (i === sel || e.metaKey || e.ctrlKey)) open(nodes[i], e.metaKey || e.ctrlKey); else if (i >= 0) { sel = i; selT = performance.now(); showCard(i); } else if (VIEWS[S.view].ego && performance.now() - selT < 450) { /* second click of a double-click on a node that just moved to the centre */ } else { sel = -1; closePrev(); } } drag = null; };
    const onWheel = (e) => { e.preventDefault(); tourStop(); fly = null; lastIn = performance.now(); camE = 0; inr.on = false; if (e.shiftKey) { panY += e.deltaY * 0.002; return; }
      zoomT = Math.max(0.5 * 0.92, Math.min(6 * 1.08, (zoomT != null ? zoomT : zoom) * (e.deltaY < 0 ? 1.1 : 0.9))); lastWheel = performance.now(); zoomA = local(e); wake(); };   // v10 D3: eased, cursor-anchored, 8% rubber band
    const arrowNav = (k) => { const V = VIEWS[S.view], P2 = V.body ? lastPP : V.layout(); if (!P2) return; const dx = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0, dy = k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0, o = sel >= 0 ? P2[sel] : [W / 2, (H - TLH()) / 2]; let best = -1, bs = 1e9;
      for (let i = 0; i < nodes.length; i++) { const n = nodes[i]; if (i === sel || !vis(n) || !inRange(n) || !aOk(n)) continue; const vx = P2[i][0] - o[0], vy = P2[i][1] - o[1], d = Math.hypot(vx, vy); if (d < 1) continue;
        const c = sel < 0 ? 1 : (vx * dx + vy * dy) / d; if (c < 0.5) continue; const sc = d / c; if (sc < bs) { bs = sc; best = i; } }   // score = distance / cos(angle), within 60 degrees
      if (best >= 0) { sel = best; showCard(best); flash = { i: best, t0: clock }; wake(); } };
    const onKey = (e) => { if (!visible || dead) return; const lf = host.closest('.workspace-leaf'); if (lf && !lf.classList.contains('mod-active')) return;
      if (tourOn && e.key !== 'g' && e.key !== 'G') tourStop();
      if (e.key === 'Escape') { if (helpOpen) { toggleHelp(false); return; } if (pathA >= 0) { clearPath(); return; } { const V = VIEWS[S.view]; if (V.esc && V.esc()) return; } if (!nodes.some((n) => vis(n) && isLit(n) && (!query || matches.has(nodes.indexOf(n))))) { areaSet = new Set(); S.areas = []; save(); paintChips(); search.value = ''; runSearch(); } sel = -1; closePrev(); range = null; drawTimeline(); return; }
      if (e.key === 'Enter' && sel >= 0 && !e.target.closest('input,select,button,textarea,[contenteditable]')) { open(nodes[sel], e.metaKey || e.ctrlKey); return; }
      if ((e.ctrlKey || e.altKey) && !e.metaKey && /^Digit[1-5]$/.test(e.code || '') && !e.target.closest('input,select,textarea,[contenteditable]')) { e.preventDefault(); (e.ctrlKey ? bmSave : bmGo)(e.code.slice(5)); return; }
      if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input,select,textarea,[contenteditable]')) return; const k = e.key, names = Object.keys(VIEWS);
      if (e.shiftKey && /^Digit[1-8]$/.test(e.code || '')) { const nm = names[10 + +e.code.slice(5) - 1]; if (nm) { e.preventDefault(); switchView(nm); } }
      else if (/^[0-9]$/.test(k)) { const nm = names[k === '0' ? 9 : k - 1]; if (nm) { e.preventDefault(); switchView(nm); } }
      else if (k === '[' || k === ']') { e.preventDefault(); const j = names.indexOf(S.view) + (k === ']' ? 1 : -1); switchView(names[(j + names.length) % names.length]); }
      else if (k === '/') { e.preventDefault(); search.focus(); }
      else if (k === 'g' || k === 'G') tourToggle();
      else if (k === 'l' || k === 'L') toggleTags();
      else if (k === 'm' || k === 'M') toggleSound();
      else if (k === 'p' || k === 'P') pathKey();
      else if (k === 'n' || k === 'N') nextPath();
      else if (k === 'Backspace') { if (neyBack()) e.preventDefault(); }
      else if (k === 't' || k === 'T') toggleToday();
      else if (k === '?') toggleHelp();
      else if (k === 's' || k === 'S') toggleStats();
      else if (k === 'e' || k === 'E') exportPNG();
      else if (k === 'c' || k === 'C') hdB.click();
      else if (k === 'f' || k === 'F') { fly = null; zoomT = null; zoom = 1; panX = 0; panY = 0; wake(); }
      else if (k === 'Tab' && !e.target.closest('button,a,[role=button]')) { e.preventDefault(); tabNav(e.shiftKey ? -1 : 1); }
      else if (k.startsWith('Arrow')) { e.preventDefault(); if (S.view === 'Reflex arc' && (k === 'ArrowLeft' || k === 'ArrowRight') && stepPath(k === 'ArrowRight' ? 1 : -1)) return; arrowNav(k); } };
    canvas.addEventListener('dblclick', (e) => { const [x, y] = local(e), i = pick(x, y); if (i >= 0) open(nodes[i], e.metaKey || e.ctrlKey); else if (VIEWS[S.view].ego && sel >= 0 && performance.now() - selT < 700) open(nodes[sel], e.metaKey || e.ctrlKey); else if (VIEWS[S.view].dbl) VIEWS[S.view].dbl(); else if (range && VIEWS[S.view].drag) { range = null; drawTimeline(); } });
    const act = () => { lastAny = performance.now(); }, ACT = ['pointermove', 'pointerdown', 'keydown', 'wheel']; ACT.forEach((t) => window.addEventListener(t, act, { passive: true }));
    canvas.tabIndex = 0; canvas.classList.add('sn-cv'); canvas.setAttribute('aria-label', 'Neural system · 1–9, 0 views, [ ] switch, ? help');
    const takeFocus = (force) => { const a = document.activeElement, lf = host.closest('.workspace-leaf'); if (a === canvas || (!force && ((a && a.closest && a.closest('input,select,textarea,[contenteditable]')) || (lf && !lf.classList.contains('mod-active'))))) return; canvas.focus({ preventScroll: true }); };
    canvas.addEventListener('pointerenter', () => takeFocus(false)); canvas.addEventListener('pointerdown', () => takeFocus(true));
    canvas.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false }); window.addEventListener('keydown', onKey);
    const io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; wake(); }); io.observe(canvas); document.addEventListener('visibilitychange', wake);
    const ro = new ResizeObserver(resize); ro.observe(canvas); const dprWatch = () => { try { const mq = matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)'); mq.addEventListener('change', () => { resize(); wake(); dprWatch(); }, { once: true }); } catch (e) {} }; dprWatch(); resize(); raf = requestAnimationFrame(loop);
    return { destroy() { dead = true; cancelAnimationFrame(raf); io.disconnect(); document.removeEventListener('visibilitychange', wake); ro.disconnect(); canvas.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp); ACT.forEach((t) => window.removeEventListener(t, act)); canvas.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', onKey); clearTimeout(toastT); clearTimeout(prevT); [live, tools, sepTb, gear, panel, card, prev, stats, tl, search, lcol, css, seg, seg2, helpBtn, pills, tagRow, cmpEl, help, clrBtn, toastEl].forEach((x) => x.remove()); },
      setUnresolved(u) { setUnresolved(u); },
      pulse(path) { const i = nodes.findIndex((n) => n.path === path); if (i >= 0) { born.set(i, clock); beats.push(clock); beep(); wake(); } return i; },
      _test: { sun: () => ({ busy: sunData.busy, tot: sunData.hourTot, cnt: sunData.cnt }), coral: () => { const g = coralGeo(); return { n: g.ord.length, bnd: g.bnd, first: g.ord[0], last: g.ord[g.ord.length - 1] }; }, wave: () => { const g = waveGeo(); return { D: g.D, tot: g.tot, out: g.out.reduce((a, b) => a + b, 0) }; }, dend: () => { const g = dendGeo(); return { folders: g.all.length, root: g.root.cnt }; }, ambTest: () => { lastAny = performance.now() - 46000; }, cam: () => ({ zoom, zoomT, panX, panY, yaw, pitch, inr: inr.on, amb: ambV, rip: ripples.length, hs: [...hAct].length }), fly: () => fly, areas: (a) => { areaSet = new Set(a); paintChips(); }, amb: (b) => { ambOn = b; }, bench: (n) => { const t = performance.now(); for (let k = 0; k < n; k++) draw(t + k * 16.7); return +((performance.now() - t) / n).toFixed(2); }, search: (q) => { search.value = q; runSearch(); return matches.size; }, nodes, regionOf, S, setView: (v) => switchView(v), key: (k, o) => onKey({ key: k, target: document.body, preventDefault() {}, ...o }), today: toggleToday, help: toggleHelp, setDay: (b) => { S.day = b; for (const k in sprites) delete sprites[k]; }, select: (i) => { sel = i; showCard(i); }, pos: () => VIEWS[S.view].layout(), hv: () => hover, sl: () => sel, hover: (i) => { hover = i; }, mouse: (x, y) => { mouse = [x, y]; }, stats: toggleStats, exp: exportPNG, bmSave, bmGo, bms: () => S.bm, thr: (b) => { thrOn = b; }, frame: frameThread, broken: () => [nBroken, broken.size], prevText: () => prev.textContent, tm: tmBuild, setUnresolved, cOpen: () => cOpen, heatT: () => heatT, drag: (a, b, c, d) => VIEWS[S.view].drag(a, b, c, d), click: (x, y) => { const V = VIEWS[S.view]; return V.click ? V.click(x, y) : null; }, pick, hit: (x, y) => VIEWS[S.view].hit(x, y), L0, setRange: (a, b) => { range = [a, b]; drawTimeline(); }, applyTheme, REGIONS, pathSet: (a, b) => { pathA = a; pathB = -1; setPathPt(b); }, path: () => pathR, nextPath, sug: suggest, tour: tourToggle, tourState: () => [tourOn, tourI], fs: () => ({ it: fsN.it, run: fsN.run }), sound: toggleSound, tags: toggleTags, cmp: () => [cmpPair, cmpX.length], b3, stepPath, nHist: () => nHist } };
  }
  return { create, regionOf, layout };
})();
/* ===== RENDERER END ===== */

if (typeof require === 'function' && typeof module !== 'undefined') {
  const { Plugin, ItemView, getAllTags } = require('obsidian');
  const VIEW = 'neural-system-view';

  // colour groups from the core graph settings (same colours as the current glowing graph)
  function matcher(q) {
    const m = q.match(/^(path|file):"?([^"]+)"?$/); if (!m) return () => false;
    const [, kind, val] = m;
    return kind === 'path' ? (f) => f.path === val || f.path.startsWith(val + '/') : (f) => f.basename.includes(val);
  }

  class NeuralView extends ItemView {
    getViewType() { return VIEW; }
    getDisplayText() { return 'Neural System'; }
    getIcon() { return 'brain'; }
    async onOpen() {
      const el = this.contentEl; el.empty(); el.addClass('neural-system'); el.style.position = 'relative';
      const canvas = el.createEl('canvas'); canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.display = 'block';
      let groups = [];
      try { const g = JSON.parse(await this.app.vault.adapter.read(this.app.vault.configDir + '/graph.json'));
        groups = (g.colorGroups || []).map((c) => ({ query: c.query, color: c.color.rgb, test: matcher(c.query) })); } catch (e) {}
      const files = this.app.vault.getMarkdownFiles().filter((f) => !f.path.split('/').some((s) => s.startsWith('.')));
      const index = new Map(files.map((f, i) => [f.path, i])); this.index = index;
      const counts = new Map();
      const nodes = files.map((f) => { const grp = groups.find((g) => g.test(f));
        const color = grp ? grp.color : (/^(receipts|daily)\//.test(f.path) ? 0x6f7ea8 : 0xd9b97a);
        const name = grp ? grp.query.replace(/^(path|file):"?|"$/g, '') : (/^receipts\//.test(f.path) ? 'receipts' : /^daily\//.test(f.path) ? 'daily' : 'other');
        counts.set(name, { color, count: ((counts.get(name) || {}).count || 0) + 1 });
        let tags = []; try { tags = [...new Set((getAllTags(this.app.metadataCache.getFileCache(f)) || []).map((t) => t.replace(/^#/, '')))]; } catch (e) {}
        return { path: f.path, name: f.basename, mtime: f.stat.mtime, ctime: f.stat.ctime, color, group: name, tags }; });
      const links = []; const rl = this.app.metadataCache.resolvedLinks;
      for (const src in rl) { const a = index.get(src); if (a === undefined) continue;
        for (const dst in rl[src]) { const b = index.get(dst); if (b !== undefined && b !== a) links.push([a, b]); } }
      const legend = [...counts.entries()].map(([name, v]) => ({ name, color: v.color, count: v.count })).sort((x, y) => y.count - x.count);
      // open threads (Threads.md "### " sections without a done marker) and today's agent receipts; both optional, never fatal
      const TP = '🔮 Companion/Threads.md', threads = [], agent = new Set(), resolve = (l, from) => { const t = String(l).replace(/^\[\[|\]\]$/g, '').split('|')[0].split('#')[0].trim(); const d = t && this.app.metadataCache.getFirstLinkpathDest(t, from); return d && index.has(d.path) ? d.path : null; };
      try { const tf = this.app.vault.getAbstractFileByPath(TP); if (tf) { const parts = (await this.app.vault.cachedRead(tf)).split(/^(?=### )/m).filter((p) => p.startsWith('### '));
        for (const p of parts) { const title = p.split('\n')[0].slice(4).trim(); if (/DONE|CLOSED|DELIVERED/.test(title.toUpperCase())) continue;
          threads.push({ title, paths: [...new Set([...p.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => resolve(m[1], TP)).filter(Boolean))] }); } } } catch (e) {}
      try { const d0 = new Date(); d0.setHours(0, 0, 0, 0);
        for (const f of files) { if (!f.path.startsWith('receipts/') || f.stat.mtime < d0.getTime()) continue;
          const m = (await this.app.vault.cachedRead(f)).match(/^---\s*\n([\s\S]*?)\n---/); if (!m) continue; let fm; try { fm = JSON.parse(m[1]); } catch (e) { continue; }
          if (fm.created_at && new Date(fm.created_at) < d0) continue;
          for (const r of (Array.isArray(fm.refs) ? fm.refs : [])) { const rp = typeof r === 'string' ? r : r && r.path, p = index.has(rp) ? rp : rp && resolve(rp, f.path); if (p && !p.startsWith('receipts/')) agent.add(p); } } } catch (e) {}
      const vaultName = this.app.vault.getName(), app = this.app;
      this.r = NeuralRender.create(canvas, { nodes, links, groups: legend }, {
        vaultName, unresolved: this.unresolvedFor(index),
        readText: async (p) => { const f = app.vault.getAbstractFileByPath(p); if (!f || !f.stat) throw new Error('none'); return await app.vault.cachedRead(f); },
        saveBlob: async (buf, name) => { const dir = 'assets/neural'; let acc = ''; for (const seg of dir.split('/')) { acc = acc ? acc + '/' + seg : seg; if (!(await app.vault.adapter.exists(acc))) await app.vault.createFolder(acc); }
          const path = dir + '/' + name; await app.vault.createBinary(path, buf); return path; },
        threads, threadsPath: TP, agentToday: [...agent], bottomInset: (document.querySelector('.status-bar') && document.querySelector('.status-bar').offsetHeight || 24) + 4,
        onOpen: (n, tab) => this.app.workspace.openLinkText(n.path, '', tab ? 'tab' : false) });
    }
    unresolvedFor(index) { const u = this.app.metadataCache.unresolvedLinks || {}, out = {}; for (const p in u) if (index.has(p) && Object.keys(u[p]).length) out[p] = u[p]; return out; }
    async onClose() { if (this.r) this.r.destroy(); clearTimeout(this.rebuildT); }
    pulse(path) { if (!this.r) return; if (this.r.pulse(path) < 0) { clearTimeout(this.rebuildT); this.rebuildT = setTimeout(async () => { if (this.r) this.r.destroy(); await this.onOpen(); this.r && this.r.pulse(path); }, 1500); } }
  }

  module.exports = class NeuralSystem extends Plugin {
    async onload() {
      this.registerView(VIEW, (leaf) => new NeuralView(leaf));
      this.addRibbonIcon('brain', 'Neural System', () => this.open());
      this.addCommand({ id: 'open', name: 'Open neural system', callback: () => this.open() });
      // a note created or changed is "born" in the body: a light ring, a new one flies in from the spinal cord
      const live = (f) => { if (!f || !f.path || !f.path.endsWith('.md')) return; for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) leaf.view.pulse && leaf.view.pulse(f.path); };
      this.registerEvent(this.app.vault.on('create', live)); this.registerEvent(this.app.vault.on('modify', live));
      let ut = 0; this.registerEvent(this.app.metadataCache.on('resolved', () => { clearTimeout(ut); ut = setTimeout(() => { for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) { const v = leaf.view; if (v.r && v.index) v.r.setUnresolved(v.unresolvedFor(v.index)); } }, 800); }));
    }
    async open() {
      const ex = this.app.workspace.getLeavesOfType(VIEW)[0];
      const leaf = ex || this.app.workspace.getLeaf(true);
      if (!ex) await leaf.setViewState({ type: VIEW, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
    onunload() {}
  };
}
