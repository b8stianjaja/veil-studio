import React, { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useAnimationStore } from '../../store/useAnimationStore';
import { StudioEngine } from '../../core/StudioEngine';
import { motion } from 'motion/react';

import { getFlattenedRenderLayers } from '../../utils/layerUtils';

const ReferenceGridOverlay: React.FC = () => {
  const referenceGrid = useCanvasStore((state) => state.referenceGrid);
  
  if (!referenceGrid.show) return null;

  return (
    <div 
      className="absolute inset-0 pointer-events-none z-[9997]"
      style={{ opacity: referenceGrid.opacity }}
    >
      <div 
        className="w-full h-full"
        style={{
          backgroundImage: `
            linear-gradient(to right, ${referenceGrid.color} 1px, transparent 1px),
            linear-gradient(to bottom, ${referenceGrid.color} 1px, transparent 1px)
          `,
          backgroundSize: `${100 / referenceGrid.cols}% ${100 / referenceGrid.rows}%`
        }}
      />
    </div>
  );
};

const HelperGridOverlay: React.FC = () => {
  const showGrid = useCanvasStore((state) => state.showGrid);
  const symmetryX = useCanvasStore((state) => state.symmetryX);
  const symmetryY = useCanvasStore((state) => state.symmetryY);
  
  if (!showGrid && !symmetryX && !symmetryY) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[9998] mix-blend-difference opacity-20">
      {showGrid && (
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `
              linear-gradient(to right, #fff 1px, transparent 1px),
              linear-gradient(to bottom, #fff 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}
        />
      )}
      {symmetryX && (
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-red-500 shadow-[0_0_8px_rgba(255,0,0,1)] mix-blend-normal opacity-100" />
      )}
      {symmetryY && (
        <div className="absolute top-1/2 left-0 right-0 h-px bg-red-500 shadow-[0_0_8px_rgba(255,0,0,1)] mix-blend-normal opacity-100" />
      )}
    </div>
  );
};

const AnimationOverlay: React.FC = () => {
  const { rows, columns, activeFrame, onionSkinFrames, onionSkinOpacity, isPlaying } = useAnimationStore();
  const workspace = useCanvasStore((state) => state.workspace);
  const isSpritesheetMode = useCanvasStore((state) => state.isSpritesheetMode);
  const { width, height } = useCanvasStore((state) => state.projectConfig);
  const tick = useCanvasStore((state) => state.layerUpdateTick);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const showOnion = workspace === 'PAINTING' && isSpritesheetMode && !isPlaying && onionSkinFrames > 0;

  const frameW = width / columns;
  const frameH = height / rows;
  const numFrames = rows * columns;
  
  const currentCol = activeFrame % columns;
  const currentRow = Math.floor(activeFrame / columns);
  
  const currX = currentCol * frameW;
  const currY = currentRow * frameH;

  useEffect(() => {
    if (!showOnion || !canvasRef.current || numFrames <= 1) return;
    
    const renderOnionSkin = () => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      const dpr = window.devicePixelRatio || 1;
      
      // Keep canvas resolution in PHYSICAL hardware space for 1:1 crisp drawing
      canvasRef.current.width = width * dpr;
      canvasRef.current.height = height * dpr;
      
      ctx.clearRect(0, 0, width * dpr, height * dpr);
      
      const compositeCanvas = StudioEngine.getInstance().getCompositeCanvas();
      if (!compositeCanvas) return;

      const physicalW = (width * dpr) / columns;
      const physicalH = (height * dpr) / rows;
      const destX = currentCol * physicalW;
      const destY = currentRow * physicalH;

      for (let i = 1; i <= onionSkinFrames; i++) {
        const prevFrame = (activeFrame - i + numFrames) % numFrames;
        
        const prevCol = prevFrame % columns;
        const prevRow = Math.floor(prevFrame / columns);
        
        const srcX = prevCol * physicalW;
        const srcY = prevRow * physicalH;
        
        ctx.globalAlpha = onionSkinOpacity * (1 - (i - 1) / onionSkinFrames);
        
        // Draw physical pixels from engine -> physical pixels on Onion Skin layer
        ctx.drawImage(
          compositeCanvas,
          srcX, srcY, physicalW, physicalH,
          destX, destY, physicalW, physicalH 
        );
      }
      ctx.globalAlpha = 1;
    };
    
    renderOnionSkin();
  }, [showOnion, activeFrame, onionSkinFrames, onionSkinOpacity, width, height, columns, rows, numFrames, currX, currY, frameW, frameH, tick]);

  if (workspace !== 'PAINTING' || !isSpritesheetMode) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[9999]">
      {showOnion && (
        <canvas 
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
      )}
      
      {/* Sprite Grid Lines (shows boundaries of all frames) */}
      {(columns > 1 || rows > 1) && !isPlaying && (
        <>
          <div 
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, #4488FF 1px, transparent 1px),
                linear-gradient(to bottom, #4488FF 1px, transparent 1px)
              `,
              backgroundSize: `${100 / columns}% ${100 / rows}%`
            }}
          />
          {/* Active Frame Highlight */}
          <div 
            className="absolute border border-accent bg-[#4488FF]/5 shadow-[0_0_10px_rgba(68,136,255,0.5)] transition-all duration-100 pointer-events-none"
            style={{
              left: `${(currX / width) * 100}%`,
              top: `${(currY / height) * 100}%`,
              width: `${(frameW / width) * 100}%`,
              height: `${(frameH / height) * 100}%`
            }}
          />
          {/* Dim other frames */}
          <div 
            className="absolute inset-0 bg-bg-app/40 pointer-events-none"
            style={{
              clipPath: `polygon(
                0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                ${(currX / width) * 100}% ${(currY / height) * 100}%, 
                ${((currX + frameW) / width) * 100}% ${(currY / height) * 100}%, 
                ${((currX + frameW) / width) * 100}% ${((currY + frameH) / height) * 100}%, 
                ${(currX / width) * 100}% ${((currY + frameH) / height) * 100}%, 
                ${(currX / width) * 100}% ${(currY / height) * 100}%
              )`
            }}
          />
        </>
      )}
    </div>
  );
};

export const LayerSurface: React.FC = () => {
  const layers = useCanvasStore((state) => state.layers);
  const globalOpacity = useCanvasStore((state) => state.globalOpacity);

  const getAggregatedVisibility = (layerId: string): boolean => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer || !layer.visible) return false;
    if (layer.parentId) {
      return getAggregatedVisibility(layer.parentId);
    }
    return true;
  };

  const getAggregatedOpacity = (layerId: string): number => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return 1;
    const parentOpacity = layer.parentId ? getAggregatedOpacity(layer.parentId) : 1;
    return (layer.opacity ?? 1) * parentOpacity;
  };

  const renderLayers = getFlattenedRenderLayers(layers);

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {renderLayers.map((layer) => (
        <LayerCanvas 
          key={layer.id} 
          layer={layer} 
          zIndex={layer.absoluteZIndex}
          visible={getAggregatedVisibility(layer.id)}
          opacity={getAggregatedOpacity(layer.id) * globalOpacity}
        />
      ))}
      <ReferenceGridOverlay />
      <HelperGridOverlay />
      <AnimationOverlay />
    </div>
  );
};

const LayerCanvas: React.FC<{ layer: any, zIndex: number, visible: boolean, opacity: number }> = ({ layer, zIndex, visible, opacity }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
    useEffect(() => {
    if (canvasRef.current) {
      StudioEngine.getInstance().registerLayer(layer.id, canvasRef.current);
      if (layer.buffer) {
        StudioEngine.getInstance().restoreLayerBuffer(layer.id, layer.buffer);
      }
    }
    return () => {
      // OBJECTIVE 2 FIX: Only unregister from DOM mapping, preserve layerCache
      StudioEngine.getInstance().unregisterLayer(layer.id);
    };
  }, [layer.id]);

  return (
    <motion.canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full"
      animate={{ opacity: visible ? opacity : 0 }}
      transition={{ duration: 0.2 }}
      style={{
        zIndex: zIndex,
        mixBlendMode: layer.blendMode || 'normal',
        pointerEvents: 'none'
      }}
    />
  );
};