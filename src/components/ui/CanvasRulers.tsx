import React, { useEffect, useRef } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';

const RULER_SIZE = 24; // Height of top ruler, width of left ruler

export const CanvasRulers: React.FC = () => {
  const { pan, zoom, projectConfig, showRulers, theme } = useCanvasStore();
  const topRulerRef = useRef<HTMLCanvasElement>(null);
  const leftRulerRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!showRulers) return;

    const drawRuler = (canvas: HTMLCanvasElement, isHorizontal: boolean) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = isHorizontal ? canvas.parentElement!.clientWidth : RULER_SIZE;
      const height = isHorizontal ? RULER_SIZE : canvas.parentElement!.clientHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // Styling based on theme
      const bgColor = theme === 'dark' ? '#1e1e1e' : '#f4f4f5';
      const textColor = theme === 'dark' ? '#a1a1aa' : '#71717a';
      const tickColor = theme === 'dark' ? '#3f3f46' : '#d4d4d8';

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = textColor;
      ctx.strokeStyle = tickColor;
      ctx.lineWidth = 1;
      ctx.font = '9px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = isHorizontal ? 'center' : 'right';

      // Determine step sizes based on zoom to prevent clutter
      let step = 100;
      if (zoom > 2) step = 10;
      else if (zoom > 1) step = 50;
      else if (zoom < 0.5) step = 200;
      else if (zoom < 0.2) step = 500;

      const startOffset = isHorizontal ? pan.x : pan.y;
      const length = isHorizontal ? width : height;

      // Calculate starting value mapped to canvas coordinates
      const startVal = -startOffset / zoom;
      const firstTick = Math.floor(startVal / step) * step;

      ctx.beginPath();
      for (let i = firstTick; i * zoom + startOffset < length; i += step) {
        const screenPos = Math.round(i * zoom + startOffset);
        
        if (screenPos >= 0) {
          if (isHorizontal) {
            ctx.moveTo(screenPos, RULER_SIZE - 4);
            ctx.lineTo(screenPos, RULER_SIZE);
            ctx.fillText(i.toString(), screenPos, RULER_SIZE / 2);
          } else {
            ctx.moveTo(RULER_SIZE - 4, screenPos);
            ctx.lineTo(RULER_SIZE, screenPos);
            
            // Rotate text for vertical ruler
            ctx.save();
            ctx.translate(RULER_SIZE / 2, screenPos);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(i.toString(), 0, 0);
            ctx.restore();
          }
        }
      }
      ctx.stroke();
      
      // Draw border
      ctx.strokeStyle = theme === 'dark' ? '#27272a' : '#e4e4e7';
      ctx.beginPath();
      if (isHorizontal) {
        ctx.moveTo(0, RULER_SIZE);
        ctx.lineTo(width, RULER_SIZE);
      } else {
        ctx.moveTo(RULER_SIZE, 0);
        ctx.lineTo(RULER_SIZE, height);
      }
      ctx.stroke();
    };

    if (topRulerRef.current) drawRuler(topRulerRef.current, true);
    if (leftRulerRef.current) drawRuler(leftRulerRef.current, false);

  }, [pan, zoom, projectConfig.width, projectConfig.height, showRulers, theme]);

  if (!showRulers) return null;

  return (
    <>
      <div className="absolute top-0 left-0 w-full z-40 pointer-events-auto" style={{ height: RULER_SIZE, paddingLeft: RULER_SIZE }}>
        <canvas ref={topRulerRef} className="w-full h-full cursor-s-resize" />
      </div>
      <div className="absolute top-0 left-0 h-full z-40 pointer-events-auto" style={{ width: RULER_SIZE, paddingTop: RULER_SIZE }}>
        <canvas ref={leftRulerRef} className="w-full h-full cursor-e-resize" />
      </div>
      {/* Corner Square */}
      <div className="absolute top-0 left-0 z-50 border-r border-b border-border-subtle bg-bg-panel" style={{ width: RULER_SIZE, height: RULER_SIZE }} />
    </>
  );
};