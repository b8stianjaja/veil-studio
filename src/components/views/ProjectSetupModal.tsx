import React, { useState, useRef } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { AutoSaveService } from '../../services/AutoSaveService';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { LayoutTemplate, Monitor, History } from 'lucide-react'; 

export const ProjectSetupModal: React.FC<{ hasAutoSave?: boolean }> = ({ hasAutoSave }) => {
  const { setProjectConfigured, setProjectConfig } = useCanvasStore();
  const [width, setWidth] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Cinematic entrance animations
    gsap.from('.hero-content', { y: 30, opacity: 0, duration: 1.2, ease: 'power3.out', stagger: 0.15 });
    gsap.from('.form-element', { x: 30, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1, delay: 0.3 });
  }, { scope: modalRef });

  const handleCreate = () => {
    let finalWidth = parseInt(width);
    let finalHeight = parseInt(height);
    
    if (isNaN(finalWidth)) finalWidth = 1024;
    else if (finalWidth < 128) finalWidth = 128;
    else if (finalWidth > 4096) finalWidth = 4096;
    
    if (isNaN(finalHeight)) finalHeight = 1024;
    else if (finalHeight < 128) finalHeight = 128;
    else if (finalHeight > 4096) finalHeight = 4096;

    // Smooth exit animation before unmounting
    gsap.to(modalRef.current, {
      opacity: 0,
      scale: 0.98,
      duration: 0.5,
      ease: 'power2.inOut',
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
        opacity: 0,
        scale: 1.02,
        duration: 0.5,
        ease: 'power2.inOut',
        onComplete: () => {
          setProjectConfigured(true);
        }
      });
    } else {
      setIsRestoring(false);
    }
  };

  return (
    <div ref={modalRef} className="fixed inset-0 z-50 bg-bg-app flex font-sans text-text-primary overflow-hidden">
      
      {/* LEFT COLUMN - BRANDING & ATMOSPHERE */}
      <div className="hidden lg:flex w-[45%] relative flex-col justify-between p-16 border-r border-border-subtle bg-bg-panel overflow-hidden">
        {/* Abstract Mesh Gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_var(--color-accent)_0%,_transparent_60%)] opacity-[0.08]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_var(--color-accent)_0%,_transparent_50%)] opacity-[0.05]"></div>
        
        <div className="relative z-10 hero-content mt-10">
          <div className="flex items-center gap-4 mb-10">
            <div className="relative">
              <img src="/marisopa.png" alt="Veil Studio" className="w-14 h-14 drop-shadow-2xl relative z-10" />
              <div className="absolute inset-0 bg-accent/30 blur-xl rounded-full scale-150"></div>
            </div>
            <h1 className="text-3xl font-display tracking-[0.2em] uppercase font-bold text-text-primary">Veil Studio</h1>
          </div>
          <p className="text-text-secondary text-lg leading-relaxed max-w-md font-light">
            A harmonious digital environment bridging 2D painting and 3D referencing. Configure your canvas to begin.
          </p>
        </div>
        
        <div className="relative z-10 hero-content">
          <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Local Environment Active
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - INTERACTIVE FORM */}
      <div className="w-full lg:w-[55%] flex flex-col justify-center items-center p-8 sm:p-16 relative bg-bg-app">
        <div className="max-w-md w-full">
          
          <div className="mb-14 form-element">
            <h2 className="text-4xl font-display font-medium tracking-tight mb-4 text-text-primary">New Workspace</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Define the physical dimensions of your 2D canvas. The 3D viewport will scale naturally alongside it.
            </p>
          </div>

          <div className="space-y-6 mb-12">
            {/* Width Input */}
            <div className="form-element group">
              <label className="text-[11px] uppercase tracking-widest text-text-muted flex items-center gap-2 mb-3 font-semibold group-focus-within:text-accent transition-colors">
                <Monitor size={14} /> Canvas Width (px)
              </label>
              <input 
                type="number" 
                value={width}
                onChange={e => setWidth(e.target.value)}
                placeholder="1024"
                className="w-full bg-bg-panel border-2 border-border-subtle rounded-xl px-5 py-4 text-lg outline-none focus:border-accent focus:bg-bg-panel transition-all text-text-primary shadow-sm placeholder:text-text-muted/50"
                min="128" max="4096"
              />
            </div>

            {/* Height Input */}
            <div className="form-element group">
              <label className="text-[11px] uppercase tracking-widest text-text-muted flex items-center gap-2 mb-3 font-semibold group-focus-within:text-accent transition-colors">
                <LayoutTemplate size={14} /> Canvas Height (px)
              </label>
              <input 
                type="number" 
                value={height}
                onChange={e => setHeight(e.target.value)}
                placeholder="1024"
                className="w-full bg-bg-panel border-2 border-border-subtle rounded-xl px-5 py-4 text-lg outline-none focus:border-accent focus:bg-bg-panel transition-all text-text-primary shadow-sm placeholder:text-text-muted/50"
                min="128" max="4096"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-4 form-element">
            <button 
              onClick={handleCreate}
              className="relative overflow-hidden w-full bg-text-primary text-bg-app font-bold text-sm tracking-widest uppercase py-5 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:-translate-y-0.5 transition-all duration-300 group"
            >
              <span className="relative z-10">Initialize Studio</span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
            </button>

            {hasAutoSave && (
              <button 
                onClick={handleRestore}
                disabled={isRestoring}
                className="w-full flex items-center justify-center gap-3 bg-transparent border-2 border-border-strong text-text-secondary font-semibold text-sm tracking-wide py-4 rounded-xl hover:bg-bg-hover hover:text-text-primary hover:border-text-secondary transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <History size={16} className={isRestoring ? "animate-spin" : ""} />
                {isRestoring ? 'Restoring Context...' : 'Resume Previous Session'}
              </button>
            )}
          </div>

        </div>
      </div>
      
    </div>
  );
};