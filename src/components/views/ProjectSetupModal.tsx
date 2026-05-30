import React, { useState, useRef } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { AutoSaveService } from '../../services/AutoSaveService';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export const ProjectSetupModal: React.FC<{ hasAutoSave?: boolean }> = ({ hasAutoSave }) => {
  const { setProjectConfigured, setProjectConfig } = useCanvasStore();
  const [width, setWidth] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(modalRef.current, {
      y: 40, // Increased travel distance
      opacity: 0,
      scale: 0.9,
      duration: 0.7,
      ease: 'back.out(1.2)' // Adds a subtle, comfortable spring
    });
  });

  const handleCreate = () => {
    let finalWidth = parseInt(width);
    let finalHeight = parseInt(height);
    
    if (isNaN(finalWidth)) finalWidth = 1024;
    else if (finalWidth < 128) finalWidth = 128;
    else if (finalWidth > 4096) finalWidth = 4096;
    
    if (isNaN(finalHeight)) finalHeight = 1024;
    else if (finalHeight < 128) finalHeight = 128;
    else if (finalHeight > 4096) finalHeight = 4096;

    gsap.to(modalRef.current, {
      y: -30,
      opacity: 0,
      scale: 0.9,
      duration: 0.4,
      ease: 'back.in(1.2)', // Exit with anticipation physics
      onComplete: () => {
        setProjectConfig({ width: finalWidth, height: finalHeight });
        setProjectConfigured(true);
      }
    });
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    const restored = await AutoSaveService.checkAndRestoreAutoSave();
    if (restored) {
      gsap.to(modalRef.current, {
        y: -20,
        opacity: 0,
        scale: 0.95,
        duration: 0.4,
        ease: 'power3.in',
        onComplete: () => {
          setProjectConfigured(true);
        }
      });
    } else {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg-app flex items-center justify-center font-sans text-text-primary">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-bg-panel via-bg-app to-black opacity-80"></div>
      <div ref={modalRef} className="bg-bg-panel border border-border-subtle p-10 rounded-xl shadow-[0_0_80px_rgba(0,0,0,0.8)] max-w-sm w-full relative z-10">
        <h2 className="text-2xl font-display font-medium tracking-tight mb-2 text-text-primary">New Project</h2>
        <p className="text-xs text-text-secondary mb-8 leading-relaxed">Set the dimensions for your 2D painting canvas. The 3D modeling viewport will adapt automatically.</p>
        
        <div className="space-y-5 mb-10">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-text-muted block mb-2 font-semibold">Painting Canvas Width (px)</label>
            <input 
              type="number" 
              value={width}
              onChange={e => setWidth(e.target.value)}
              placeholder="1024"
              className="w-full bg-bg-app border border-border-subtle rounded-md px-4 py-3 text-sm outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong transition text-text-primary"
              min="128" max="4096"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-text-muted block mb-2 font-semibold">Painting Canvas Height (px)</label>
            <input 
              type="number" 
              value={height}
              onChange={e => setHeight(e.target.value)}
              placeholder="1024"
              className="w-full bg-bg-app border border-border-subtle rounded-md px-4 py-3 text-sm outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong transition text-text-primary"
              min="128" max="4096"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={handleCreate}
            className="w-full bg-text-primary text-bg-app font-semibold py-3 rounded-md shadow-md hover:shadow-lg hover:opacity-90 transition-all duration-300 transform active:scale-[0.98]"
          >
            Create Project
          </button>

          {hasAutoSave && (
            <button 
              onClick={handleRestore}
              disabled={isRestoring}
              className="w-full bg-bg-input border border-border-strong text-text-secondary font-semibold py-3 rounded-md hover:bg-bg-hover transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRestoring ? 'Restoring...' : 'Resume Previous Session'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
