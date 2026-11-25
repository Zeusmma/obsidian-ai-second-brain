// Brain Signal: light that flows along the graph links when a note changes
const { Plugin } = require("obsidian");

const BASE = 0x9fd8ff, BURST = 0xffd27a;
const MAX_AMBIENT = 0, SPEED = 170; // no ambient signals, only bursts when a file changes // world units per second

function dot(g, x, y, r, color, alpha) {
  if (typeof g.beginFill === "function") { g.beginFill(color, alpha); g.drawCircle(x, y, r); g.endFill(); }
  else { g.circle(x, y, r); g.fill({ color, alpha }); }
}

module.exports = class BrainSignal extends Plugin {
  onload() {
    this.state = new WeakMap(); // renderer -> { g, parts: [] }
    this.pending = [];          // paths of changed files
    const burst = (f) => f && f.path && this.pending.push(f.path);
    this.registerEvent(this.app.vault.on("modify", burst));
    this.registerEvent(this.app.vault.on("create", burst));
    this.registerEvent(this.app.vault.on("rename", burst));
    this.last = performance.now();
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      if (document.hidden) return;
      try { this.tick(dt); } catch (e) { console.error("brain-signal", e); }
    };
    this.raf = requestAnimationFrame(loop);
  }

  onunload() {
    cancelAnimationFrame(this.raf);
    for (const r of this.renderers()) {
      const st = this.state.get(r);
      if (st && st.g) { try { st.g.parent && st.g.parent.removeChild(st.g); st.g.destroy(); } catch (e) {} }
    }
  }

  renderers() {
    const out = [];
    for (const type of ["graph", "localgraph"])
      for (const leaf of this.app.workspace.getLeavesOfType(type)) {
        const r = leaf.view && leaf.view.renderer;
        if (r && r.hanger && Array.isArray(r.links)) out.push(r);
      }
    return out;
  }

  layer(r) {
    let st = this.state.get(r);
    if (st && st.g && !st.g.destroyed && st.g.parent === r.hanger) return st;
    const n0 = r.nodes && r.nodes.find((n) => n.circle);
    const G = (n0 && n0.circle.constructor) ||
      (r.iframeEl && r.iframeEl.contentWindow && r.iframeEl.contentWindow.PIXI && r.iframeEl.contentWindow.PIXI.Graphics) ||
      (window.PIXI && window.PIXI.Graphics);
    if (!G) return null;
    const g = new G();
    g.eventMode = "none"; g.interactive = false;
    r.hanger.addChild(g);
    st = { g, parts: st ? st.parts : [] };
    this.state.set(r, st);
    return st;
  }

  spawn(link, opts = {}) {
    const s = opts.reverse ? link.target : link.source, t = opts.reverse ? link.source : link.target;
    const len = Math.hypot(t.x - s.x, t.y - s.y) || 1;
    return { link, p: opts.reverse ? 1 : 0, dir: opts.reverse ? -1 : 1, len,
             speed: SPEED * (0.7 + Math.random() * 0.6) * (opts.burst ? 1.8 : 1),
             color: (() => { try { const c = s.getFillColor && s.getFillColor(); if (c && typeof c.rgb === "number") return c.rgb; } catch (e) {} return (s.color && s.color.rgb) || opts.fill || BASE; })(), burst: !!opts.burst };
  }

  tick(dt) {
    const paths = this.pending.splice(0);
    for (const r of this.renderers()) {
      const st = this.layer(r); if (!st) continue;
      const links = r.links; if (!links.length) { st.g.clear(); continue; }
      const live = new Set(links);
      const fill = r.colors && r.colors.fill && r.colors.fill.rgb;
      // signal bursts from changed files
      for (const path of paths)
        for (const l of links) {
          if (l.source && l.source.id === path) st.parts.push(this.spawn(l, { burst: true, fill }));
          else if (l.target && l.target.id === path) st.parts.push(this.spawn(l, { burst: true, reverse: true, fill }));
        }
      // ambient signals
      const want = Math.min(MAX_AMBIENT, Math.ceil(links.length * 0.08));
      let ambient = 0; for (const q of st.parts) if (!q.burst) ambient++;
      for (let i = ambient; i < want; i++) {
        if (Math.random() > 0.15) break; // spawn gradually
        st.parts.push(this.spawn(links[(Math.random() * links.length) | 0], { fill }));
      }
      const scale = r.scale || 1, size = Math.max(1.1, 1.6 / scale); // world units: grows when zoomed in
      const g = st.g; g.clear();
      const keep = [];
      for (const q of st.parts) {
        const l = q.link;
        if (!live.has(l) || !l.source || !l.target) continue;
        q.p += q.dir * dt * q.speed / q.len;
        if (q.p < 0 || q.p > 1) continue;
        const sx = l.source.x, sy = l.source.y, tx = l.target.x, ty = l.target.y;
        // thin light tail along the link + bright head
        const tail = Math.min(0.35, 60 / q.len) * (q.burst ? 1.4 : 1);
        const segs = 6;
        for (let k = segs; k >= 1; k--) {
          const a0 = q.p - q.dir * tail * (k / segs), a1 = q.p - q.dir * tail * ((k - 1) / segs);
          if (a0 < 0 || a0 > 1) continue;
          const x0 = sx + (tx - sx) * a0, y0 = sy + (ty - sy) * a0, x1 = sx + (tx - sx) * a1, y1 = sy + (ty - sy) * a1;
          g.lineStyle(size * (q.burst ? 1.1 : 0.75) * (1 - (k - 1) / segs), q.color, (q.burst ? 0.95 : 0.7) * (1 - (k - 1) / segs));
          g.moveTo(x0, y0); g.lineTo(x1, y1);
        }
        g.lineStyle(0);
        const hx = sx + (tx - sx) * q.p, hy = sy + (ty - sy) * q.p;
        dot(g, hx, hy, size * (q.burst ? 2.6 : 1.8), q.color, q.burst ? 0.22 : 0.12);
        dot(g, hx, hy, size * (q.burst ? 0.9 : 0.6), 0xffffff, 0.95);
        keep.push(q);
      }
      st.parts = keep;
      if (typeof r.changed === "function") r.changed();
    }
  }
};
