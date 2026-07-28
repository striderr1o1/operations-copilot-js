import { useEffect, useRef } from "react";
import "./ParticleScene.css";

/**
 * The hero visual: a few thousand particles that fly in and settle into an AI
 * unit (left, wireframe) speaking to the silhouette of a customer (right),
 * with signal waves travelling between them.
 *
 * How it works
 *  1. The scene is drawn once into an offscreen canvas, each element painted in
 *     a pure R / G / B so the channel doubles as a group tag.
 *  2. That bitmap is sampled on a grid; every opaque pixel becomes one particle
 *     target, in fixed 1000x700 "scene" coordinates.
 *  3. Targets are mapped to the live canvas each frame (contain-fit), so a
 *     resize never needs a re-sample.
 *  4. Particles spring toward their target with per-particle stiffness, drift
 *     on a sine, and shove away from the pointer.
 */

const SCENE_W = 1000;
const SCENE_H = 700;

const GROUP_ROBOT = 0;
const GROUP_CUSTOMER = 1;
const GROUP_SIGNAL = 2;

// index matches the group constants above
const PALETTES = [
  ["#7ef3ff", "#22d3ee", "#0bb6d6"], // robot — bright cyan wireframe
  ["#4d8fae", "#3a7593", "#2b5c77"], // customer — steel blue, reads as a mass
  ["#a8f7ff", "#38dcf2", "#0ea5c4"], // signal waves
];

const SIZES = [2.1, 1.7, 2.3];

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Paint the scene, one pure colour channel per particle group. */
function drawScene(ctx) {
  ctx.clearRect(0, 0, SCENE_W, SCENE_H);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // ---- the AI unit: red channel, drawn as strokes so it stays a wireframe ----
  ctx.strokeStyle = "#ff0000";
  ctx.fillStyle = "#ff0000";
  ctx.lineWidth = 7;

  // head
  roundRectPath(ctx, 152, 168, 228, 196, 52);
  ctx.stroke();

  // antenna
  ctx.beginPath();
  ctx.moveTo(266, 168);
  ctx.lineTo(266, 112);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(266, 98, 15, 0, Math.PI * 2);
  ctx.fill();

  // eyes
  ctx.beginPath();
  ctx.arc(216, 248, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(316, 248, 21, 0, Math.PI * 2);
  ctx.fill();

  // mouth — a speaking waveform rather than a smile
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(214, 312);
  ctx.lineTo(238, 312);
  ctx.lineTo(250, 292);
  ctx.lineTo(266, 330);
  ctx.lineTo(282, 296);
  ctx.lineTo(294, 312);
  ctx.lineTo(318, 312);
  ctx.stroke();

  // neck
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(266, 364);
  ctx.lineTo(266, 398);
  ctx.stroke();

  // torso
  roundRectPath(ctx, 146, 398, 240, 196, 44);
  ctx.stroke();

  // core
  ctx.beginPath();
  ctx.arc(266, 482, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(266, 482, 12, 0, Math.PI * 2);
  ctx.fill();

  // arms
  ctx.beginPath();
  ctx.moveTo(146, 440);
  ctx.lineTo(104, 470);
  ctx.lineTo(104, 556);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(386, 440);
  ctx.lineTo(428, 470);
  ctx.lineTo(428, 556);
  ctx.stroke();

  // base plinth
  ctx.beginPath();
  ctx.moveTo(178, 594);
  ctx.lineTo(354, 594);
  ctx.stroke();

  // ---- the customer: green channel, filled so it reads as a silhouette ----
  ctx.fillStyle = "#00ff00";
  ctx.beginPath();
  ctx.arc(726, 246, 80, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(590, 648);
  ctx.bezierCurveTo(596, 436, 652, 362, 726, 362);
  ctx.bezierCurveTo(800, 362, 856, 436, 862, 648);
  ctx.closePath();
  ctx.fill();

  // ---- signal waves: blue channel ----
  ctx.strokeStyle = "#0000ff";
  ctx.lineWidth = 7;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(392, 300, 66 + i * 46, -0.62, 0.62);
    ctx.stroke();
  }
  // and the customer answering back, smaller
  ctx.lineWidth = 5;
  for (let i = 0; i < 2; i += 1) {
    ctx.beginPath();
    ctx.arc(612, 176, 44 + i * 34, Math.PI - 0.55, Math.PI + 0.55);
    ctx.stroke();
  }
}

/** Sample the painted scene into particle targets. */
function buildTargets(step) {
  const canvas = document.createElement("canvas");
  canvas.width = SCENE_W;
  canvas.height = SCENE_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  drawScene(ctx);

  const { data } = ctx.getImageData(0, 0, SCENE_W, SCENE_H);
  const targets = [];
  // jitter the grid so the result doesn't look like graph paper
  const jitter = step * 0.45;

  for (let y = 0; y < SCENE_H; y += step) {
    for (let x = 0; x < SCENE_W; x += step) {
      const i = (y * SCENE_W + x) * 4;
      if (data[i + 3] < 110) continue;

      let group = GROUP_ROBOT;
      if (data[i + 1] > 120) group = GROUP_CUSTOMER;
      else if (data[i + 2] > 120) group = GROUP_SIGNAL;

      targets.push({
        x: x + (Math.random() - 0.5) * jitter,
        y: y + (Math.random() - 0.5) * jitter,
        group,
      });
    }
  }
  return targets;
}

export default function ParticleScene() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Fewer, chunkier particles on small screens — the phone has to render this
    // behind a scrolling page.
    const narrow = window.innerWidth < 760;
    const step = narrow ? 9 : 7;

    const targets = buildTargets(step);
    const pointer = { x: -9999, y: -9999, active: false };

    let width = 0;
    let height = 0;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let dpr = 1;

    // Buckets keyed by colour so a frame sets fillStyle a handful of times
    // rather than once per particle.
    const buckets = [];
    const particles = targets.map((t, index) => {
      const shade = index % 3;
      const bucket = t.group * 3 + shade;
      (buckets[bucket] ||= { color: PALETTES[t.group][shade], size: SIZES[t.group], items: [] });

      return {
        sx: t.x,
        sy: t.y,
        group: t.group,
        bucket,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        // Stiffness/damping vary a little so the swarm doesn't land in lockstep.
        // Tuned so the figure is legible inside ~1.5s — a hero can't spend nine
        // seconds as an unreadable cloud.
        k: 0.028 + Math.random() * 0.02,
        damp: 0.83 + Math.random() * 0.06,
        phase: Math.random() * Math.PI * 2,
        driftSpeed: 0.4 + Math.random() * 0.9,
        driftAmp: (t.group === GROUP_CUSTOMER ? 1.1 : 2.2) + Math.random() * 1.6,
        delay: Math.random() * 420,
        alpha: t.group === GROUP_CUSTOMER ? 0.8 : 0.95,
      };
    });
    particles.forEach((p) => buckets[p.bucket].items.push(p));

    const layout = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      scale = Math.min(width / SCENE_W, height / SCENE_H) * 0.94;
      offsetX = (width - SCENE_W * scale) / 2;
      offsetY = (height - SCENE_H * scale) / 2;
    };

    // Seed particles scattered across the box; the spring pulls them together.
    const seed = () => {
      particles.forEach((p) => {
        const angle = Math.random() * Math.PI * 2;
        const radius = (0.45 + Math.random() * 0.5) * Math.max(width, height);
        p.x = width / 2 + Math.cos(angle) * radius;
        p.y = height / 2 + Math.sin(angle) * radius;
        p.vx = 0;
        p.vy = 0;
      });
    };

    layout();
    seed();

    let raf = 0;
    const began = performance.now();
    let last = began;

    /** The dark pool the figures sit in, plus the cyan bloom behind the AI. */
    const paintBackdrop = (t) => {
      const cx = offsetX + 500 * scale;
      const cy = offsetY + 380 * scale;
      const r = Math.max(width, height) * 0.72;

      const shadow = ctx.createRadialGradient(cx, cy, r * 0.08, cx, cy, r);
      shadow.addColorStop(0, "rgba(2, 6, 11, 0.82)");
      shadow.addColorStop(0.55, "rgba(2, 7, 13, 0.42)");
      shadow.addColorStop(1, "rgba(2, 7, 13, 0)");
      ctx.fillStyle = shadow;
      ctx.fillRect(0, 0, width, height);

      // breathing bloom — this is what makes the figure feel lit from inside
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.0011);
      const gx = offsetX + 266 * scale;
      const gy = offsetY + 300 * scale;
      const gr = (200 + pulse * 70) * scale;

      ctx.globalCompositeOperation = "lighter";
      const bloom = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      bloom.addColorStop(0, `rgba(34, 211, 238, ${0.16 + pulse * 0.07})`);
      bloom.addColorStop(1, "rgba(34, 211, 238, 0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
    };

    const frame = (now) => {
      const t = now - began;
      // Step in units of one 60fps frame, clamped so a background tab that
      // wakes up after a long pause doesn't fling every particle off screen.
      const dt = Math.min((now - last) / 16.667, 3);
      last = now;

      ctx.clearRect(0, 0, width, height);
      paintBackdrop(t);

      // Signal waves travel: a moving band of brightness from AI to customer.
      const travel = ((t * 0.00035) % 1) * SCENE_W;

      ctx.globalCompositeOperation = "lighter";

      for (const bucket of buckets) {
        if (!bucket) continue;
        ctx.fillStyle = bucket.color;
        const half = bucket.size / 2;

        for (const p of bucket.items) {
          const tx = offsetX + p.sx * scale;
          const ty = offsetY + p.sy * scale;

          if (reduceMotion) {
            p.x = tx;
            p.y = ty;
          } else {
            // ramp stiffness in after the particle's delay, so they arrive in waves
            const k = p.k * Math.min(1, Math.max(0, (t - p.delay) / 420));
            const drift = Math.sin(t * 0.001 * p.driftSpeed + p.phase);
            const dx = tx + drift * p.driftAmp - p.x;
            const dy = ty + Math.cos(t * 0.0009 * p.driftSpeed + p.phase) * p.driftAmp * 0.6 - p.y;

            p.vx += dx * k * dt;
            p.vy += dy * k * dt;

            if (pointer.active) {
              const px = p.x - pointer.x;
              const py = p.y - pointer.y;
              const d2 = px * px + py * py;
              if (d2 < 13000 && d2 > 0.01) {
                const force = (13000 - d2) / 13000;
                const d = Math.sqrt(d2);
                p.vx += (px / d) * force * 2.6 * dt;
                p.vy += (py / d) * force * 2.6 * dt;
              }
            }

            const damp = p.damp ** dt;
            p.vx *= damp;
            p.vy *= damp;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
          }

          let alpha = p.alpha;
          if (p.group === GROUP_SIGNAL) {
            // brighten the wave crest as it sweeps rightward
            const d = Math.abs(p.sx - travel);
            alpha = 0.3 + 0.7 * Math.max(0, 1 - d / 190);
          }

          ctx.globalAlpha = alpha;
          ctx.fillRect(p.x - half, p.y - half, bucket.size, bucket.size);
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    const onResize = () => {
      const before = width;
      layout();
      if (!before) seed();
    };

    const onPointerMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };

    const onPointerLeave = () => {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(wrap);
    // Touch scrolling shouldn't drag the swarm around, so pointer tracking is
    // mouse-only.
    canvas.addEventListener("mousemove", onPointerMove);
    canvas.addEventListener("mouseleave", onPointerLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onPointerMove);
      canvas.removeEventListener("mouseleave", onPointerLeave);
    };
  }, []);

  return (
    <div className="pscene" ref={wrapRef}>
      <canvas ref={canvasRef} className="pscene-canvas" aria-hidden="true" />
      <p className="pscene-caption">
        <span className="pscene-dot" />
        live conversation · orchestrator routing
      </p>
    </div>
  );
}
