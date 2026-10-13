import React, { useEffect, useRef, useState } from 'react';
import { SplitConfig, SectionView } from '../types/clipper';

interface Props {
  split: SplitConfig;
  onChange: (s: SplitConfig) => void;
  videoUrl: string;
  primaryRef: React.RefObject<HTMLVideoElement | null>;
  secondaryRef: React.RefObject<HTMLVideoElement | null>;
  onTimeUpdate: (t: number) => void;
  onDurationChange: (d: number) => void;
  onTogglePlay: () => void;
  filter?: React.CSSProperties;
}
const W = 1080, H = 1920;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ev2 = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Same maths as the FFmpeg renderer (render.cjs sectionChain), in 1080x1920 units, so the preview matches the final clip. */
export function sectionGeom(dims: [number, number], rect: { x: number; y: number; w: number; h: number } | null, h: number, v: SectionView) {
  const [sw, sh] = dims;
  let r = { x: 0, y: 0, w: sw, h: sh };
  if (rect) {
    r = { x: Math.round(clamp(rect.x, 0, 1) * sw), y: Math.round(clamp(rect.y, 0, 1) * sh), w: ev2(clamp(rect.w, 0.05, 1) * sw), h: ev2(clamp(rect.h, 0.05, 1) * sh) };
    r.w = Math.min(r.w, sw - r.x); r.h = Math.min(r.h, sh - r.y);
    if (r.w < 16 || r.h < 16) r = { x: 0, y: 0, w: sw, h: sh };
  }
  const sc = Math.max(W / r.w, h / r.h) * Math.max(1, v.zoom || 1);
  const cw = Math.max(W, Math.ceil(r.w * sc)), ch = Math.max(h, Math.ceil(r.h * sc));
  const x = clamp((cw - W) / 2 * (1 + (v.panX || 0) / 50), 0, cw - W), y = clamp((ch - h) / 2 * (1 + (v.panY || 0) / 50), 0, ch - h);
  return { sc, cw, ch, x, y, vw: sw * sc, vh: sh * sc, left: -(r.x * sc + x), top: -(r.y * sc + y), slackX: cw - W, slackY: ch - h };
}
export const splitSizes = (s: SplitConfig) => {
  const gap = s.gap > 0 ? ev2(s.gap) : 0;
  const topH = ev2(H * clamp(s.splitPct ?? 40, 20, 80) / 100);
  return { gap, topH, botH: H - topH - gap };
};

export const SplitPreview: React.FC<Props> = ({ split, onChange, videoUrl, primaryRef, secondaryRef, onTimeUpdate, onDurationChange, onTogglePlay, filter }) => {
  const box = useRef<HTMLDivElement>(null);
  const [f, setF] = useState(0.3);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setF((el.clientWidth || 324) / W));
    ro.observe(el); setF((el.clientWidth || 324) / W);
    return () => ro.disconnect();
  }, []);
  const { gap, topH, botH } = splitSizes(split);
  const faceTop = !split.swap;
  const faceH = faceTop ? topH : botH, gameH = faceTop ? botH : topH;
  const faceY = faceTop ? 0 : topH + gap, gameY = faceTop ? topH + gap : 0;
  const faceView = faceTop ? split.top : split.bottom, gameView = faceTop ? split.bottom : split.top;
  const mainDims = split.mainDims || [1920, 1080];
  const secDims = (split.mode === 'single' ? mainDims : split.secondDims || mainDims) as [number, number];
  const fg = sectionGeom(mainDims, split.mode === 'single' ? split.facecam : null, faceH, faceView);
  const gg = sectionGeom(secDims, null, gameH, gameView);
  const otherUrl = split.mode === 'single' ? videoUrl : (split.secondUrl || videoUrl);

  // keep the second <video> in step with the main one
  const syncOther = () => {
    const a = primaryRef.current, b = secondaryRef.current; if (!a || !b || split.mode === 'bg') return;
    const target = Math.max(0, a.currentTime + (split.mode === 'two' ? split.offset : 0));
    if (Math.abs(b.currentTime - target) > 0.25) { try { b.currentTime = target; } catch { /* ignore */ } }
  };
  useEffect(() => { const b = secondaryRef.current; if (b) { b.muted = true; syncOther(); } }, [split.offset, split.mode, otherUrl]);

  // ---- drag a section's content (pan) / the divider ----
  const drag = useRef<{ kind: 'face' | 'game' | 'div'; sx: number; sy: number; v0: SectionView; pct0: number } | null>(null);
  const begin = (kind: 'face' | 'game' | 'div') => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { kind, sx: e.clientX, sy: e.clientY, v0: kind === 'face' ? { ...faceView } : kind === 'game' ? { ...gameView } : { zoom: 1, panX: 0, panY: 0 }, pct0: split.splitPct };
  };
  const setView = (kind: 'face' | 'game', v: SectionView) => {
    const isTop = (kind === 'face') === faceTop;
    onChange(isTop ? { ...split, top: v } : { ...split, bottom: v });
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = (e.clientX - d.sx) / f, dy = (e.clientY - d.sy) / f;
    if (d.kind === 'div') { onChange({ ...split, splitPct: Math.round(clamp(d.pct0 + (dy / H) * 100, 25, 75)) }); return; }
    const g = d.kind === 'face' ? fg : gg;
    const x0 = g.x, y0 = g.y;
    const nx = clamp(x0 - dx, 0, g.slackX), ny = clamp(y0 - dy, 0, g.slackY);
    // (the geometry was computed from d.v0 at drag start; recompute from the live start point instead)
    const startG = sectionGeom(d.kind === 'face' ? mainDims : secDims, d.kind === 'face' && split.mode === 'single' ? split.facecam : null, d.kind === 'face' ? faceH : gameH, d.v0);
    const sx = clamp(startG.x - dx, 0, startG.slackX), sy = clamp(startG.y - dy, 0, startG.slackY);
    void nx; void ny;
    setView(d.kind, { ...d.v0, panX: startG.slackX > 0 ? +((2 * sx / startG.slackX - 1) * 50).toFixed(1) : 0, panY: startG.slackY > 0 ? +((2 * sy / startG.slackY - 1) * 50).toFixed(1) : 0 });
  };
  const end = () => { drag.current = null; };
  const wheel = (kind: 'face' | 'game') => (e: React.WheelEvent) => {
    const v = kind === 'face' ? faceView : gameView;
    setView(kind, { ...v, zoom: +clamp((v.zoom || 1) - e.deltaY * 0.001, 1, 3).toFixed(2) });
  };

  const vidStyle = (g: ReturnType<typeof sectionGeom>): React.CSSProperties => ({ position: 'absolute', width: g.vw, height: g.vh, left: g.left, top: g.top, maxWidth: 'none', ...(filter || {}) });
  const sectionBox = (y: number, h: number): React.CSSProperties => ({ position: 'absolute', left: 0, top: y, width: W, height: h, overflow: 'hidden', background: '#000', touchAction: 'none' });

  return (
    <div ref={box} className="absolute inset-0 overflow-hidden" onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div style={{ width: W, height: H, transform: `scale(${f})`, transformOrigin: 'top left', position: 'absolute', left: 0, top: 0, background: split.gapColor || '#000' }}>
        {/* facecam / main section */}
        <div style={{ ...sectionBox(faceY, faceH), borderRadius: Math.max(0, split.radius || 0), cursor: 'grab' }} onPointerDown={begin('face')} onWheel={wheel('face')}>
          <video ref={primaryRef as React.RefObject<HTMLVideoElement>} src={videoUrl} loop playsInline draggable={false}
            onTimeUpdate={(e) => { onTimeUpdate(e.currentTarget.currentTime); syncOther(); }}
            onLoadedMetadata={(e) => onDurationChange(e.currentTarget.duration)}
            onClick={onTogglePlay} style={vidStyle(fg)} />
        </div>
        {/* game / second section */}
        <div style={{ ...sectionBox(gameY, gameH), cursor: 'grab' }} onPointerDown={begin('game')} onWheel={wheel('game')}>
          <video ref={secondaryRef as React.RefObject<HTMLVideoElement>} src={otherUrl} muted loop playsInline draggable={false}
            style={split.gameFit === 'fit' ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', ...(filter || {}) } : vidStyle(gg)} />
        </div>
        {/* divider handle */}
        <div onPointerDown={begin('div')} title="Drag to resize the two sections"
          style={{ position: 'absolute', left: 0, width: W, top: topH + gap / 2 - 36, height: 72, cursor: 'row-resize', touchAction: 'none', zIndex: 20 }}>
          <div style={{ position: 'absolute', left: W / 2 - 80, top: 30, width: 160, height: 12, borderRadius: 6, background: 'rgba(190,242,100,0.9)', boxShadow: '0 0 10px rgba(0,0,0,.7)' }} />
        </div>
      </div>
    </div>
  );
};
