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
  globalUpdateTick: number; // Added to track structural changes
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
  setActiveLayer: (id: string) => void;
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
  setAutoSaveStatus: (status) => set({ autoSaveStatus: status }),
  projectConfigured: false,
  projectConfig: { width: 1024, height: 1024 },
  zoom: 1,
  pan: { x: 0, y: 0 },
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
    const parentId = state.activeLayerId ? 
      (state.layers.find(l => l.id === state.activeLayerId)?.type === 'FOLDER' ? state.activeLayerId : state.layers.find(l => l.id === state.activeLayerId)?.parentId) 
      : null;
    const newLayer: LayerConfig = {
      id: uuidv4(),
      order: state.layers.length,
      visible: true,
      opacity: 1,
      name: `Layer ${state.layers.length + 1}`,
      locked: false,
      blendMode: 'normal',
      type: 'LAYER',
      parentId: parentId || null
    };
    return { 
      layers: [...state.layers, newLayer],
      activeLayerId: newLayer.id,
      globalUpdateTick: state.globalUpdateTick + 1
    };
  }),
  addFolder: () => set((state) => {
    const newFolder: LayerConfig = {
      id: uuidv4(),
      order: state.layers.length,
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
    const newActiveId = idsToRemove.includes(state.activeLayerId || '')
       ? newLayers[newLayers.length - 1].id
       : state.activeLayerId;
    return {
      layers: newLayers,
      activeLayerId: newActiveId,
      globalUpdateTick: state.globalUpdateTick + 1
    };
  }),
  setActiveLayer: (id) => set({ activeLayerId: id }),
  setBrushSettings: (updates) => set((state) => ({
    ...state,
    brushSize: updates.size ?? state.brushSize,
    brushColor: updates.color ?? state.brushColor,
    brushOpacity: updates.opacity ?? state.brushOpacity
  })),
  setSymmetry: (axis, value) => set(state => axis === 'X' ? { symmetryX: value } : { symmetryY: value }),
  setShowGrid: (show) => set({ showGrid: show }),
  reorderLayers: (startIndex, endIndex) => set((state) => {
    const result = Array.from(state.layers);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return {
      layers: result.map((layer, index) => ({ ...layer, order: index })),
      globalUpdateTick: state.globalUpdateTick + 1
    };
  }),
  setReferenceGrid: (updates) => set((state) => ({
    referenceGrid: { ...state.referenceGrid, ...updates }
  })),
  restoreState: (layers, backgroundColor) => set(state => ({ 
    layers, 
    activeLayerId: layers.length > 0 ? layers[0].id : null,
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