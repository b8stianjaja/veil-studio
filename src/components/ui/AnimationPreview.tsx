import React, { useEffect, useRef, useState } from 'react';
import { useAnimationStore } from '../../store/useAnimationStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { StudioEngine } from '../../core/StudioEngine';
import { X, Play, Pause } from 'lucide-react';

export const AnimationPreview: React.FC = () => {
  const {
    rows,
    columns,
    fps,
    isPlaying,
    showPreview,
    setShowPreview,
    togglePlayback,
    activeFrame
  } = useAnimationStore();

  const projectConfig = useCanvasStore((state) => state.projectConfig);
  const layerUpdateTick = useCanvasStore((state) => state.layerUpdateTick);
  const globalUpdateTick = useCanvasStore((state) => state.globalUpdateTick);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!isPlaying) {
      setPreviewFrame(activeFrame);
    }
  }, [activeFrame, isPlaying]);

  useEffect(() => {
    if (!isPlaying || !showPreview) return;

    let lastTime = performance.now();
    let frameId: number;
    const interval = fps > 0 ? 1000 / fps : 1000;
    const totalFrames = rows * columns;

    const loop = (time: number) => {
      if (time - lastTime >= interval) {
        setPreviewFrame((prev) => (prev + 1) % totalFrames);
        lastTime = time - ((time - lastTime) % interval);
      }
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, showPreview, fps, rows, columns]);

  useEffect(() => {
    if (!showPreview || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const compCanvas = StudioEngine.getInstance().getCompositeCanvas();
    const logicalW = projectConfig.width / columns;
    const logicalH = projectConfig.height / rows;

    const aspect = logicalW / logicalH;
    const displayW = 200;
    const displayH = Math.round(displayW / aspect);

    canvasRef.current.width = displayW;
    canvasRef.current.height = displayH;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, displayW, displayH);

    const checkerSize = 10;
    for (let i = 0; i < displayW; i += checkerSize) {
      for (let j = 0; j < displayH; j += checkerSize) {
        ctx.fillStyle = (Math.floor(i / checkerSize) + Math.floor(j / checkerSize)) % 2 === 0 ? '#1a1a1a' : '#222';
        ctx.fillRect(i, j, checkerSize, checkerSize);
      }
    }

    if (compCanvas) {
      // High-DPI Physical Pixel Mapping for extraction
      const dpr = window.devicePixelRatio || 1;
      const physicalW = (projectConfig.width * dpr) / columns;
      const physicalH = (projectConfig.height * dpr) / rows;
      
      const col = previewFrame % columns;
      const row = Math.floor(previewFrame / columns);
      
      const srcX = col * physicalW;
      const srcY = row * physicalH;

      ctx.drawImage(
        compCanvas,
        srcX, srcY, physicalW, physicalH,
        0, 0, displayW, displayH
      );
    }
  }, [previewFrame, showPreview, projectConfig, columns, rows, layerUpdateTick, globalUpdateTick]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (!showPreview) return null;
  const totalFrames = rows * columns;

  return (
    <div
      className="absolute z-[9999] bg-bg-panel border border-border-strong shadow-[0_10px_40px_rgba(0,0,0,0.6)] rounded-md flex flex-col overflow-hidden select-none"
      style={{ top: position.y, left: position.x, width: 200 }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 bg-bg-app border-b border-border-subtle cursor-move"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary pointer-events-none">
          Live Preview
        </span>
        <button
          onClick={() => setShowPreview(false)}
          className="text-text-muted hover:text-text-primary transition"
          onPointerDown={(e) => e.stopPropagation()} 
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex items-center justify-center p-2 min-h-[150px] bg-[#111]">
        <canvas
          ref={canvasRef}
          className="shadow-md outline outline-1 outline-border-subtle"
          style={{ imageRendering: 'pixelated', maxWidth: '100%', maxHeight: '100%' }}
        />
      </div>

      <div className="flex items-center justify-between px-3 py-2 bg-bg-app border-t border-border-subtle">
        <button
          onClick={togglePlayback}
          className={`p-1.5 rounded-md transition shadow-sm border border-border-subtle ${
            isPlaying ? 'bg-accent text-white' : 'bg-bg-input hover:bg-bg-hover text-text-secondary hover:text-text-primary'
          }`}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <span className="text-[10px] text-text-muted font-mono tracking-widest bg-bg-input px-2 py-1 rounded border border-border-subtle">
          FRM {String(previewFrame + 1).padStart(2, '0')} / {String(totalFrames).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
};