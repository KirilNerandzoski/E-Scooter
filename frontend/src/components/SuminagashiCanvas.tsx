import { useEffect, useRef } from 'react';

interface SuminagashiCanvasProps {
  className?: string;
}

/**
 * Renders delicate feathered indigo suminagashi ink currents drifting across paper-white water.
 * Respects prefers-reduced-motion and gently reacts to pointer movement.
 */
export function SuminagashiCanvas({ className = '' }: SuminagashiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationId = 0;
    let pointerX = 0.72;
    let pointerY = 0.36;
    let targetX = 0.72;
    let targetY = 0.36;
    let time = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

      pointerX += (targetX - pointerX) * 0.035;
      pointerY += (targetY - pointerY) * 0.035;

      const dropX = width * (0.76 + (pointerX - 0.72) * 0.08);
      const dropY = height * (0.36 + (pointerY - 0.36) * 0.08);

      // Flowing marbled ribbons sweeping diagonally across the upper-right basin
      const ribbonCount = 26;
      for (let i = 0; i < ribbonCount; i++) {
        const ratio = i / ribbonCount;
        const alpha = 0.035 + Math.sin(ratio * Math.PI) * 0.14;
        const lineWidth = 0.7 + (i % 5 === 0 ? 1.5 : 0.45);

        ctx.beginPath();
        ctx.strokeStyle =
          i % 4 === 0
            ? `rgba(10, 26, 51, ${alpha * 1.15})`
            : i % 3 === 0
              ? `rgba(30, 45, 74, ${alpha})`
              : `rgba(96, 109, 128, ${alpha * 0.9})`;
        ctx.lineWidth = lineWidth;

        const baseOffset = (ratio - 0.5) * height * 0.92;
        const steps = 64;
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          const x = width * (0.12 + u * 0.95);
          const wave1 = Math.sin(u * 4.4 + time * 0.45 + ratio * 5.2) * (24 + ratio * 26);
          const wave2 = Math.cos(u * 7.8 - time * 0.3 + ratio * 3.1) * 11;

          // Gentle vortex pull around the ink drop point
          let y = height * 0.38 + baseOffset + wave1 + wave2 - u * height * 0.14;
          const dx = x - dropX;
          const dy = y - dropY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 170) {
            const influence = Math.pow(1 - dist / 170, 2);
            const swirl = Math.sin(dist * 0.045 - time * 0.6) * 18 * influence;
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
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
    />
  );
}
