import { 
  InnerFramingConfig, 
  CaptionConfig, 
  VideoGradingConfig, 
  BrandingConfig, 
  TranscriptWord,
  OuterCanvasRatio 
} from '../types/clipper';

export interface RenderContext {
  canvas: HTMLCanvasElement;
  primaryVideo: HTMLVideoElement;
  secondaryVideo?: HTMLVideoElement | null;
  currentTime: number;
  canvasRatio: OuterCanvasRatio;
  framing: InnerFramingConfig;
  captions: CaptionConfig;
  grading: VideoGradingConfig;
  branding: BrandingConfig;
  words: TranscriptWord[];
}

/**
 * Renders a single frame into the target canvas with all reframing modes,
 * color grading, dynamic captions, watermarks, and progress bar.
 */
export function renderCanvasFrame(ctx: CanvasRenderingContext2D, params: RenderContext): void {
  const { canvas, primaryVideo, secondaryVideo, currentTime, framing, captions, grading, branding, words } = params;
  const cw = canvas.width;
  const ch = canvas.height;

  // Clear canvas
  ctx.save();
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, cw, ch);

  if (!primaryVideo || primaryVideo.readyState < 2) {
    ctx.restore();
    return;
  }

  const vw = primaryVideo.videoWidth || 1920;
  const vh = primaryVideo.videoHeight || 1080;
  const videoAspect = vw / vh;

  // Apply visual grading filters if needed (0-200% scale with 100% neutral)
  let filterStr = `brightness(${grading.brightness}%) contrast(${grading.contrast}%) saturate(${grading.saturation}%)`;
  const warmthOffset = grading.warmth - 100;
  if (warmthOffset !== 0) {
    if (warmthOffset > 0) {
      filterStr += ` sepia(${warmthOffset * 0.4}%)`;
    } else {
      filterStr += ` hue-rotate(${warmthOffset * 0.5}deg)`;
    }
  }

  // 1. Render based on Inner Framing Mode
  switch (framing.mode) {
    case 'fit-blur': {
      // Background layer: Zoomed and heavily blurred copy of video
      ctx.save();
      ctx.filter = `blur(${framing.blurIntensity}px) brightness(${1 - framing.backdropDarken}) ${filterStr}`;
      
      // Calculate cover dimensions for background
      const scaleBg = Math.max(cw / vw, ch / vh) * 1.15; // slightly overscale to avoid blur edge bleed
      const bgW = vw * scaleBg;
      const bgH = vh * scaleBg;
      const bgX = (cw - bgW) / 2;
      const bgY = (ch - bgH) / 2;
      ctx.drawImage(primaryVideo, bgX, bgY, bgW, bgH);
      ctx.restore();

      // Foreground layer: Fitted 16:9 video in the center
      ctx.save();
      ctx.filter = filterStr;
      const fgW = cw;
      const fgH = cw / videoAspect;
      const fgY = (ch - fgH) / 2 + (framing.offsetY * ch * 0.01);

      if (framing.innerShadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 6;
      }

      if (framing.innerBorderRadius > 0) {
        drawRoundedRect(ctx, 0, fgY, fgW, fgH, framing.innerBorderRadius);
        ctx.clip();
      }

      ctx.drawImage(primaryVideo, 0, fgY, fgW, fgH);
      ctx.restore();
      break;
    }

    case 'fill-crop': {
      // Scales video to cover entire vertical frame, horizontal pan offset applied
      ctx.save();
      ctx.filter = filterStr;

      const scale = Math.max(cw / vw, ch / vh);
      const drawW = vw * scale;
      const drawH = vh * scale;

      // Pan offset: -50% to +50% (or dynamic AI auto-reframing speaker tracking)
      let effectivePanX = framing.panX;
      if (framing.autoReframing) {
        effectivePanX = framing.trackingStyle === 'smooth-pan'
          ? Math.sin(currentTime * 0.5) * 20
          : (Math.sin(currentTime * 0.35) > 0 ? -18 : 18);
      }
      const maxPanX = (drawW - cw) / 2;
      const panPixels = Math.max(-maxPanX, Math.min(maxPanX, (effectivePanX / 50) * maxPanX));
      const drawX = (cw - drawW) / 2 + panPixels;
      const drawY = (ch - drawH) / 2;

      ctx.drawImage(primaryVideo, drawX, drawY, drawW, drawH);
      ctx.restore();
      break;
    }

    case 'split-screen': {
      // Split into Top and Bottom sections
      const splitY = (ch * framing.splitRatio) / 100;

      // Top: Primary Video (fit 16:9 or cropped in top section)
      ctx.save();
      ctx.filter = filterStr;
      drawRoundedRect(ctx, 0, 0, cw, splitY, 0);
      ctx.clip();
      
      const topScale = Math.max(cw / vw, splitY / vh);
      const topW = vw * topScale;
      const topH = vh * topScale;
      const topX = (cw - topW) / 2;
      const topY = (splitY - topH) / 2;
      ctx.drawImage(primaryVideo, topX, topY, topW, topH);
      ctx.restore();

      // Divider line
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, splitY - 2, cw, 4);

      // Bottom: Secondary Video or satisfying aesthetic gradient/pattern
      const bottomHeight = ch - splitY;
      ctx.save();
      drawRoundedRect(ctx, 0, splitY, cw, bottomHeight, 0);
      ctx.clip();

      if (secondaryVideo && secondaryVideo.readyState >= 2) {
        const sw = secondaryVideo.videoWidth || 1920;
        const sh = secondaryVideo.videoHeight || 1080;
        const bScale = Math.max(cw / sw, bottomHeight / sh);
        const bW = sw * bScale;
        const bH = sh * bScale;
        const bX = (cw - bW) / 2;
        const bY = splitY + (bottomHeight - bH) / 2;
        ctx.drawImage(secondaryVideo, bX, bY, bW, bH);
      } else {
        // Fallback stylish animated gradient backdrop
        const grad = ctx.createLinearGradient(0, splitY, cw, ch);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(1, '#020617');
        ctx.fillStyle = grad;
        ctx.fillRect(0, splitY, cw, bottomHeight);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ B-ROLL / VIRAL SATISFYING LOOP', cw / 2, splitY + bottomHeight / 2);
      }
      ctx.restore();
      break;
    }

    case 'letterbox': {
      // Clean letterbox with matte backdrop and centered video
      ctx.save();
      ctx.fillStyle = '#050507';
      ctx.fillRect(0, 0, cw, ch);

      ctx.filter = filterStr;
      const boxW = cw;
      const boxH = cw / videoAspect;
      const boxY = (ch - boxH) / 2 + (framing.offsetY * ch * 0.01);

      if (framing.innerShadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 30;
      }
      ctx.drawImage(primaryVideo, 0, boxY, boxW, boxH);
      ctx.restore();
      break;
    }

    case 'custom-scale': {
      // User defined custom scale and Y offset
      ctx.save();
      ctx.fillStyle = '#090a0f';
      ctx.fillRect(0, 0, cw, ch);

      ctx.filter = filterStr;
      const baseW = cw;
      const baseH = cw / videoAspect;
      const scaledW = baseW * (framing.customScale / 100);
      const scaledH = baseH * (framing.customScale / 100);
      const posX = (cw - scaledW) / 2;
      const posY = (ch - scaledH) / 2 + (framing.offsetY * ch * 0.01);

      if (framing.innerShadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 24;
      }

      if (framing.innerBorderRadius > 0) {
        drawRoundedRect(ctx, posX, posY, scaledW, scaledH, framing.innerBorderRadius);
        ctx.clip();
      }

      ctx.drawImage(primaryVideo, posX, posY, scaledW, scaledH);
      ctx.restore();
      break;
    }
  }

  // 2. Grain & Vignette Effects
  if (grading.vignette) {
    ctx.save();
    const vigGrad = ctx.createRadialGradient(cw / 2, ch / 2, cw * 0.4, cw / 2, ch / 2, cw * 0.85);
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vigGrad.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
  }

  // 3. AI Auto Title
  if (branding.autoTitle?.enabled && (branding.autoTitle.title || '').trim()) {
    ctx.save();
    const titleX = (cw * (branding.autoTitle.positionX ?? 50)) / 100;
    const titleY = (ch * (branding.autoTitle.positionY ?? 10)) / 100;
    const fontName = branding.autoTitle.fontFamily || 'Montserrat';
    const fontSize = Math.round((branding.autoTitle.fontSize || 16) * (cw / 360));
    ctx.font = `900 ${fontSize}px "${fontName}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = branding.autoTitle.color || '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 12;
    ctx.fillText((branding.autoTitle.title || '').toUpperCase(), titleX, titleY);
    ctx.restore();
  }

  // 4. Top Hook Banner
  if (branding.showHookTitle && branding.hookTitle.trim()) {
    ctx.save();
    const bannerX = (cw * (branding.bannerPositionX ?? 50)) / 100;
    const bannerY = (ch * (branding.bannerPositionY ?? 6)) / 100;
    ctx.font = '800 22px "Montserrat", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textMetrics = ctx.measureText(branding.hookTitle.toUpperCase());
    const boxPadX = 20;
    const boxHeight = 40;
    const boxWidth = textMetrics.width + boxPadX * 2;
    const boxX = bannerX - boxWidth / 2;

    if (branding.bannerShowBackground !== false) {
      // Badge background
      ctx.fillStyle = branding.hookBgColor || '#bef264';
      drawRoundedRect(ctx, boxX, bannerY - boxHeight / 2, boxWidth, boxHeight, 8);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.fillText(branding.hookTitle.toUpperCase(), bannerX, bannerY);
    } else {
      // Transparent background - clean bold punch text with shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = branding.hookBgColor || '#bef264';
      ctx.fillText(branding.hookTitle.toUpperCase(), bannerX, bannerY);
    }
    ctx.restore();
  }

  // 5. Dynamic Live Subtitles
  renderCaptions(ctx, cw, ch, currentTime, words, captions);

  // 6. Watermark / Handle
  if (branding.showWatermark && branding.creatorHandle.trim()) {
    ctx.save();
    const watermarkX = (cw * (branding.watermarkPositionX ?? 20)) / 100;
    const watermarkY = (ch * (branding.watermarkPositionY ?? 92)) / 100;
    ctx.font = '600 14px "JetBrains Mono", "Plus Jakarta Sans", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(branding.creatorHandle, watermarkX, watermarkY);
    ctx.restore();
  }

  // 6. Progress Bar
  if (branding.progressBar !== 'none') {
    ctx.save();
    const duration = primaryVideo.duration || 1;
    const progress = Math.min(1, Math.max(0, currentTime / duration));
    const barHeight = 6;
    const barY = ch - barHeight;

    if (branding.progressBar === 'rainbow') {
      const grad = ctx.createLinearGradient(0, barY, cw, barY);
      grad.addColorStop(0, '#f43f5e');
      grad.addColorStop(0.33, '#eab308');
      grad.addColorStop(0.66, '#10b981');
      grad.addColorStop(1, '#06b6d4');
      ctx.fillStyle = grad;
    } else if (branding.progressBar === 'accent') {
      ctx.fillStyle = '#10b981';
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    }

    ctx.fillRect(0, barY, cw * progress, barHeight);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Renders high-converting word-by-word dynamic captions without background banners
 */
function renderCaptions(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  time: number,
  words: TranscriptWord[],
  captions: CaptionConfig
) {
  // If captions are turned off or font size is 0, do not render!
  if (!captions.enabled || captions.fontSize <= 0) return;
  if (!words || words.length === 0) return;

  // Find active segment
  const activeWordIndex = words.findIndex(w => time >= w.start && time <= w.end);
  if (activeWordIndex === -1) return;

  const chunkSize = captions.maxWordsPerBeat || 3;
  const chunkStart = Math.floor(activeWordIndex / chunkSize) * chunkSize;
  const currentChunk = words.slice(chunkStart, chunkStart + chunkSize);

  const centerX = (cw * captions.positionX) / 100;
  const posY = (ch * captions.positionY) / 100;
  ctx.save();

  // Dynamic rotating viral color for CapCut
  const capcutColors = ['#bef264', '#facc15', '#38bdf8', '#fb7185', '#fb923c', '#c084fc'];
  const capcutActiveColor = capcutColors[Math.abs(activeWordIndex) % capcutColors.length];

  switch (captions.style) {
    case 'capcut-emoji': {
      // CapCut Auto-Emoji Pop style: ONLY ONE WITH EMOJIS!
      const baseFontSize = captions.fontSize + 6;
      ctx.font = `900 ${baseFontSize}px "Montserrat", "Plus Jakarta Sans", sans-serif`;
      ctx.textBaseline = 'middle';

      const activeItem = currentChunk.find(w => time >= w.start && time <= w.end);
      const emojiChar = activeItem?.emoji || '🔥';

      // Measure words
      let totalWidth = 0;
      const measured = currentChunk.map(w => {
        const text = (captions.uppercase ? w.word.toUpperCase() : w.word) + ' ';
        const wWidth = ctx.measureText(text).width;
        totalWidth += wWidth;
        return { text, wWidth, isActive: time >= w.start && time <= w.end };
      });

      // Render contextual emoji floating on top of active word
      if (emojiChar) {
        ctx.save();
        ctx.font = `${baseFontSize + 6}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(emojiChar, centerX, posY - baseFontSize * 0.9);
        ctx.restore();
      }

      // Render clean floating text with heavy shadow (NO background box!)
      let startX = centerX - totalWidth / 2;
      measured.forEach(item => {
        ctx.save();
        ctx.textAlign = 'left';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;

        if (item.isActive) {
          ctx.fillStyle = capcutActiveColor;
          ctx.shadowColor = `${capcutActiveColor}90`;
          ctx.shadowBlur = 12;
        } else {
          ctx.fillStyle = '#ffffff';
        }
        ctx.fillText(item.text, startX, posY);
        ctx.restore();
        startX += item.wWidth;
      });
      break;
    }

    case 'hormozi': {
      // Alex Hormozi style: NO BOX, pure bold typography with yellow highlight
      ctx.font = `800 ${captions.fontSize + 6}px "Bebas Neue", "Plus Jakarta Sans", Impact, sans-serif`;
      ctx.textBaseline = 'middle';

      let totalWidth = 0;
      const measured = currentChunk.map(w => {
        const text = (captions.uppercase ? w.word.toUpperCase() : w.word) + ' ';
        const wWidth = ctx.measureText(text).width;
        totalWidth += wWidth;
        return { text, wWidth, isActive: time >= w.start && time <= w.end };
      });

      let startX = centerX - totalWidth / 2;
      measured.forEach(item => {
        ctx.save();
        ctx.textAlign = 'left';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;

        if (item.isActive) {
          ctx.fillStyle = '#facc15';
          ctx.shadowColor = 'rgba(250, 204, 21, 0.7)';
          ctx.shadowBlur = 14;
        } else {
          ctx.fillStyle = '#ffffff';
        }
        ctx.fillText(item.text, startX, posY);
        ctx.restore();
        startX += item.wWidth;
      });
      break;
    }

    case 'mrbeast': {
      // MrBeast style: NO BOX, thick black stroke outline
      ctx.font = `900 ${captions.fontSize + 8}px "Syne", "Plus Jakarta Sans", Impact, sans-serif`;
      ctx.textBaseline = 'middle';

      let totalWidth = 0;
      const measured = currentChunk.map(w => {
        const text = (captions.uppercase ? w.word.toUpperCase() : w.word) + ' ';
        const wWidth = ctx.measureText(text).width;
        totalWidth += wWidth;
        return { text, wWidth, isActive: time >= w.start && time <= w.end };
      });

      let startX = centerX - totalWidth / 2;
      measured.forEach(item => {
        ctx.save();
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = item.isActive ? '#22c55e' : '#ffffff';

        if (item.isActive) {
          ctx.translate(startX + item.wWidth / 2, posY);
          ctx.scale(1.15, 1.15);
          ctx.strokeText(item.text, -item.wWidth / 2, 0);
          ctx.fillText(item.text, -item.wWidth / 2, 0);
        } else {
          ctx.strokeText(item.text, startX, posY);
          ctx.fillText(item.text, startX, posY);
        }
        ctx.restore();
        startX += item.wWidth;
      });
      break;
    }

    case 'neon': {
      // Cyber Neon: NO BOX, glowing neon text bloom
      ctx.font = `800 ${captions.fontSize + 4}px "Righteous", "Plus Jakarta Sans", sans-serif`;
      ctx.textBaseline = 'middle';

      const fullText = currentChunk.map(w => captions.uppercase ? w.word.toUpperCase() : w.word).join(' ');
      const totalWidth = ctx.measureText(fullText).width;
      let startX = centerX - totalWidth / 2;

      currentChunk.forEach(item => {
        const text = (captions.uppercase ? item.word.toUpperCase() : item.word) + ' ';
        const wWidth = ctx.measureText(text).width;
        const isActive = time >= item.start && time <= item.end;

        ctx.save();
        if (isActive) {
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 24;
          ctx.fillStyle = '#38bdf8';
        } else {
          ctx.shadowColor = 'rgba(0,0,0,0.9)';
          ctx.shadowBlur = 6;
          ctx.fillStyle = '#e0f2fe';
        }
        ctx.textAlign = 'left';
        ctx.fillText(text, startX, posY);
        ctx.restore();
        startX += wWidth;
      });
      break;
    }

    case 'red-punch': {
      // Red Alert Punch: NO BOX, crimson text with heavy black drop shadow
      ctx.font = `900 ${captions.fontSize + 4}px "Montserrat", sans-serif`;
      ctx.textBaseline = 'middle';

      let totalWidth = 0;
      const measured = currentChunk.map(w => {
        const text = (captions.uppercase ? w.word.toUpperCase() : w.word) + ' ';
        const wWidth = ctx.measureText(text).width;
        totalWidth += wWidth;
        return { text, wWidth, isActive: time >= w.start && time <= w.end };
      });

      let startX = centerX - totalWidth / 2;
      measured.forEach(item => {
        ctx.save();
        ctx.textAlign = 'left';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;

        if (item.isActive) {
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = 'rgba(239, 68, 68, 0.7)';
          ctx.shadowBlur = 12;
        } else {
          ctx.fillStyle = '#ffffff';
        }
        ctx.fillText(item.text, startX, posY);
        ctx.restore();
        startX += item.wWidth;
      });
      break;
    }

    case 'comic-pop': {
      // Comic Pop with angle: NO BOX
      ctx.save();
      ctx.translate(centerX, posY);
      ctx.rotate(-0.035);
      ctx.font = `900 ${captions.fontSize + 4}px "Righteous", cursive`;
      ctx.textBaseline = 'middle';

      let totalWidth = 0;
      const measured = currentChunk.map(w => {
        const text = (captions.uppercase ? w.word.toUpperCase() : w.word) + ' ';
        const wWidth = ctx.measureText(text).width;
        totalWidth += wWidth;
        return { text, wWidth, isActive: time >= w.start && time <= w.end };
      });

      let startX = -totalWidth / 2;
      measured.forEach(item => {
        ctx.save();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = item.isActive ? '#fbbf24' : '#ffffff';
        ctx.strokeText(item.text, startX, 0);
        ctx.fillText(item.text, startX, 0);
        ctx.restore();
        startX += item.wWidth;
      });
      ctx.restore();
      break;
    }

    case 'karaoke':
    default: {
      // Karaoke glow style: NO BOX
      ctx.font = `700 ${captions.fontSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.textBaseline = 'middle';
      const fullText = currentChunk.map(w => captions.uppercase ? w.word.toUpperCase() : w.word).join(' ');
      const totalWidth = ctx.measureText(fullText).width;
      let startX = centerX - totalWidth / 2;

      currentChunk.forEach(item => {
        const text = (captions.uppercase ? item.word.toUpperCase() : item.word) + ' ';
        const wWidth = ctx.measureText(text).width;
        const isActive = time >= item.start && time <= item.end;

        ctx.save();
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.strokeText(text, startX, posY);

        ctx.fillStyle = isActive ? '#facc15' : '#ffffff';
        ctx.fillText(text, startX, posY);
        ctx.restore();

        startX += wWidth;
      });
      break;
    }
  }

  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  if (radius <= 0) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
