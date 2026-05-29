import React, { useEffect, useRef, useState } from 'react';
import { useAnimationStore } from '../../store/useAnimationStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { Play, Pause, SkipBack, SkipForward, Eye, EyeOff, Copy, Eraser, Download, Image } from 'lucide-react';
import { StudioEngine } from '../../core/StudioEngine';
import { ExportService } from '../../services/ExportService';

export const AnimationToolbar: React.FC = () => {
  const { 
    rows, columns, activeFrame, fps, isPlaying, showPreview, onionSkinFrames, onionSkinOpacity,
    setActiveFrame, togglePlayback, setFps, setShowPreview, setGrid, setOnionSkin
  } = useAnimationStore();
  const { workspace, activeLayerId } = useCanvasStore();
  
  const numFrames = rows * columns;
  const trackRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (isPlaying) {
      intervalId = setInterval(() => {
        setActiveFrame((useAnimationStore.getState().activeFrame + 1) % (rows * columns));
      }, 1000 / fps);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, fps, rows, columns, setActiveFrame]);

  const handleDuplicateToNext = () => {
    if (!activeLayerId) return;
    const targetFrame = (activeFrame + 1) % numFrames;
    StudioEngine.getInstance().duplicateFrame(activeLayerId, activeFrame, targetFrame, columns, rows);
    setActiveFrame(targetFrame);
  };

  const handleClearFrame = () => {
    if (!activeLayerId) return;
    StudioEngine.getInstance().clearFrame(activeLayerId, activeFrame, columns, rows);
  };

  const handleWebMExport = async () => {
    setIsExporting(true);
    await ExportService.exportAnimationWebM(fps, rows, columns);
    setTimeout(() => setIsExporting(false), 1000);
  };

  const handlePNGExport = async () => {
    await ExportService.exportCompositePNG();
  };

  if (workspace !== 'PAINTING') return null;

  return (
    <div className="min-h-[192px] bg-bg-panel border-t border-border-subtle flex flex-col z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] shrink-0">
      <div className="min-h-[48px] py-2 border-b border-border-subtle flex flex-wrap gap-3 items-center justify-between px-4 bg-bg-panel">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-bg-app rounded-md p-1 border border-border-subtle">
            <button 
              className="w-8 h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition"
              onClick={() => setActiveFrame((activeFrame - 1 + numFrames) % numFrames)}
            >
              <SkipBack size={14} />
            </button>
            <button 
              className={`w-8 h-7 flex items-center justify-center rounded transition ${isPlaying ? 'bg-bg-active text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}`}
              onClick={togglePlayback}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button 
              className="w-8 h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition"
              onClick={() => setActiveFrame((activeFrame + 1) % numFrames)}
            >
              <SkipForward size={14} />
            </button>
          </div>
          
          <div className="h-4 w-px bg-bg-active mx-2"></div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">FPS</span>
            <input 
              type="number" 
              value={fps} 
              onChange={e => setFps(parseInt(e.target.value) || 12)}
              className="w-12 bg-bg-app border border-border-subtle text-text-primary text-xs px-2 py-1 rounded outline-none focus:border-accent transition-colors" 
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-bg-app px-3 py-1.5 rounded-md border border-border-subtle">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">Grid Cols</span>
              <input 
                type="number" 
                min="1" max="64"
                value={columns} 
                onChange={e => setGrid(rows, parseInt(e.target.value) || 1)}
                className="w-10 bg-transparent text-text-primary text-xs outline-none border-b border-transparent focus:border-accent" 
              />
            </div>
            <div className="w-px h-3 bg-bg-active"></div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">Grid Rows</span>
              <input 
                type="number" 
                min="1" max="64"
                value={rows} 
                onChange={e => setGrid(parseInt(e.target.value) || 1, columns)}
                className="w-10 bg-transparent text-text-primary text-xs outline-none border-b border-transparent focus:border-accent" 
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-bg-app px-3 py-1.5 rounded-md border border-border-subtle">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">Onion Skins</span>
              <input 
                type="number" 
                min="0" max="10"
                value={onionSkinFrames} 
                onChange={e => {
                  let val = parseInt(e.target.value);
                  if (isNaN(val)) val = 0;
                  setOnionSkin(val, onionSkinOpacity);
                }}
                className="w-10 bg-transparent text-text-primary text-xs outline-none border-b border-transparent focus:border-accent" 
              />
            </div>
            <div className="w-px h-3 bg-bg-active"></div>
            <div className="flex items-center gap-2" title="Opacity">
              <Eye size={12} className="text-text-muted" />
              <input 
                type="number" 
                min="0" max="1" step="0.1"
                value={onionSkinOpacity} 
                onChange={e => {
                  let val = parseFloat(e.target.value);
                  if (isNaN(val)) val = 0;
                  setOnionSkin(onionSkinFrames, val);
                }}
                className="w-10 bg-transparent text-text-primary text-xs outline-none border-b border-transparent focus:border-accent" 
              />
            </div>
          </div>
          
          <button 
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all ${
              showPreview ? 'bg-accent/10 border-accent text-accent' : 'bg-bg-app border-border-subtle text-text-secondary hover:text-text-primary'
            }`}
          >
            {showPreview ? <Eye size={14} /> : <EyeOff size={14} />}
            <span className="text-[10px] uppercase font-semibold tracking-wider">Preview Popout</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-32 border-r border-border-subtle bg-bg-input flex flex-col items-center p-2 shrink-0 gap-2">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mt-1">Actions</div>
          
          <button 
            onClick={handleDuplicateToNext}
            className="w-full py-1.5 px-2 bg-bg-app hover:bg-bg-hover border border-border-subtle text-text-secondary hover:text-text-primary rounded-md flex items-center justify-start gap-2 text-[10px] font-semibold uppercase tracking-wider transition-colors"
          >
            <Copy size={12} /> Duplicate
          </button>
          
          <button 
            onClick={handleClearFrame}
            className="w-full py-1.5 px-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-md flex items-center justify-start gap-2 text-[10px] font-semibold uppercase tracking-wider transition-colors"
          >
            <Eraser size={12} /> Clear
          </button>

          <div className="w-full h-px bg-border-subtle my-1"></div>

          <button 
            onClick={handlePNGExport}
            className="w-full py-1.5 px-2 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent rounded-md flex items-center justify-start gap-2 text-[10px] font-semibold uppercase tracking-wider transition-colors"
          >
            <Image size={12} /> Export PNG
          </button>

          <button 
            onClick={handleWebMExport}
            disabled={isExporting}
            className="w-full py-1.5 px-2 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent rounded-md flex items-center justify-start gap-2 text-[10px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            <Download size={12} /> {isExporting ? 'Saving...' : 'Export Vid'}
          </button>

        </div>
        
        <div ref={trackRef} className="flex-1 overflow-x-auto overflow-y-hidden flex items-center px-4 gap-2 custom-scrollbar relative bg-bg-app">
          {Array.from({ length: numFrames }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 shrink-0 mt-2">
              <div className="text-[9px] font-mono text-neutral-600">{i + 1}</div>
              <button
                onClick={() => {
                  if (isPlaying) togglePlayback();
                  setActiveFrame(i);
                }}
                className={`h-[90px] w-[90px] rounded-md relative flex items-center justify-center transition-all group overflow-hidden ${
                  activeFrame === i 
                    ? 'bg-accent/10 z-10' 
                    : 'bg-bg-input border border-border-subtle hover:border-border-strong'
                }`}
              >
                <FrameThumbnail frameIndex={i} />
                
                {activeFrame === i && (
                  <div className="absolute inset-0 border-[2px] border-accent rounded-md pointer-events-none shadow-[inset_0_0_20px_rgba(68,136,255,0.2)]"></div>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const FrameThumbnail: React.FC<{ frameIndex: number }> = ({ frameIndex }) => {
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const { columns, rows, activeFrame } = useAnimationStore();
  const layerUpdateTick = useCanvasStore((state) => state.layerUpdateTick);
  const globalUpdateTick = useCanvasStore((state) => state.globalUpdateTick);
  
  const prevGlobalRef = useRef(globalUpdateTick);
  
  useEffect(() => {
    if (!thumbRef.current) return;
    
    // PERF FIX: Skip drawing this thumbnail if we aren't actively modifying it
    // Unless there was a global update (like duplicating, clearing, or deleting a layer entirely)
    const isTargetFrame = activeFrame === frameIndex;
    const isGlobalChange = prevGlobalRef.current !== globalUpdateTick;
    
    if (!isGlobalChange && !isTargetFrame) return;
    prevGlobalRef.current = globalUpdateTick;
    
    const ctx = thumbRef.current.getContext('2d');
    if (!ctx) return;
    
    const rafId = requestAnimationFrame(() => {
      const compositeCanvas = StudioEngine.getInstance().getCompositeCanvas();
      if (!compositeCanvas) return;
      
      const srcW = compositeCanvas.width / columns;
      const srcH = compositeCanvas.height / rows;
      const col = frameIndex % columns;
      const row = Math.floor(frameIndex / columns);
      
      ctx.clearRect(0, 0, thumbRef.current!.width, thumbRef.current!.height);
      
      const aspect = srcW / srcH;
      let drawW = 86;
      let drawH = 86;
      if (aspect > 1) { drawH = 86 / aspect; } else { drawW = 86 * aspect; }
      
      ctx.drawImage(
        compositeCanvas, 
        col * srcW, row * srcH, srcW, srcH, 
        (86 - drawW)/2, (86 - drawH)/2, drawW, drawH
      );
    });
    
    return () => cancelAnimationFrame(rafId);
  }, [frameIndex, columns, rows, layerUpdateTick, globalUpdateTick, activeFrame]);
  
  return (
    <canvas 
      ref={thumbRef} 
      width={86} 
      height={86} 
      className="absolute inset-0 object-contain w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" 
      style={{ imageRendering: 'pixelated' }}
    />
  );
};