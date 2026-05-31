import React, { useRef, useState } from 'react';
import { useSceneStore } from '../../store/useSceneStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { Download, Save, Upload, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Lock, Unlock, Trash2, Folder, FolderOpen, Eye, EyeOff, Video } from 'lucide-react';
import { ExportService } from '../../services/ExportService';
import { StudioEngine } from '../../core/StudioEngine';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Accordion } from './Accordion';
import { ColorPicker } from './ColorPicker';

export const InspectorPanel: React.FC = () => {
  const workspace = useCanvasStore(state => state.workspace);
  const backgroundColor = useCanvasStore(state => state.backgroundColor);
  const { width, height } = useCanvasStore(state => state.projectConfig);
  const setProjectConfig = useCanvasStore(state => state.setProjectConfig);
  const setBackgroundColor = useCanvasStore(state => state.setBackgroundColor);
  const isSpritesheetMode = useCanvasStore(state => state.isSpritesheetMode);
  const setIsSpritesheetMode = useCanvasStore(state => state.setIsSpritesheetMode);
  const panelRef = React.useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(panelRef.current, {
      x: 40,
      opacity: 0,
      ease: 'expo.out', // Snappier panel reveal
      duration: 0.8,
      delay: 0.1
    });
  }, { scope: panelRef });
  
  return (
    <div ref={panelRef} className="w-full h-full bg-bg-panel border-l border-border-subtle text-text-secondary flex flex-col uppercase text-xs tracking-wider z-10 shadow-3xl">
      <div className="p-5 border-b border-border-subtle flex items-center justify-between bg-bg-panel">
        <h2 className="font-display font-medium text-text-primary text-[12px] tracking-[0.2em] uppercase">Properties</h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
        <Accordion title="Canvas Properties">
          <div className="flex flex-col gap-3">
            <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase mb-1 block">Workspace Background</span>
            <ColorPicker 
              color={backgroundColor} 
              onChange={(newColor) => setBackgroundColor(newColor)} 
            />
            <div className="mt-2 border-t border-border-subtle pt-3">
               <div className="grid grid-cols-2 gap-2">
                 <div>
                   <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase mb-1 block">Width</span>
                   <input 
                     type="number"
                     min="128" max="4096"
                     value={width}
                     onChange={(e) => {
                       const val = parseInt(e.target.value);
                       if (!isNaN(val)) {
                         setProjectConfig({ width: val, height });
                         StudioEngine.getInstance().resizeAllLayers(val, height);
                       }
                     }}
                     className="w-full bg-bg-app border border-border-subtle rounded px-3 py-2 text-xs outline-none focus:border-border-strong transition text-text-primary"
                   />
                 </div>
                 <div>
                   <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase mb-1 block">Height</span>
                   <input 
                     type="number"
                     min="128" max="4096"
                     value={height}
                     onChange={(e) => {
                       const val = parseInt(e.target.value);
                       if (!isNaN(val)) {
                         setProjectConfig({ width, height: val });
                         StudioEngine.getInstance().resizeAllLayers(width, val);
                       }
                     }}
                     className="w-full bg-bg-app border border-border-subtle rounded px-3 py-2 text-xs outline-none focus:border-border-strong transition text-text-primary"
                   />
                 </div>
               </div>
            </div>
            
            {workspace === 'PAINTING' && (
              <div className="mt-2 border-t border-border-subtle pt-3">
                <div className="flex items-center justify-between">
                   <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase">Spritesheet Mode</span>
                   <button 
                     onClick={() => setIsSpritesheetMode(!isSpritesheetMode)}
                     className={`w-9 h-5 rounded-full relative transition-colors ${isSpritesheetMode ? 'bg-[#4488FF]' : 'bg-bg-input border border-border-strong'}`}
                   >
                     <div className={`absolute top-[1.5px] w-4 h-4 rounded-full bg-white transition-all duration-200 ${isSpritesheetMode ? 'left-[18px]' : 'left-[1.5px]'}`} />
                   </button>
                </div>
              </div>
            )}
            
          </div>
        </Accordion>
        {workspace === 'MODELING' ? <ThreeDControls /> : <TwoDControls />}
      </div>
    </div>
  );
};

  const ThreeDControls = () => {
  const [newViewName, setNewViewName] = useState('');
  
  const { 
    nodes, selectedNodeId, updateNode, addNode, removeNode, duplicateNode, // <-- Fixed: duplicateNode added here
    lights, updateLighting, 
    environment, updateEnvironment,
    camera, updateCamera, triggerCameraReset,
    savedViews, requestSaveView, removeSavedView, applySavedView
  } = useSceneStore();
  
  // Fixed: Explicit type to prevent implicit any
  const selectedNode = nodes.find((n: any) => n.id === selectedNodeId);
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(containerRef.current, {
      opacity: 0,
      y: 10,
      duration: 0.4,
      ease: 'power2.out',
    });
  }, []);

  return (
    <div ref={containerRef} className="flex flex-col">
      <Accordion title="Primitives">
        <div className="grid grid-cols-2 gap-2">
          {['CUBE', 'SPHERE', 'PLANE', 'CYLINDER', 'CONE'].map(type => (
            <button
              key={type}
              className="bg-bg-input hover:bg-bg-hover px-3 py-1.5 rounded-sm transition flex-1 border border-border-strong shadow-sm text-[10px] font-semibold tracking-widest text-text-secondary"
              onClick={() => addNode(type as any)}
            >
              {type}
            </button>
          ))}
        </div>
      </Accordion>

      <Accordion title="Camera" defaultExpanded={true}>
        <div className="space-y-4">
          
          {/* 1. Projection Paradigm */}
          <div>
            <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase mb-2 block">Projection Type</span>
            <div className="grid grid-cols-2 gap-2">
               <button 
                 onClick={() => updateCamera({ type: 'PERSPECTIVE' })}
                 className={`py-1.5 rounded-sm text-[10px] font-semibold tracking-wider uppercase transition-colors ${camera.type === 'PERSPECTIVE' ? 'bg-bg-active text-text-primary border border-border-strong shadow-sm' : 'bg-bg-input text-text-muted hover:bg-bg-hover border border-transparent'}`}
               >
                 Perspective
               </button>
               <button 
                 onClick={() => updateCamera({ type: 'ORTHOGRAPHIC' })}
                 className={`py-1.5 rounded-sm text-[10px] font-semibold tracking-wider uppercase transition-colors ${camera.type === 'ORTHOGRAPHIC' ? 'bg-bg-active text-text-primary border border-border-strong shadow-sm' : 'bg-bg-input text-text-muted hover:bg-bg-hover border border-transparent'}`}
               >
                 Isometric
               </button>
            </div>
          </div>

          {/* 2. Standard Views */}
          <div>
            <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase mb-2 block">Standard Views</span>
            <div className="grid grid-cols-3 gap-1">
               {[
                 { id: 'TOP', label: 'TOP', pos: [0, 10, 0] },
                 { id: 'FRONT', label: 'FRONT', pos: [0, 0, 10] },
                 { id: 'RIGHT', label: 'RIGHT', pos: [10, 0, 0] },
                 { id: 'BOTTOM', label: 'BOTTOM', pos: [0, -10, 0] },
                 { id: 'BACK', label: 'BACK', pos: [0, 0, -10] },
                 { id: 'LEFT', label: 'LEFT', pos: [-10, 0, 0] }
               ].map(preset => (
                 <button
                   key={preset.id}
                   onClick={() => {
                     updateCamera({ position: preset.pos as [number, number, number], target: [0, 0, 0] });
                     triggerCameraReset(); 
                   }}
                   className="py-1.5 bg-bg-input hover:bg-bg-hover text-text-secondary hover:text-text-primary rounded text-[9px] font-bold tracking-wider uppercase transition border border-border-strong shadow-sm"
                 >
                   {preset.label}
                 </button>
               ))}
            </div>
          </div>

          {/* 3. View Manager */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase block">Saved Views</span>
              <button 
                 onClick={() => updateCamera({ locked: !camera.locked })}
                 className={`py-1 px-2 flex items-center justify-center gap-1.5 rounded-sm text-[9px] font-bold tracking-wider uppercase transition-colors ${camera.locked ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-bg-input text-text-muted hover:bg-bg-hover hover:text-text-primary border border-border-strong shadow-sm'}`}
               >
                 {camera.locked ? <Lock size={10}/> : <Unlock size={10}/>} 
                 {camera.locked ? 'Locked' : 'Unlocked'}
               </button>
            </div>
            
            <div className="flex gap-1 mb-2">
               <input 
                 type="text" 
                 value={newViewName}
                 onChange={(e) => setNewViewName(e.target.value)}
                 placeholder="Name current view..."
                 className="flex-1 bg-bg-app border border-border-subtle rounded-sm px-2 py-1 text-[10px] outline-none focus:border-border-strong transition text-text-primary"
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' && newViewName.trim()) {
                     requestSaveView(newViewName.trim());
                     setNewViewName('');
                   }
                 }}
               />
               <button 
                 onClick={() => {
                   if (newViewName.trim()) {
                     requestSaveView(newViewName.trim());
                     setNewViewName('');
                   }
                 }}
                 disabled={!newViewName.trim()}
                 className="px-2.5 py-1 bg-bg-input hover:bg-bg-active text-text-primary border border-border-strong disabled:opacity-30 disabled:pointer-events-none rounded-sm transition text-[10px] font-bold shadow-sm"
               >
                 <Video size={12} />
               </button>
            </div>

            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar pr-1">
              {savedViews.length === 0 ? (
                <div className="text-[9px] text-text-muted italic text-center py-2 bg-bg-input/50 rounded-sm border border-border-subtle border-dashed">
                  No custom views saved
                </div>
              ) : (
                savedViews.map((view: any) => (  // <-- Fixed: explicitly typed view to clear the warning
                  <div key={view.id} className="flex items-center justify-between group bg-bg-input border border-border-subtle hover:border-border-strong rounded-sm px-2 py-1 transition-colors cursor-pointer" onClick={() => applySavedView(view.id)}>
                    <span className="flex-1 text-[10px] text-text-secondary group-hover:text-text-primary font-medium truncate">
                      {view.name}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSavedView(view.id); }}
                      className="text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                      title="Delete View"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4. Dynamic Lens Properties */}
          <div className="pt-2 border-t border-border-subtle">
            {camera.type === 'PERSPECTIVE' ? (
              <>
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase">Field of View</span>
                  <span className="text-[10px] text-text-muted font-mono">{camera.fov}°</span>
                </div>
                <input 
                  type="range" 
                  min="20" max="120" step="1"
                  value={camera.fov}
                  onChange={(e) => updateCamera({ fov: parseInt(e.target.value) })}
                  className="w-full"
                />
              </>
            ) : (
              <>
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase">Ortho Scale</span>
                  <span className="text-[10px] text-text-muted font-mono">{camera.zoom}</span>
                </div>
                <input 
                  type="range" 
                  min="10" max="200" step="1"
                  value={camera.zoom || 50}
                  onChange={(e) => updateCamera({ zoom: parseInt(e.target.value) })}
                  className="w-full"
                />
              </>
            )}
          </div>
          
        </div>
      </Accordion>

      <Accordion title="Environment" defaultExpanded={false}>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
             <button 
               onClick={() => updateEnvironment({ gridVisible: !environment.gridVisible })}
               className={`py-1.5 rounded-sm text-[10px] font-semibold tracking-wider uppercase transition-colors ${environment.gridVisible ? 'bg-bg-active text-text-primary' : 'bg-bg-input text-text-muted hover:bg-bg-hover'}`}
             >
               Grid
             </button>
             <button 
               onClick={() => updateEnvironment({ axesVisible: !environment.axesVisible })}
               className={`py-1.5 rounded-sm text-[10px] font-semibold tracking-wider uppercase transition-colors ${environment.axesVisible ? 'bg-bg-active text-text-primary' : 'bg-bg-input text-text-muted hover:bg-bg-hover'}`}
             >
               Axes
             </button>
             <button 
               onClick={() => updateEnvironment({ snapToGrid: !environment.snapToGrid })}
               className={`py-1.5 rounded-sm text-[10px] font-semibold tracking-wider uppercase transition-colors ${environment.snapToGrid ? 'bg-bg-active text-text-primary' : 'bg-bg-input text-text-muted hover:bg-bg-hover'}`}
             >
               Snap
             </button>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase">Grid Size</span>
              <span className="text-[10px] text-text-muted font-mono">{environment.gridSize}</span>
            </div>
            <input 
              type="range" 
              min="2" max="50" step="2"
              value={environment.gridSize}
              onChange={(e) => updateEnvironment({ gridSize: parseInt(e.target.value) })}
            />
          </div>
        </div>
      </Accordion>

      {selectedNode && (
        <>
          <Accordion title="Transform">
            <div className="space-y-3">
              {(
                [
                  { label: 'Position', prop: 'position' },
                  { label: 'Rotation', prop: 'rotation' },
                  { label: 'Scale', prop: 'scale' }
                ] as const
              ).map(({ label, prop }) => (
                <div key={prop}>
                   <span className="text-[10px] text-text-muted mb-1 block">{label}</span>
                   <div className="flex gap-1">
                     {['X', 'Y', 'Z'].map((axis, i) => (
                        <div key={axis} className="flex-1 flex bg-bg-app border border-border-subtle rounded-sm overflow-hidden focus-within:border-border-strong transition-colors">
                          <span className="bg-bg-input px-2 py-1 flex items-center justify-center font-bold tracking-widest text-[#666677] text-[9px] border-r border-border-subtle select-none">{axis}</span>
                          <input 
                            type="number"
                            step={prop === 'scale' ? 0.1 : 1}
                            value={selectedNode[prop][i] ?? (prop === 'scale' ? 1 : 0)}
                            onChange={(e) => {
                              const str = e.target.value;
                              const val = str === '' ? 0 : (parseFloat(str) || 0);
                              
                              const current = [...selectedNode[prop]] as [number, number, number];
                              current[i] = val;
                              
                              updateNode(selectedNode.id, { [prop]: current });
                            }}
                            className="w-full bg-transparent p-1 text-xs outline-none text-center font-mono text-text-secondary"
                          />
                        </div>
                     ))}
                   </div>
                </div>
              ))}
              
              <div className="pt-2 border-t border-border-subtle mt-2 flex gap-2">
                 <button
                   className="flex-1 bg-bg-input hover:bg-bg-hover border border-border-strong text-text-secondary py-1.5 rounded transition flex items-center justify-center gap-2 font-semibold tracking-wider text-[10px] uppercase"
                   onClick={() => duplicateNode(selectedNode.id)}
                 >
                   Duplicate
                 </button>
                 <button
                   className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-1.5 rounded transition flex items-center justify-center gap-2 border border-red-500/20 font-semibold tracking-wider text-[10px] uppercase"
                   onClick={() => removeNode(selectedNode.id)}
                 >
                   <Trash2 size={12} /> Delete
                 </button>
              </div>
            </div>
          </Accordion>

          <Accordion title="Material & Rendering">
            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-text-muted mb-1 block">Color</span>
              <ColorPicker 
                color={selectedNode.color} 
                onChange={(newColor) => updateNode(selectedNode.id, { color: newColor })} 
              />
              </div>

              <div className="grid grid-cols-2 gap-2">
                 <button 
                   onClick={() => updateNode(selectedNode.id, { visible: selectedNode.visible === false })}
                   className={`py-1.5 rounded-sm text-[10px] font-semibold tracking-wider uppercase transition-colors ${selectedNode.visible !== false ? 'bg-bg-active text-text-primary' : 'bg-bg-input text-text-muted hover:bg-bg-hover'}`}
                 >
                   Visible
                 </button>
                 <button 
                   onClick={() => updateNode(selectedNode.id, { wireframe: !selectedNode.wireframe })}
                   className={`py-1.5 rounded-sm text-[10px] font-semibold tracking-wider uppercase transition-colors ${selectedNode.wireframe ? 'bg-bg-active text-text-primary' : 'bg-bg-input text-text-muted hover:bg-bg-hover'}`}
                 >
                   Wireframe
                 </button>
                 <button 
                   onClick={() => updateNode(selectedNode.id, { castShadow: selectedNode.castShadow === false })}
                   className={`py-1.5 rounded-sm text-[10px] font-semibold tracking-wider uppercase transition-colors ${selectedNode.castShadow !== false ? 'bg-bg-active text-text-primary' : 'bg-bg-input text-text-muted hover:bg-bg-hover'}`}
                 >
                   Cast Shadow
                 </button>
                 <button 
                   onClick={() => updateNode(selectedNode.id, { receiveShadow: selectedNode.receiveShadow === false })}
                   className={`py-1.5 rounded-sm text-[10px] font-semibold tracking-wider uppercase transition-colors ${selectedNode.receiveShadow !== false ? 'bg-bg-active text-text-primary' : 'bg-bg-input text-text-muted hover:bg-bg-hover'}`}
                 >
                   Recv Shadow
                 </button>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase">Roughness</span>
                  <span className="text-[10px] text-text-muted font-mono">{(selectedNode.roughness ?? 0.5).toFixed(2)}</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="1" step="0.05" 
                  value={selectedNode.roughness ?? 0.5}
                  onChange={(e) => updateNode(selectedNode.id, { roughness: parseFloat(e.target.value) })}
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase">Metalness</span>
                  <span className="text-[10px] text-text-muted font-mono">{(selectedNode.metalness ?? 0.1).toFixed(2)}</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="1" step="0.05" 
                  value={selectedNode.metalness ?? 0.1}
                  onChange={(e) => updateNode(selectedNode.id, { metalness: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </Accordion>
        </>
      )}

      <Accordion title="Global Lighting" defaultExpanded={false}>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase">Directional Intensity</span>
              <span className="text-[10px] text-text-muted font-mono">{lights.intensity.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="0" max="5" step="0.1" 
              value={lights.intensity}
              onChange={(e) => updateLighting({ intensity: parseFloat(e.target.value) })}
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase">Ambient Intensity</span>
              <span className="text-[10px] text-text-muted font-mono">{(lights.ambientIntensity ?? 1).toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="0" max="5" step="0.1" 
              value={lights.ambientIntensity ?? 1}
              onChange={(e) => updateLighting({ ambientIntensity: parseFloat(e.target.value) })}
            />
          </div>
          <div>
             <span className="text-[10px] text-text-muted mb-1 block font-semibold tracking-widest uppercase">Light Color</span>
            <ColorPicker 
              color={lights.color} 
              onChange={(newColor) => updateLighting({ color: newColor })} 
            />
          </div>
           <div>
             <span className="text-[10px] text-text-muted mb-1 block">Direction (XYZ)</span>
             <div className="flex gap-1">
               {['X', 'Y', 'Z'].map((axis, i) => (
                  <div key={axis} className="flex-1 flex bg-bg-app border border-border-subtle rounded-sm overflow-hidden focus-within:border-border-strong transition-colors">
                    <span className="bg-bg-input px-2 py-1 flex items-center justify-center font-bold tracking-widest text-[#666677] text-[9px] border-r border-border-subtle select-none">{axis}</span>
                    <input 
                      type="number"
                      step={1}
                      value={lights.angle[i]}
                      onChange={(e) => {
                        const str = e.target.value;
                        const val = str === '' ? 0 : (parseFloat(str) || 0);
                        const current = [...lights.angle] as [number, number, number];
                        current[i] = val;
                        updateLighting({ angle: current });
                      }}
                      className="w-full bg-transparent p-1 text-xs outline-none text-center font-mono text-text-secondary"
                    />
                  </div>
               ))}
             </div>
          </div>
        </div>
      </Accordion>
    </div>
  );
};

const TwoDControls = () => {
  const { layers, activeLayerId, setActiveLayer, addLayer, updateLayer, removeLayer, brushSize, brushColor, brushOpacity, brushHardness, brushFlow, setBrushSettings, reorderLayers, showGrid, setShowGrid, symmetryX, setSymmetry, symmetryY, referenceGrid, setReferenceGrid } = useCanvasStore();
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(containerRef.current, {
      opacity: 0,
      y: 10,
      duration: 0.4,
      ease: 'power2.out',
    });
  }, []);

    return (
    <div ref={containerRef} className="flex flex-col">
      <NavigatorWindow /> {/* <-- Add it right here at the top of 2D Controls */}

      <Accordion title="Precision Tools">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button 
              onClick={() => setShowGrid(!showGrid)}
              className={`py-1.5 rounded-sm text-[10px] font-semibold tracking-wider uppercase transition-colors ${showGrid ? 'bg-bg-active text-text-primary' : 'bg-bg-input text-text-muted hover:bg-bg-hover'}`}
            >
              Helper Grid
            </button>
            <button 
              onClick={() => setSymmetry('X', !symmetryX)}
              className={`py-1.5 rounded-sm text-[10px] font-semibold tracking-wider uppercase transition-colors ${symmetryX ? 'bg-bg-active text-text-primary' : 'bg-bg-input text-text-muted hover:bg-bg-hover'}`}
            >
              Sym X
            </button>
            <button 
              onClick={() => setSymmetry('Y', !symmetryY)}
              className={`py-1.5 rounded-sm text-[10px] font-semibold tracking-wider uppercase transition-colors ${symmetryY ? 'bg-bg-active text-text-primary' : 'bg-bg-input text-text-muted hover:bg-bg-hover'}`}
            >
              Sym Y
            </button>
          </div>
        </div>
      </Accordion>

      <Accordion title="Reference Grid" defaultExpanded={false}>
        <div className="space-y-3">
          <button 
            onClick={() => setReferenceGrid({ show: !referenceGrid.show })}
            className={`w-full py-1.5 rounded-sm text-[10px] font-semibold tracking-wider uppercase transition-colors ${referenceGrid.show ? 'bg-bg-active text-text-primary' : 'bg-bg-input text-text-muted hover:bg-bg-hover'}`}
          >
            Show Reference Grid
          </button>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase">Rows</span>
              <span className="text-[10px] text-text-muted font-mono">{referenceGrid.rows}</span>
            </div>
            <input 
              type="range" 
              min="1" max="64" 
              value={referenceGrid.rows}
              onChange={(e) => setReferenceGrid({ rows: parseInt(e.target.value) })}
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase">Columns</span>
              <span className="text-[10px] text-text-muted font-mono">{referenceGrid.cols}</span>
            </div>
            <input 
              type="range" 
              min="1" max="64" 
              value={referenceGrid.cols}
              onChange={(e) => setReferenceGrid({ cols: parseInt(e.target.value) })}
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase">Opacity</span>
              <span className="text-[10px] text-text-muted font-mono">{Math.round(referenceGrid.opacity * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="1" step="0.05"
              value={referenceGrid.opacity}
              onChange={(e) => setReferenceGrid({ opacity: parseFloat(e.target.value) })}
            />
          </div>
          <div>
             <span className="text-[10px] text-text-muted mb-1 block font-semibold tracking-widest uppercase">Color</span>
            <ColorPicker 
              color={referenceGrid.color} 
              onChange={(newColor) => setReferenceGrid({ color: newColor })} 
            />
          </div>
        </div>
      </Accordion>

      <Accordion title="Brush Properties">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase">Size</span>
              <span className="text-[10px] text-text-muted font-mono">{brushSize}px</span>
            </div>
            <input 
              type="range" 
              min="1" max="100" 
              value={brushSize}
              onChange={(e) => setBrushSettings({ size: parseInt(e.target.value) })}
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase">Opacity</span>
              <span className="text-[10px] text-text-muted font-mono">{Math.round((brushOpacity || 1) * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0.01" max="1" step="0.01"
              value={brushOpacity || 1}
              onChange={(e) => setBrushSettings({ opacity: parseFloat(e.target.value) })}
              className="w-full accent-neutral-300"
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase">Hardness</span>
              <span className="text-[10px] text-text-muted font-mono">{brushHardness}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="100" 
              value={brushHardness}
              onChange={(e) => setBrushSettings({ hardness: parseInt(e.target.value) })}
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-text-muted font-semibold tracking-widest uppercase">Flow</span>
              <span className="text-[10px] text-text-muted font-mono">{brushFlow}%</span>
            </div>
            <input 
              type="range" 
              min="1" max="100" 
              value={brushFlow}
              onChange={(e) => setBrushSettings({ flow: parseInt(e.target.value) })}
            />
          </div>
          <div>
             <span className="text-[10px] text-text-muted mb-1 block">Color</span>
              <ColorPicker 
                color={brushColor} 
                onChange={(newColor) => setBrushSettings({ color: newColor })} 
              />
          </div>
        </div>
      </Accordion>

      <Accordion title="Canvas Actions" defaultExpanded={true}>
        <div className="flex flex-col gap-2">
           <div className="grid grid-cols-2 gap-2 mb-2">
             <button
               className="py-1.5 bg-bg-input hover:bg-bg-hover active:scale-95 text-text-secondary rounded transition border border-border-strong text-[10px] uppercase font-semibold tracking-wider"
               onClick={() => StudioEngine.getInstance().undo()}
             >
               Undo
             </button>
             <button
               className="py-1.5 bg-bg-input hover:bg-bg-hover active:scale-95 text-text-secondary rounded transition border border-border-strong text-[10px] uppercase font-semibold tracking-wider"
               onClick={() => StudioEngine.getInstance().redo()}
             >
               Redo
             </button>
           </div>
           <button
             className="w-full bg-red-500/10 hover:bg-red-500/20 active:scale-95 text-red-400 py-1.5 rounded transition flex items-center justify-center gap-2 border border-red-500/20"
             onClick={() => {
               layers.forEach(l => {
                 if (!l.locked) StudioEngine.getInstance().clearLayer(l.id);
               });
             }}
           >
             <Trash2 size={12} /> Clear Visible Canvas
           </button>
        </div>
      </Accordion>

      <Accordion title="Layer Stack">
        <div className="flex justify-end mb-3 gap-2">
          <button 
            className="text-[10px] bg-bg-input hover:bg-bg-hover px-2.5 py-1.5 rounded-sm text-text-secondary transition duration-200 flex items-center gap-1 font-semibold border border-border-strong"
            onClick={() => useCanvasStore.getState().addFolder()}
          >
            + NEW FOLDER
          </button>
          <button 
            className="text-[10px] bg-bg-input hover:bg-bg-hover px-2.5 py-1.5 rounded-sm text-text-secondary transition duration-200 flex items-center gap-1 font-semibold border border-border-strong"
            onClick={() => addLayer()}
          >
            + NEW LAYER
          </button>
        </div>
        <div className="space-y-2">
          {layers.filter(l => !l.parentId).sort((a, b) => b.order - a.order).map((layer) => {
            return (
              <LayerItemNode 
                key={layer.id} 
                layer={layer} 
                allLayers={layers}
              />
            );
          })}
        </div>
      </Accordion>
    </div>
  );
};

// ... LayerThumbnail and LayerItemNode unchanged below ...
const LayerThumbnail = ({ layerId }: { layerId: string }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const tick = useCanvasStore(state => state.layerUpdateTick[layerId]);

  React.useEffect(() => {
    if (canvasRef.current) {
      const sourceCanvas = StudioEngine.getInstance().getFrameBuffer(layerId);
      if (sourceCanvas) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          const scale = Math.min(32 / sourceCanvas.width, 32 / sourceCanvas.height);
          const w = sourceCanvas.width * scale;
          const h = sourceCanvas.height * scale;
          const x = (32 - w) / 2;
          const y = (32 - h) / 2;
          
          ctx.drawImage(sourceCanvas, x, y, w, h);
        }
      }
    }
  }, [layerId, tick]);

  return (
    <div className="w-8 h-8 rounded-sm bg-bg-app border border-border-subtle shrink-0 overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMWExYTFmIi8+CjxyZWN0IHg9IjQiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMyMjIyMjgiLz4KPHJlY3QgeT0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iIzIyMjIyOCIvPgo8cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMWExYTFmIi8+Cjwvc3ZnPg==')]">
      <canvas 
        ref={canvasRef} 
        width={32} 
        height={32} 
        className="w-full h-full object-contain"
      />
    </div>
  );
};

const LayerItemNode = ({ layer, allLayers, depth = 0 }: any) => {
  const { activeLayerId, setActiveLayer, updateLayer, removeLayer, reorderLayers } = useCanvasStore();
  const itemRef = useRef<HTMLDivElement>(null);
  
  const { contextSafe } = useGSAP({ scope: itemRef });

  const onMouseEnter = contextSafe(() => {
    // Added a slight x offset to make it feel like picking up a card
    gsap.to(itemRef.current, { x: 4, scale: 1.02, duration: 0.3, ease: 'back.out(2)' });
  });

  const onMouseLeave = contextSafe(() => {
    gsap.to(itemRef.current, { x: 0, scale: 1, duration: 0.3, ease: 'power3.out' });
  });

  const children = allLayers
    .filter((l: any) => l.parentId === layer.id)
    .sort((a: any, b: any) => b.order - a.order);

  const isFolder = layer.type === 'FOLDER';

  return (
    <div className="flex flex-col gap-1">
      <div 
        ref={itemRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`p-2 rounded-md flex flex-col border cursor-pointer gap-2 ${
          activeLayerId === layer.id 
            ? 'border-border-strong bg-bg-input' 
            : 'border-transparent hover:bg-bg-input/50 transition-colors duration-200'
        }`}
        style={{ marginLeft: `${depth * 12}px` }}
        onClick={(e) => {
          e.stopPropagation();
          setActiveLayer(layer.id);
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 overflow-hidden">
            {isFolder && (
              <button 
                onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { expanded: !layer.expanded }); }}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                {layer.expanded ? <FolderOpen size={14} /> : <Folder size={14} />}
              </button>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }}
              className="text-text-muted hover:text-text-primary shrink-0 transition-colors p-0.5 rounded"
            >
              {layer.visible ? <Eye size={14} /> : <EyeOff size={14} className="opacity-50" />}
            </button>
            {!isFolder && <LayerThumbnail layerId={layer.id} />}
            <input
              type="text"
              value={layer.name}
              onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className={`${isFolder ? 'font-bold' : ''} bg-transparent border-none outline-none text-neutral-100 flex-1 min-w-0 text-[11px] uppercase tracking-wider mb-0.5`}
            />
          </div>
          
          <div className="flex items-center gap-2">
            {!isFolder && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  StudioEngine.getInstance().clearLayer(layer.id);
                }}
                disabled={layer.locked}
                className="text-text-muted hover:text-red-400 text-[10px] disabled:opacity-30 disabled:pointer-events-none"
              >
                CLEAR
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateLayer(layer.id, { locked: !layer.locked });
              }}
              className={`p-1 rounded transition ${layer.locked ? 'text-text-secondary hover:text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
              title={layer.locked ? "Unlock" : "Lock"}
            >
              {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeLayer(layer.id);
              }}
              disabled={layer.locked}
              className="p-1 text-text-muted hover:text-red-400 disabled:opacity-30 disabled:pointer-events-none transition"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        
        {activeLayerId === layer.id && !isFolder && (
          <div onClick={(e) => e.stopPropagation()} className="pt-2 pb-1 border-t border-border-strong flex flex-col gap-2 relative z-10 mt-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-text-muted font-semibold tracking-widest text-[9px] uppercase">Opacity</span>
              <span className="text-text-secondary">{Math.round((layer.opacity ?? 1) * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" max="1" step="0.01" 
              value={layer.opacity ?? 1}
              onChange={(e) => updateLayer(layer.id, { opacity: parseFloat(e.target.value) })}
            />
            <div className="flex justify-between items-center text-[10px] mt-1">
              <span className="text-text-muted font-semibold tracking-widest text-[9px] uppercase">Blend Mode</span>
              <select
                value={layer.blendMode || 'normal'}
                onChange={(e) => updateLayer(layer.id, { blendMode: e.target.value as any })}
                className="bg-bg-app border border-border-strong text-text-secondary rounded px-1.5 py-1 outline-none text-[10px] shadow-sm uppercase tracking-wider"
              >
                {['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'].map(mode => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 pl-6">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const sortedSameLevel = allLayers.filter((l: any) => l.parentId === layer.parentId).sort((a: any, b: any) => a.order - b.order);
              const idx = sortedSameLevel.findIndex((l: any) => l.id === layer.id);
              if (idx < sortedSameLevel.length - 1) {
                const swapWith = sortedSameLevel[idx + 1];
                updateLayer(layer.id, { order: swapWith.order });
                updateLayer(swapWith.id, { order: layer.order });
              }
            }}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-neutral-700 rounded transition"
            title="Bring Forward"
          >
            <ChevronUp size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const sortedSameLevel = allLayers.filter((l: any) => l.parentId === layer.parentId).sort((a: any, b: any) => a.order - b.order);
              const idx = sortedSameLevel.findIndex((l: any) => l.id === layer.id);
              if (idx > 0) {
                const swapWith = sortedSameLevel[idx - 1];
                updateLayer(layer.id, { order: swapWith.order });
                updateLayer(swapWith.id, { order: layer.order });
              }
            }}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-neutral-700 rounded transition"
            title="Send Backward"
          >
            <ChevronDown size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const sortedSameLevel = allLayers.filter((l: any) => l.parentId === layer.parentId).sort((a: any, b: any) => a.order - b.order);
              const idx = sortedSameLevel.findIndex((l: any) => l.id === layer.id);
              if (idx < sortedSameLevel.length - 1) {
                const possibleFolder = sortedSameLevel[idx + 1];
                if (possibleFolder.type === 'FOLDER') {
                  updateLayer(layer.id, { parentId: possibleFolder.id, order: allLayers.length });
                }
              }
            }}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-neutral-700 rounded transition"
            title="Indent into folder above"
          >
            <ChevronRight size={12} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (layer.parentId) {
                const parent = allLayers.find((l: any) => l.id === layer.parentId);
                if (parent) {
                  updateLayer(layer.id, { parentId: parent.parentId, order: parent.order - 0.5 });
                }
              }
            }}
            disabled={!layer.parentId}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-neutral-700 disabled:opacity-30 disabled:pointer-events-none rounded transition"
            title="Outdent"
          >
            <ChevronLeft size={12} />
          </button>
        </div>
      </div>
      
      {isFolder && layer.expanded && children.length > 0 && (
        <div className="flex flex-col gap-1 w-full">
          {children.map((child: any) => (
            <LayerItemNode key={child.id} layer={child} allLayers={allLayers} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

// ADD AT THE BOTTOM OF InspectorPanel.tsx

const NavigatorWindow: React.FC = () => {
  const { projectConfig, pan, zoom, setPan, globalUpdateTick } = useCanvasStore();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  
  // Render composite miniature on updates
  React.useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;
    const engine = StudioEngine.getInstance();
    const composite = engine.getCompositeCanvas(true);
    if (composite) {
      canvasRef.current.width = composite.width;
      canvasRef.current.height = composite.height;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(composite, 0, 0);
    }
  }, [globalUpdateTick, projectConfig, pan, zoom]);

  const handleDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return; // Only process left-click drag
    
    const rect = e.currentTarget.getBoundingClientRect();
    const u = (e.clientX - rect.left) / rect.width;
    const v = (e.clientY - rect.top) / rect.height;

    const targetX = u * projectConfig.width;
    const targetY = v * projectConfig.height;

    // Grab actual DOM dimension for the workspace wrapper, fallback to standard sizing
    const viewport = document.querySelector('.gsap-canvas')?.parentElement?.parentElement;
    const vw = viewport?.clientWidth || window.innerWidth - 320;
    const vh = viewport?.clientHeight || window.innerHeight;

    setPan({
      x: (vw / 2) - (targetX * zoom),
      y: (vh / 2) - (targetY * zoom)
    });
  };

  const aspect = projectConfig.width / projectConfig.height;

  return (
    <Accordion title="Navigator" defaultExpanded={true}>
      <div className="w-full flex items-center justify-center bg-[#1a1a1f] rounded border border-border-subtle p-2 mb-2">
        <div 
          className="relative cursor-move shadow-md bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMWExYTFmIi8+CjxyZWN0IHg9IjQiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMyMjIyMjgiLz4KPHJlY3QgeT0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iIzIyMjIyOCIvPgo8cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMWExYTFmIi8+Cjwvc3ZnPg==')] overflow-hidden"
          style={{
            width: aspect >= 1 ? '100%' : `${aspect * 100}%`,
            aspectRatio: `${projectConfig.width} / ${projectConfig.height}`
          }}
          onMouseMove={handleDrag}
          onMouseDown={handleDrag}
        >
          <canvas ref={canvasRef} className="w-full h-full pointer-events-none object-contain" />
          <ViewportBox />
        </div>
      </div>
    </Accordion>
  );
};

const ViewportBox: React.FC = () => {
  const { projectConfig, pan, zoom } = useCanvasStore();
  const viewport = document.querySelector('.gsap-canvas')?.parentElement?.parentElement;
  
  const vw = viewport?.clientWidth || window.innerWidth - 320;
  const vh = viewport?.clientHeight || window.innerHeight;

  const scaleX = 100 / projectConfig.width;
  const scaleY = 100 / projectConfig.height;

  const viewX = (-pan.x / zoom) * scaleX;
  const viewY = (-pan.y / zoom) * scaleY;
  const viewW = ((vw / zoom) / projectConfig.width) * 100;
  const viewH = ((vh / zoom) / projectConfig.height) * 100;

  return (
    <div 
      className="absolute border border-accent pointer-events-none"
      style={{
        left: `${Math.max(0, viewX)}%`,
        top: `${Math.max(0, viewY)}%`,
        width: `${Math.min(100, viewW)}%`,
        height: `${Math.min(100, viewH)}%`,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' // Darkens canvas outside the viewport
      }}
    />
  );
};