import React, { useRef, useEffect, useState } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useSceneStore } from '../../store/useSceneStore';
import { ReferenceViewer } from '../3d/ReferenceViewer';
import { LayerSurface } from '../2d/LayerSurface';
import { InspectorPanel } from '../ui/InspectorPanel';
import { AnimationToolbar } from '../ui/AnimationToolbar';
import { AnimationPreview } from '../ui/AnimationPreview';
import { InputInterceptor } from '../../services/InputInterceptor';
import { StudioEngine } from '../../core/StudioEngine';
import { ExportService } from '../../services/ExportService';
import { 
  Pen, Move3d, MousePointer2, Eraser, Focus, Maximize, RotateCw, Hand, 
  PanelRight, ChevronDown, Download, Upload, Save, FilePlus, Sun, Moon,
  Pipette, PaintBucket, Square, Circle, Minus, BoxSelect, Image as ImageIcon, Move
} from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ToolType } from '../../types';

const BrushCursorOverlay: React.FC = () => {
  const workspace = useCanvasStore((state) => state.workspace);
  const tool = useCanvasStore((state) => state.tool);
  const brushSize = useCanvasStore((state) => state.brushSize);
  const zoom = useCanvasStore((state) => state.zoom);
  
  const [pos, setPos] = useState({ x: -1000, y: -1000 });
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (workspace !== 'PAINTING' || (tool !== 'BRUSH' && tool !== 'ERASER')) return null;

  const size = brushSize * zoom;

  return (
    <div 
      className="fixed rounded-full pointer-events-none z-[10000] border-[1.5px] border-white/70 mix-blend-difference shadow-[0_0_2px_rgba(0,0,0,0.5)]"
      style={{
        left: pos.x - size / 2,
        top: pos.y - size / 2,
        width: size,
        height: size,
        transform: 'translateZ(0)'
      }}
    />
  );
};

export const WorkspaceLayout: React.FC = () => {
  const { workspace, setWorkspace, tool, setTool, backgroundColor, autoSaveStatus, theme, toggleTheme, isSpritesheetMode, activeLayerBounds, activeLayerId, globalUpdateTick } = useCanvasStore();
  const { triggerCameraReset } = useSceneStore();
  const interceptContainerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [inspectorOpen, setInspectorOpen] = useState(window.innerWidth > 1024);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);

  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const pan = useCanvasStore((state) => state.pan);
  const zoom = useCanvasStore((state) => state.zoom);
  const localTransform = useRef({ x: pan.x, y: pan.y, z: zoom });

  useEffect(() => {
    if (tool === 'MOVE_2D' && workspace === 'PAINTING') {
      StudioEngine.getInstance().updateActiveLayerBounds();
    } else {
      useCanvasStore.getState().setActiveLayerBounds(null);
    }
  }, [tool, workspace, activeLayerId, globalUpdateTick]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1024) {
        setInspectorOpen(false);
      } else {
        setInspectorOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fileMenuOpen && !(e.target as Element).closest('.file-menu-container')) {
        setFileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [fileMenuOpen]);

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      ExportService.importProjectJSON(file);
      e.target.value = '';
      setFileMenuOpen(false);
    }
  };

  const handleImageImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      ExportService.importImage(file);
      e.target.value = '';
      setFileMenuOpen(false);
    }
  };

  useGSAP(() => {
    gsap.from('.gsap-toolbar .gsap-tool-btn', {
      x: -20,
      opacity: 0,
      stagger: 0.05,
      ease: 'power2.out',
      delay: 0.1
    });

    gsap.from('.gsap-topbar', {
      y: -20,
      opacity: 0,
      ease: 'power2.out',
      duration: 0.4
    });

    gsap.from('.gsap-canvas', {
      scale: 0.98,
      opacity: 0,
      ease: 'power2.out',
      duration: 0.5,
      delay: 0.2
    });
  }, { scope: layoutRef });

  const projectConfig = useCanvasStore((state) => state.projectConfig);
  const viewportRef = useRef<HTMLDivElement>(null);
  
  const panStart = useRef<{ x: number, y: number, panX: number, panY: number } | null>(null);
  const previousTool = useRef<ToolType>('BRUSH');
  const isCentered = useRef(false);

  useEffect(() => {
    if (!isCentered.current && viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const state = useCanvasStore.getState();
      const initialPanX = (rect.width - state.projectConfig.width) / 2;
      const initialPanY = (rect.height - state.projectConfig.height) / 2 - 20; 
      state.setPan({ x: initialPanX, y: initialPanY });
      localTransform.current = { x: initialPanX, y: initialPanY, z: state.zoom };
      isCentered.current = true;
    }
  }, [projectConfig.width, projectConfig.height]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.code === 'Space' && useCanvasStore.getState().workspace === 'PAINTING' && useCanvasStore.getState().tool !== 'PAN') {
        if (e.repeat) return;
        previousTool.current = useCanvasStore.getState().tool;
        useCanvasStore.getState().setTool('PAN');
      }

      const state = useCanvasStore.getState();
      const ws = state.workspace;
      const key = e.key.toLowerCase();
      
      if (ws === 'PAINTING') {
        if (key === 'b' || key === 'p') state.setTool('BRUSH');
        if (key === 'e') state.setTool('ERASER');
        if (key === 'h') state.setTool('PAN');
        if (key === 'v') state.setTool('MOVE_2D');
        if (key === 'i') state.setTool('EYEDROPPER');
        if (key === 'g') state.setTool('BUCKET');
        if (key === 'u') state.setTool('SHAPE_RECT');
        if (key === 'c') state.setTool('SHAPE_CIRCLE');
        if (key === 'l') state.setTool('SHAPE_LINE');
        
        if (key === '[') state.setBrushSettings({ size: Math.max(1, state.brushSize - 2) });
        if (key === ']') state.setBrushSettings({ size: Math.min(100, state.brushSize + 2) });
      } else if (ws === 'MODELING') {
        if (key === 'o') state.setTool('ORBIT');
        if (key === 'v' || key === 't' || key === 'g') state.setTool('SELECT');
        if (key === 'r') state.setTool('ROTATE');
        if (key === 's') state.setTool('SCALE');
        if (key === 'y') state.setTool('TRANSFORM_GIZMO');
        if (key === 'd' && e.shiftKey) {
          e.preventDefault();
          const sceneState = useSceneStore.getState();
          if (sceneState.selectedNodeId) {
            sceneState.duplicateNode(sceneState.selectedNodeId);
            state.setTool('SELECT');
          }
        }
        if (key === 'x' || e.key === 'Delete' || e.key === 'Backspace') {
          const sceneState = useSceneStore.getState();
          if (sceneState.selectedNodeId) {
            sceneState.removeNode(sceneState.selectedNodeId);
          }
        }
      }

      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          StudioEngine.getInstance().redo();
        } else {
          StudioEngine.getInstance().undo();
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && useCanvasStore.getState().workspace === 'PAINTING' && useCanvasStore.getState().tool === 'PAN') {
        if (previousTool.current !== 'PAN') {
          useCanvasStore.getState().setTool(previousTool.current);
        } else {
          useCanvasStore.getState().setTool('BRUSH');
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const handleWheelNative = (e: WheelEvent) => {
      const state = useCanvasStore.getState();
      if (state.workspace === 'MODELING') return;

      e.preventDefault();
      const isZooming = e.ctrlKey || e.metaKey || e.altKey;
      
      if (isZooming) {
        const zoomDelta = Math.exp(-e.deltaY * 0.005);
        const newZoom = Math.min(Math.max(0.05, localTransform.current.z * zoomDelta), 50);
        
        const container = viewportRef.current;
        if (container && canvasWrapperRef.current) {
          const rect = container.getBoundingClientRect();
          const pointerX = e.clientX - rect.left;
          const pointerY = e.clientY - rect.top;
          
          const zoomRatio = newZoom / localTransform.current.z;
          localTransform.current.x = pointerX - (pointerX - localTransform.current.x) * zoomRatio;
          localTransform.current.y = pointerY - (pointerY - localTransform.current.y) * zoomRatio;
          localTransform.current.z = newZoom;
          
          canvasWrapperRef.current.style.transform = `translate(${localTransform.current.x}px, ${localTransform.current.y}px) scale(${localTransform.current.z})`;
        }
      } else {
        const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
        
        localTransform.current.x -= dx;
        localTransform.current.y -= dy;
        
        if (canvasWrapperRef.current) {
          canvasWrapperRef.current.style.transform = `translate(${localTransform.current.x}px, ${localTransform.current.y}px) scale(${localTransform.current.z})`;
        }
      }

      clearTimeout((window as any).panTimer);
      (window as any).panTimer = setTimeout(() => {
        state.setPan({ x: localTransform.current.x, y: localTransform.current.y });
        state.setZoom(localTransform.current.z);
      }, 150);
    };

    const container = viewportRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheelNative, { passive: false });
    }
    
    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheelNative);
      }
    };
  }, []);

  const [isPanningActive, setIsPanningActive] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool === 'PAN' || e.button === 1) { 
      if (e.button === 1) e.preventDefault(); 
      setIsPanningActive(true);
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: localTransform.current.x,
        panY: localTransform.current.y
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    InputInterceptor.handlePointerDown(e, workspace, tool, projectConfig.width, projectConfig.height);
  };
  
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      
      localTransform.current.x = panStart.current.panX + dx;
      localTransform.current.y = panStart.current.panY + dy;
      
      if (canvasWrapperRef.current) {
        canvasWrapperRef.current.style.transform = `translate(${localTransform.current.x}px, ${localTransform.current.y}px) scale(${localTransform.current.z})`;
      }

      clearTimeout((window as any).panTimer);
      (window as any).panTimer = setTimeout(() => {
        const state = useCanvasStore.getState();
        state.setPan({ x: localTransform.current.x, y: localTransform.current.y });
      }, 150);

      return;
    }
    InputInterceptor.handlePointerMove(e, workspace, tool, projectConfig.width, projectConfig.height);
  };
  
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panStart.current) {
      setIsPanningActive(false);
      panStart.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      return;
    }
    InputInterceptor.handlePointerUp(e, workspace, tool);
  };

  const getCursor = () => {
    if (tool === 'PAN') return isPanningActive ? 'grabbing' : 'grab';
    if (workspace === 'PAINTING') {
      if (['BRUSH', 'ERASER'].includes(tool)) return 'none';
      if (['EYEDROPPER', 'SHAPE_RECT', 'SHAPE_CIRCLE', 'SHAPE_LINE'].includes(tool)) return 'crosshair';
      if (tool === 'MOVE_2D') return 'move';
      return 'crosshair';
    }
    return 'default';
  };

  return (
    <div ref={layoutRef} className="w-full h-[100dvh] bg-bg-app text-text-primary flex flex-col font-sans overflow-hidden">
      
      <BrushCursorOverlay />

      <div className="gsap-topbar h-14 bg-bg-panel border-b border-border-subtle flex items-center px-6 justify-between select-none z-30 shadow-md">
        <div className="flex items-center gap-6">
          <div className="font-display font-medium tracking-wide uppercase text-sm flex items-center gap-3 text-neutral-100">
            <img src="/marisopa.png" alt="Veil Studio Logo" className="w-8 h-8 object-contain" />
            <span className="w-2.5 h-2.5 rounded-full bg-white opacity-90 shadow-[0_0_12px_rgba(255,255,255,0.7)]"></span>
            Veil Studio
            <span className="text-[9px] font-normal tracking-widest text-text-muted ml-2 mt-0.5 opacity-80">
              {autoSaveStatus === 'saved' && '✓ SAVED'}
              {autoSaveStatus === 'saving' && 'SAVING...'}
              {autoSaveStatus === 'dirty' && 'UNSAVED'}
            </span>
          </div>

          <div className="relative file-menu-container flex items-center h-full">
            <button 
              className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-sm transition border border-border-subtle hover:border-border-strong bg-bg-input flex items-center gap-1.5"
              onClick={() => setFileMenuOpen(!fileMenuOpen)}
            >
              FILE <ChevronDown size={12} className={`transition-transform ${fileMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              onChange={handleImportProject}
              className="hidden" 
            />
            <input 
              type="file" 
              accept="image/png, image/jpeg, image/jpg" 
              ref={imageInputRef} 
              onChange={handleImageImport}
              className="hidden" 
            />
            {fileMenuOpen && (
              <div className="absolute top-10 left-0 w-48 bg-bg-panel border border-border-subtle rounded-md shadow-2xl py-1 z-50 overflow-hidden">
                <button 
                  className="w-full text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-red-400 hover:text-red-300 hover:bg-red-500/10 transition flex items-center gap-2 group"
                  onClick={async () => {
                    setFileMenuOpen(false);
                    if (confirm('Are you sure you want to start a new project? This will clear your current progress.')) {
                      const { del } = await import('idb-keyval');
                      await del('veil-autosave-project');
                      window.location.reload();
                    }
                  }}
                >
                  <FilePlus size={12} className="text-red-500 group-hover:text-red-400" /> New Project
                </button>
                <div className="h-px w-full bg-bg-hover my-1"></div>
                <button 
                  className="w-full text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-secondary hover:text-text-primary hover:bg-bg-input transition flex items-center gap-2 group"
                  onClick={() => {
                    setFileMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                >
                  <Upload size={12} className="text-text-muted group-hover:text-text-secondary" /> Import Project
                </button>
                <button 
                  className="w-full text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-secondary hover:text-text-primary hover:bg-bg-input transition flex items-center gap-2 group"
                  onClick={() => {
                    setFileMenuOpen(false);
                    imageInputRef.current?.click();
                  }}
                >
                  <ImageIcon size={12} className="text-text-muted group-hover:text-text-secondary" /> Import Image Layer
                </button>
                <button 
                  className="w-full text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-secondary hover:text-text-primary hover:bg-bg-input transition flex items-center gap-2 group"
                  onClick={() => {
                    setFileMenuOpen(false);
                    ExportService.exportProjectJSON();
                  }}
                >
                  <Save size={12} className="text-text-muted group-hover:text-text-secondary" /> Export Project
                </button>
                <div className="h-px w-full bg-bg-hover my-1"></div>
                <button 
                  className="w-full text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-secondary hover:text-text-primary hover:bg-bg-input transition flex items-center gap-2 group"
                  onClick={() => {
                    setFileMenuOpen(false);
                    ExportService.exportCompositePNG();
                  }}
                >
                  <Download size={12} className="text-text-muted group-hover:text-text-secondary" /> Export PNG
                </button>
              </div>
            )}
          </div>
          
          <div className="h-5 w-px bg-bg-hover"></div>
          
          <div className="flex gap-1.5 bg-bg-app p-1.5 rounded-md border border-border-subtle">
            <button 
              className={`px-3 sm:px-5 py-1.5 rounded-sm text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest transition-all ${
                workspace === 'MODELING' ? 'bg-bg-hover text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary hover:bg-bg-input'
              }`}
              onClick={() => setWorkspace('MODELING')}
            >
              Modeling
            </button>
            <button 
              className={`px-3 sm:px-5 py-1.5 rounded-sm text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest transition-all ${
                workspace === 'PAINTING' ? 'bg-bg-hover text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary hover:bg-bg-input'
              }`}
              onClick={() => setWorkspace('PAINTING')}
            >
              Painting
            </button>
          </div>
          
          <div className="flex gap-1">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-md bg-bg-input border border-border-subtle text-text-secondary hover:text-text-primary transition"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
              onClick={() => setInspectorOpen(!inspectorOpen)}
              className="p-2 rounded-md bg-bg-input border border-border-subtle text-text-secondary hover:text-text-primary transition"
              title="Toggle Inspector"
            >
              <PanelRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="gsap-toolbar w-16 bg-bg-panel border-r border-border-subtle flex flex-col items-center py-5 gap-5 z-10 shadow-xl relative">
          <div className="flex flex-col gap-3">
            
            {workspace === 'MODELING' && (
              <>
                <ToolButton icon={<Move3d size={18} />} id="ORBIT" active={tool === 'ORBIT'} onClick={() => setTool('ORBIT')} tooltip="Orbit Camera (O / Right-Click)" />
                <ToolButton icon={<MousePointer2 size={18} />} id="SELECT" active={tool === 'SELECT'} onClick={() => setTool('SELECT')} tooltip="Translate Node (V / T / G)" />
                <ToolButton icon={<RotateCw size={18} />} id="ROTATE" active={tool === 'ROTATE'} onClick={() => setTool('ROTATE')} tooltip="Rotate Node (R)" />
                <ToolButton icon={<Maximize size={18} />} id="SCALE" active={tool === 'SCALE'} onClick={() => setTool('SCALE')} tooltip="Scale Node (S)" />
                <ToolButton icon={<BoxSelect size={18} />} id="TRANSFORM_GIZMO" active={tool === 'TRANSFORM_GIZMO'} onClick={() => setTool('TRANSFORM_GIZMO')} tooltip="Universal Gizmo (Y)" />
                
                <div className="gsap-tool-btn w-8 h-px bg-neutral-800/50 my-2 shadow-[0_1px_0_rgba(255,255,255,0.02)]"></div>
                <ToolButton icon={<Focus size={18} />} id="RESET_CAMERA" active={false} onClick={triggerCameraReset} tooltip="Reset Camera" />
              </>
            )}

            {workspace === 'PAINTING' && (
              <>
                <ToolButton icon={<Move size={18} />} id="MOVE_2D" active={tool === 'MOVE_2D'} onClick={() => setTool('MOVE_2D')} tooltip="Move & Transform (V)" />
                <ToolButton icon={<Pen size={18} />} id="BRUSH" active={tool === 'BRUSH'} onClick={() => setTool('BRUSH')} tooltip="Paint Brush (B)" />
                <ToolButton icon={<Eraser size={18} />} id="ERASER" active={tool === 'ERASER'} onClick={() => setTool('ERASER')} tooltip="Eraser (E)" />
                <ToolButton icon={<Pipette size={18} />} id="EYEDROPPER" active={tool === 'EYEDROPPER'} onClick={() => setTool('EYEDROPPER')} tooltip="Eyedropper (I)" />
                <ToolButton icon={<PaintBucket size={18} />} id="BUCKET" active={tool === 'BUCKET'} onClick={() => setTool('BUCKET')} tooltip="Fill Bucket (G)" />
                
                <div className="gsap-tool-btn w-8 h-px bg-neutral-800/50 my-2 shadow-[0_1px_0_rgba(255,255,255,0.02)]"></div>
                
                <ToolButton icon={<Square size={18} />} id="SHAPE_RECT" active={tool === 'SHAPE_RECT'} onClick={() => setTool('SHAPE_RECT')} tooltip="Rectangle Shape (U)" />
                <ToolButton icon={<Circle size={18} />} id="SHAPE_CIRCLE" active={tool === 'SHAPE_CIRCLE'} onClick={() => setTool('SHAPE_CIRCLE')} tooltip="Circle Shape (C)" />
                <ToolButton icon={<Minus size={18} />} id="SHAPE_LINE" active={tool === 'SHAPE_LINE'} onClick={() => setTool('SHAPE_LINE')} tooltip="Line Tool (L)" />

                <div className="gsap-tool-btn w-8 h-px bg-neutral-800/50 my-2 shadow-[0_1px_0_rgba(255,255,255,0.02)]"></div>
                
                <ToolButton icon={<Hand size={18} />} id="PAN" active={tool === 'PAN'} onClick={() => setTool('PAN')} tooltip="Pan Canvas (H / Space)" />
                <div className="gsap-tool-btn w-8 h-px bg-neutral-800/50 my-2 shadow-[0_1px_0_rgba(255,255,255,0.02)]"></div>
                <ToolButton icon={<Focus size={18} />} id="RESET_CANVAS" active={false} onClick={() => {
                  const state = useCanvasStore.getState();
                  const container = viewportRef.current;
                  if (container && canvasWrapperRef.current) {
                     const rect = container.getBoundingClientRect();
                     const cx = (rect.width - state.projectConfig.width) / 2;
                     const cy = (rect.height - state.projectConfig.height) / 2;
                     
                     localTransform.current.x = cx;
                     localTransform.current.y = cy;
                     localTransform.current.z = 1;
                     
                     canvasWrapperRef.current.style.transform = `translate(${cx}px, ${cy}px) scale(1)`;
                     
                     state.setPan({ x: cx, y: cy });
                     state.setZoom(1);
                  }
                }} tooltip="Reset View" />
              </>
            )}

          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 bg-bg-app relative">
          
          {isSpritesheetMode && <AnimationPreview />}

          <div 
            ref={viewportRef}
            className="flex-1 overflow-hidden relative select-none"
            style={{
              backgroundImage: `radial-gradient(#222228 1px, transparent 1px)`,
              backgroundSize: `40px 40px`,
              backgroundPosition: `${pan.x % 40}px ${pan.y % 40}px`
            }}
          >
            <div 
              ref={canvasWrapperRef}
              style={{ 
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                width: projectConfig.width,
                height: projectConfig.height,
                willChange: 'transform'
              }} 
              className="absolute left-0 top-0"
            >
              <div 
                className="gsap-canvas relative shadow-[0_0_80px_rgba(0,0,0,0.8)] z-0 ring-1 ring-[#33333C] shrink-0 w-full h-full"
                style={{ backgroundColor }}
              >
                <ReferenceViewer />
                <LayerSurface />
                
                {tool === 'MOVE_2D' && activeLayerBounds && (
                  <div
                    className="absolute border border-blue-500 z-30 pointer-events-none"
                    style={{
                      left: activeLayerBounds.x,
                      top: activeLayerBounds.y,
                      width: activeLayerBounds.w,
                      height: activeLayerBounds.h,
                    }}
                  >
                    <div className="absolute w-2.5 h-2.5 bg-bg-panel border border-blue-500 -left-[5px] -top-[5px]" />
                    <div className="absolute w-2.5 h-2.5 bg-bg-panel border border-blue-500 -right-[5px] -top-[5px]" />
                    <div className="absolute w-2.5 h-2.5 bg-bg-panel border border-blue-500 -left-[5px] -bottom-[5px]" />
                    <div className="absolute w-2.5 h-2.5 bg-bg-panel border border-blue-500 -right-[5px] -bottom-[5px]" />
                    
                    <div className="absolute w-2.5 h-2.5 bg-bg-panel border border-blue-500 left-1/2 -top-[5px] -translate-x-1/2" />
                    <div className="absolute w-2.5 h-2.5 bg-bg-panel border border-blue-500 left-1/2 -bottom-[5px] -translate-x-1/2" />
                    <div className="absolute w-2.5 h-2.5 bg-bg-panel border border-blue-500 -left-[5px] top-1/2 -translate-y-1/2" />
                    <div className="absolute w-2.5 h-2.5 bg-bg-panel border border-blue-500 -right-[5px] top-1/2 -translate-y-1/2" />
                  </div>
                )}

                <div 
                  ref={interceptContainerRef}
                  className="absolute inset-0 z-40 touch-none"
                  style={{ 
                    pointerEvents: workspace === 'PAINTING' || tool === 'PAN' ? 'auto' : 'none',
                    cursor: getCursor()
                  }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                ></div>
              </div>
            </div>
          </div>

          {isSpritesheetMode && <AnimationToolbar />}

        </div>

        <div className={`
          absolute lg:relative right-0 top-0 bottom-0 z-50 
          transform transition-all duration-300 ease-in-out
          ${inspectorOpen ? 'translate-x-0 w-80 outline outline-1 outline-[#222228] lg:outline-none shadow-[-20px_0_40px_rgba(0,0,0,0.5)] lg:shadow-none' : 'translate-x-full lg:translate-x-0 lg:w-0 lg:min-w-0 overflow-hidden'}
          h-full bg-bg-panel
        `}>
          <div className="w-80 h-full">
            <InspectorPanel />
          </div>
        </div>
        
        {inspectorOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setInspectorOpen(false)}
          ></div>
        )}
        
      </div>
    </div>
  );
};

const ToolButton = ({ icon, active, onClick, tooltip }: any) => (
  <button
    title={tooltip}
    onClick={onClick}
    className={`gsap-tool-btn w-10 h-10 rounded-md flex items-center justify-center transition-all duration-200 ${
      active 
        ? 'bg-bg-hover text-text-primary shadow-[0_0_15px_rgba(255,255,255,0.05)] ring-1 ring-border-strong' 
        : 'text-text-muted hover:text-text-secondary hover:bg-bg-input'
    }`}
  >
    {icon}
  </button>
);