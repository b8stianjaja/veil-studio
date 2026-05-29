import { create } from 'zustand';
import { SceneNode, LightingConfig, EnvironmentConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface SceneState {
  nodes: SceneNode[];
  lights: LightingConfig;
  environment: EnvironmentConfig;
  selectedNodeId: string | null;
  addNode: (type: SceneNode['type']) => void;
  duplicateNode: (id: string) => string | null;
  updateNode: (id: string, updates: Partial<SceneNode>) => void;
  selectNode: (id: string | null) => void;
  removeNode: (id: string) => void;
  updateLighting: (updates: Partial<LightingConfig>) => void;
  updateEnvironment: (updates: Partial<EnvironmentConfig>) => void;
  restoreState: (nodes: SceneNode[], lights: LightingConfig, environment?: EnvironmentConfig) => void;
  cameraResetTick: number;
  triggerCameraReset: () => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  nodes: [],
  lights: {
    intensity: 1.5,
    color: '#ffffff',
    angle: [10, 10, 10],
    ambientIntensity: 0.5
  },
  environment: {
    gridVisible: true,
    gridSize: 10,
    backgroundColor: '#000000',
    axesVisible: true
  },
  selectedNodeId: null,
  
  addNode: (type) => set((state) => ({
    nodes: [...state.nodes, {
      id: uuidv4(),
      type,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#cccccc',
      wireframe: false,
      roughness: 0.5,
      metalness: 0.1,
      visible: true,
      castShadow: true,
      receiveShadow: true
    }]
  })),

  duplicateNode: (id) => {
    let newId: string | null = null;
    set((state) => {
      const node = state.nodes.find(n => n.id === id);
      if (!node) return state;
      newId = uuidv4();
      const newNode = { 
        ...node, 
        id: newId, 
        position: [node.position[0] + 0.5, node.position[1], node.position[2] + 0.5] as [number, number, number]
      };
      return { nodes: [...state.nodes, newNode], selectedNodeId: newId };
    });
    return newId;
  },
  
  updateNode: (id, updates) => set((state) => ({
    nodes: state.nodes.map(node => node.id === id ? { ...node, ...updates } : node)
  })),
  
  selectNode: (id) => set({ selectedNodeId: id }),
  
  removeNode: (id) => set((state) => ({ 
    nodes: state.nodes.filter(n => n.id !== id),
    selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId
  })),
  
  updateLighting: (updates) => set((state) => ({
    lights: { ...state.lights, ...updates }
  })),

  updateEnvironment: (updates) => set((state) => ({
    environment: { ...state.environment, ...updates }
  })),

  restoreState: (nodes, lights, environment) => set(state => ({ 
    nodes, 
    lights, 
    environment: environment ?? state.environment,
    selectedNodeId: null 
  })),

  cameraResetTick: 0,
  triggerCameraReset: () => set((state) => ({ cameraResetTick: state.cameraResetTick + 1 }))
}));
