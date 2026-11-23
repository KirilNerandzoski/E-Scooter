import { useEffect, useRef, type RefObject } from 'react';

interface SuminagashiCanvasProps {
  className?: string;
  /** Optional ref to hero copy container so ink lines flow edge-to-edge without overlapping text. */
  safeZoneRef?: RefObject<HTMLElement | null>;
}

/**
 * Renders delicate feathered indigo suminagashi ink currents sweeping full-width
 * from the right horizon all the way to the left navigation rail, while softly
 * parting around the hero text block so typography always remains crystal clear.
 */
export function SuminagashiCanvas({ className = '', safeZoneRef }: SuminagashiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationId = 0;
    let pointerX = 0.78;
    let pointerY = 0.42;
    let targetX = 0.78;
    let targetY = 0.42;
    let time = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reducedMotion) draw();
    };

    resize();
    window.addEventListener('resize', resize);

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        targetX = Math.max(0.1, Math.min(0.95, (e.clientX - rect.left) / rect.width));
        targetY = Math.max(0.08, Math.min(0.9, (e.clientY - rect.top) / rect.height));
      }
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';

      pointerX += (targetX - pointerX) * 0.035;
      pointerY += (targetY - pointerY) * 0.035;

      const dropX = width * (0.78 + (pointerX - 0.78) * 0.06);
      const dropY = height * (0.42 + (pointerY - 0.42) * 0.06);

      // Compute hero text safe-zone rectangle in canvas coordinates
      let safeBox: { left: number; top: number; right: number; bottom: number } | null = null;
      if (safeZoneRef?.current) {
        const cRect = canvas.getBoundingClientRect();
        const tRect = safeZoneRef.current.getBoundingClientRect();
        safeBox = {
          left: tRect.left - cRect.left,
          top: tRect.top - cRect.top,
          right: tRect.right - cRect.left,
          bottom: tRect.bottom - cRect.top,
        };
      }

      // Flowing marbled ribbons spanning full width (x = 0 at the HOME rail to x = width)
      const ribbonCount = 26;
      for (let i = 0; i < ribbonCount; i++) {
        const ratio = i / (ribbonCount - 1);
        const alpha = 0.045 + Math.sin(ratio * Math.PI) * 0.145;
        const lineWidth = 0.7 + (i % 5 === 0 ? 1.4 : 0.45);

        ctx.beginPath();
        ctx.strokeStyle =
          i % 4 === 0
            ? `rgba(10, 26, 51, ${alpha * 1.15})`
            : i % 3 === 0
              ? `rgba(30, 45, 74, ${alpha})`
              : `rgba(96, 109, 128, ${alpha * 0.9})`;
        ctx.lineWidth = lineWidth;

        const baseOffset = (ratio - 0.5) * height * 0.94;
        const steps = 80;
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          const x = u * width;

          const wave1 = Math.sin(u * 4.6 + time * 0.42 + ratio * 5.0) * (20 + ratio * 22);
          const wave2 = Math.cos(u * 8.0 - time * 0.28 + ratio * 3.1) * 9;

          let y = height * 0.42 + baseOffset + wave1 + wave2 - (u - 0.5) * height * 0.12;

          // Gentle vortex swirl around the ink drop point on the right
          const dx = x - dropX;
          const dy = y - dropY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 175) {
            const influence = Math.pow(1 - dist / 175, 2);
            const swirl = Math.sin(dist * 0.045 - time * 0.6) * 16 * influence;
            y += swirl + (dy / (dist + 1)) * 14 * influence;
          }

          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Concentric feathered suminagashi ink drop rings
      for (let r = 0; r < 7; r++) {
        const radius = 12 + r * 15 + Math.sin(time * 0.8 + r) * 1.8;
        ctx.beginPath();
        ctx.ellipse(
          dropX,
          dropY,
          radius * 1.24,
          radius * 0.78,
          -0.28 + r * 0.04,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = `rgba(10, 26, 51, ${Math.max(0.03, 0.24 - r * 0.03)})`;
        ctx.lineWidth = r === 0 ? 2 : 0.9;
        ctx.stroke();
      }

      // Deep indigo ink drop core
      const coreGrad = ctx.createRadialGradient(dropX, dropY, 1, dropX, dropY, 16);
      coreGrad.addColorStop(0, 'rgba(10, 26, 51, 0.78)');
      coreGrad.addColorStop(0.55, 'rgba(30, 45, 74, 0.28)');
      coreGrad.addColorStop(1, 'rgba(10, 26, 51, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(dropX, dropY, 16, 0, Math.PI * 2);
      ctx.fill();

      // Softly clear ONLY the hero text safe zone so lines reach the left HOME rail
      // cleanly without ever overlapping the headline or paragraph copy.
      if (safeBox) {
        const padX = 28;
        const padY = 18;
        const cx = (safeBox.left + safeBox.right) / 2;
        const cy = (safeBox.top + safeBox.bottom) / 2;
        const rx = Math.max(80, (safeBox.right - safeBox.left) / 2 + padX);
        const ry = Math.max(50, (safeBox.bottom - safeBox.top) / 2 + padY);

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.translate(cx, cy);
        ctx.scale(1, ry / rx);
        const maskGrad = ctx.createRadialGradient(0, 0, rx * 0.72, 0, 0, rx * 1.18);
        maskGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        maskGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.92)');
        maskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = maskGrad;
        ctx.beginPath();
        ctx.arc(0, 0, rx * 1.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (!reducedMotion) {
        time += 0.012;
        animationId = window.requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      if (animationId) window.cancelAnimationFrame(animationId);
    };
  }, [safeZoneRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    />
  );
}
