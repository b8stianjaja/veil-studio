// src/components/ui/NavigatorPanel.tsx
import React, { useRef, useState, useEffect } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';

export const NavigatorPanel: React.FC = () => {
  const { projectConfig, pan, zoom, setPan } = useCanvasStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Hardcode a nice aspect ratio for the navigator box (e.g., 200px max width)
  const navWidth = 240;
  const scale = navWidth / projectConfig.width;
  const navHeight = projectConfig.height * scale;

  // Assuming the viewport window (available screen space) is roughly known.
  // For a perfect minimap, you might want to export viewport dimensions to the store,
  // but we can approximate the viewbox size based on screen dimensions for now.
  const [viewportSize, setViewportSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate View Box inside the Minimap
  // Viewbox represents the visible area of the canvas
  const viewW = (viewportSize.w / zoom) * scale;
  const viewH = (viewportSize.h / zoom) * scale;
  const viewX = (-pan.x / zoom) * scale;
  const viewY = (-pan.y / zoom) * scale;

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    handlePointerMove(e);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Pointer position inside the navigator box
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert navigator coordinates back to pan coordinates, centering the box on the cursor
    const newPanX = -(x / scale) * zoom + (viewportSize.w / 2);
    const newPanY = -(y / scale) * zoom + (viewportSize.h / 2);

    setPan({ x: newPanX, y: newPanY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  return (
    <div className="flex flex-col p-4 border-b border-border-subtle bg-bg-panel">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Navigator</h3>
        <span className="text-[10px] text-text-muted">{Math.round(zoom * 100)}%</span>
      </div>
      
      <div className="flex justify-center items-center bg-bg-app rounded-lg p-2">
        <div 
          ref={containerRef}
          className="relative bg-bg-panel border border-border-strong rounded shadow-inner overflow-hidden cursor-crosshair touch-none"
          style={{ width: navWidth, height: navHeight }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Viewport Box Highlight */}
          <div 
            className="absolute border border-accent bg-accent/10 shadow-[0_0_0_999px_rgba(0,0,0,0.4)] pointer-events-none"
            style={{
              left: viewX,
              top: viewY,
              width: viewW,
              height: viewH,
            }}
          />
        </div>
      </div>
    </div>
  );
};