import { create } from 'zustand';
import { LayerConfig, WorkspaceMode, ToolType } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface CanvasState {
  workspace: WorkspaceMode;
  theme: 'dark' | 'light';
  tool: ToolType;
  layers: LayerConfig[];
  activeLayerId: string | null;
  brushSize: number;
  brushColor: string;
  brushOpacity: number;
  globalOpacity: number;
  backgroundColor: string;
  layerUpdateTick: Record<string, number>;
  globalUpdateTick: number;
  symmetryX: boolean;
  symmetryY: boolean;
  showGrid: boolean;
  referenceGrid: {
    show: boolean;
    rows: number;
    cols: number;
    color: string;
    opacity: number;
  };
  autoSaveStatus: 'saved' | 'saving' | 'dirty';
  setAutoSaveStatus: (status: 'saved' | 'saving' | 'dirty') => void;
  projectConfig: { width: number, height: number };
  projectConfigured: boolean;
  zoom: number;
  pan: { x: number, y: number };
  toggleTheme: () => void;
  setProjectConfigured: (configured: boolean) => void;
  setProjectConfig: (config: { width: number, height: number }) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number, y: number }) => void;
  setWorkspace: (mode: WorkspaceMode) => void;
  setTool: (tool: ToolType) => void;
  addLayer: () => void;
  addFolder: () => void;
  updateLayer: (id: string, updates: Partial<LayerConfig>) => void;
  removeLayer: (id: string) => void;
  setActiveLayer: (id: string | null) => void;
  setBrushSettings: (updates: { size?: number, color?: string, opacity?: number }) => void;
  setSymmetry: (axis: 'X' | 'Y', value: boolean) => void;
  setShowGrid: (show: boolean) => void;
  reorderLayers: (startIndex: number, endIndex: number) => void;
  setReferenceGrid: (updates: Partial<CanvasState['referenceGrid']>) => void;
  restoreState: (layers: LayerConfig[], backgroundColor?: string) => void;
  setBackgroundColor: (color: string) => void;
  markLayerUpdated: (id: string) => void;
  triggerGlobalUpdate: () => void;
}

const initialLayerId = uuidv4();

export const useCanvasStore = create<CanvasState>((set, get) => ({
  workspace: 'PAINTING',
  theme: 'dark',
  tool: 'BRUSH',
  layers: [
    { id: initialLayerId, order: 0, visible: true, opacity: 1, name: 'Layer 1', locked: false, blendMode: 'normal', type: 'LAYER', parentId: null }
  ],
  activeLayerId: initialLayerId,
  brushSize: 5,
  brushColor: '#d0d0d0',
  brushOpacity: 1,
  globalOpacity: 1,
  backgroundColor: '#0a0a0a',
  layerUpdateTick: { [initialLayerId]: Date.now() },
  globalUpdateTick: 0,
  symmetryX: false,
  symmetryY: false,
  showGrid: false,
  referenceGrid: {
    show: false,
    rows: 4,
    cols: 4,
    color: '#00ffff',
    opacity: 0.5
  },
  autoSaveStatus: 'saved',
  projectConfigured: false,
  projectConfig: { width: 1024, height: 1024 },
  zoom: 1,
  pan: { x: 0, y: 0 },

  setAutoSaveStatus: (status) => set({ autoSaveStatus: status }),
  
  toggleTheme: () => set(state => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { theme: newTheme };
  }),

  setProjectConfigured: (configured) => set({ projectConfigured: configured }),
  setProjectConfig: (config) => set((state) => ({ projectConfig: { ...state.projectConfig, ...config } })),
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  
  setWorkspace: (mode) => set({ 
    workspace: mode, 
    tool: mode === 'MODELING' ? 'ORBIT' : 'BRUSH' 
  }),
  
  setTool: (tool) => set({ tool }),
  
  triggerGlobalUpdate: () => set(state => ({ globalUpdateTick: state.globalUpdateTick + 1 })),

  addLayer: () => set((state) => {
    const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
    const parentId = activeLayer ? (activeLayer.type === 'FOLDER' ? activeLayer.id : activeLayer.parentId) : null;
    
    // Polish: Safely calculate the next highest order to prevent collisions
    const nextOrder = state.layers.length > 0 
      ? Math.max(...state.layers.map(l => l.order)) + 1 
      : 0;

    const newLayer: LayerConfig = {
      id: uuidv4(),
      order: nextOrder,
      visible: true,
      opacity: 1,
      name: `Layer ${state.layers.filter(l => l.type !== 'FOLDER').length + 1}`,
      locked: false,
      blendMode: 'normal',
      type: 'LAYER',
      parentId
    };
    
    return { 
      layers: [...state.layers, newLayer],
      activeLayerId: newLayer.id,
      globalUpdateTick: state.globalUpdateTick + 1
    };
  }),

  addFolder: () => set((state) => {
    const nextOrder = state.layers.length > 0 
      ? Math.max(...state.layers.map(l => l.order)) + 1 
      : 0;

    const newFolder: LayerConfig = {
      id: uuidv4(),
      order: nextOrder,
      visible: true,
      opacity: 1,
      name: `Group ${state.layers.filter(l => l.type === 'FOLDER').length + 1}`,
      locked: false,
      type: 'FOLDER',
      expanded: true,
      parentId: null
    };

    return {
      layers: [...state.layers, newFolder],
      activeLayerId: newFolder.id,
      globalUpdateTick: state.globalUpdateTick + 1
    };
  }),

  updateLayer: (id, updates) => set((state) => ({
    layers: state.layers.map(layer => layer.id === id ? { ...layer, ...updates } : layer),
    globalUpdateTick: state.globalUpdateTick + 1
  })),

  removeLayer: (id) => set((state) => {
    if (state.layers.length <= 1) return state;

    const findChildren = (parentId: string): string[] => {
       const children = state.layers.filter(l => l.parentId === parentId).map(l => l.id);
       let all = [...children];
       children.forEach(childId => {
           all = [...all, ...findChildren(childId)];
       });
       return all;
    };

    const idsToRemove = [id, ...findChildren(id)];
    const newLayers = state.layers.filter(l => !idsToRemove.includes(l.id));
    
    if (newLayers.length === 0) return state; 
    
    // Polish: Fallback to the structurally highest order layer instead of a random array position
    let newActiveId = state.activeLayerId;
    if (idsToRemove.includes(state.activeLayerId || '')) {
      const sortedLayers = [...newLayers].sort((a, b) => b.order - a.order);
      newActiveId = sortedLayers[0]?.id || null;
    }

    // Polish: Prevent memory leaks by cleaning up update ticks for deleted layers
    const newUpdateTick = { ...state.layerUpdateTick };
    idsToRemove.forEach(deletedId => delete newUpdateTick[deletedId]);

    return {
      layers: newLayers,
      activeLayerId: newActiveId,
      layerUpdateTick: newUpdateTick,
      globalUpdateTick: state.globalUpdateTick + 1
    };
  }),

  setActiveLayer: (id) => set({ activeLayerId: id }),

  setBrushSettings: (updates) => set((state) => ({
    brushSize: updates.size ?? state.brushSize,
    brushColor: updates.color ?? state.brushColor,
    brushOpacity: updates.opacity ?? state.brushOpacity
  })),

  setSymmetry: (axis, value) => set(state => axis === 'X' ? { symmetryX: value } : { symmetryY: value }),
  setShowGrid: (show) => set({ showGrid: show }),

  reorderLayers: (startIndex, endIndex) => set((state) => {
    // Polish: Sync with UI sort order BEFORE applying indices so we drag the correct target
    const sorted = [...state.layers].sort((a, b) => b.order - a.order);
    const [removed] = sorted.splice(startIndex, 1);
    sorted.splice(endIndex, 0, removed);
    
    return {
      // Reassign explicit orders based on new visual arrangement
      layers: sorted.map((layer, index) => ({ 
        ...layer, 
        order: sorted.length - 1 - index 
      })),
      globalUpdateTick: state.globalUpdateTick + 1
    };
  }),

  setReferenceGrid: (updates) => set((state) => ({
    referenceGrid: { ...state.referenceGrid, ...updates }
  })),

  restoreState: (layers, backgroundColor) => set(state => ({ 
    layers, 
    activeLayerId: layers.length > 0 ? [...layers].sort((a,b) => b.order - a.order)[0].id : null,
    workspace: 'PAINTING',
    tool: 'BRUSH',
    backgroundColor: backgroundColor || '#0a0a0a',
    globalUpdateTick: state.globalUpdateTick + 1
  })),

  setBackgroundColor: (color) => set(state => ({ 
    backgroundColor: color,
    globalUpdateTick: state.globalUpdateTick + 1
  })),

  markLayerUpdated: (id) => set((state) => ({
    layerUpdateTick: { ...state.layerUpdateTick, [id]: Date.now() }
  }))
}));