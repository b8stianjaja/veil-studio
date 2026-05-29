import { create } from 'zustand';
import { SceneNode, LightingConfig, EnvironmentConfig, CameraConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface SceneState {
  nodes: SceneNode[];
  lights: LightingConfig;
  environment: EnvironmentConfig;
  camera: CameraConfig;
  selectedNodeId: string | null;
  addNode: (type: SceneNode['type']) => void;
  duplicateNode: (id: string) => string | null;
  updateNode: (id: string, updates: Partial<SceneNode>) => void;
  selectNode: (id: string | null) => void;
  removeNode: (id: string) => void;
  clearScene: () => void;
  updateLighting: (updates: Partial<LightingConfig>) => void;
  updateEnvironment: (updates: Partial<EnvironmentConfig>) => void;
  updateCamera: (updates: Partial<CameraConfig>) => void;
  restoreState: (nodes: SceneNode[], lights: LightingConfig, environment?: EnvironmentConfig, camera?: CameraConfig) => void;
  cameraResetTick: number;
  cameraSaveTick: number;
  triggerCameraReset: () => void;
  triggerCameraSave: () => void;
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
  camera: {
    type: 'PERSPECTIVE',
    fov: 50,
    locked: false,
    position: [5, 5, 5],
    target: [0, 0, 0],
    zoom: 50
  },
  selectedNodeId: null,
  
  addNode: (type) => set((state) => {
    const newId = uuidv4();
    const newNode: SceneNode = {
      id: newId,
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
      receiveShadow: true,
      locked: false
    };
    
    return {
      nodes: [...state.nodes, newNode],
      selectedNodeId: newId 
    };
  }),

  duplicateNode: (id) => {
    let newId: string | null = null;
    
    set((state) => {
      const node = state.nodes.find(n => n.id === id);
      if (!node) return state; 
      
      newId = uuidv4();
      
      const newNode: SceneNode = { 
        ...node, 
        id: newId, 
        position: [node.position[0] + 0.5, node.position[1], node.position[2] + 0.5],
        rotation: [...node.rotation],
        scale: [...node.scale]
      };
      
      return { 
        nodes: [...state.nodes, newNode], 
        selectedNodeId: newId 
      };
    });
    
    return newId;
  },
  
  updateNode: (id, updates) => set((state) => {
    const node = state.nodes.find(n => n.id === id);
    if (node?.locked && updates.locked === undefined) {
      return state;
    }

    return {
      nodes: state.nodes.map(n => n.id === id ? { ...n, ...updates } : n)
    };
  }),
  
  selectNode: (id) => set({ selectedNodeId: id }),
  
  removeNode: (id) => set((state) => {
    const node = state.nodes.find(n => n.id === id);
    if (node?.locked) return state;

    return { 
      nodes: state.nodes.filter(n => n.id !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId
    };
  }),

  clearScene: () => set((state) => ({ 
    nodes: state.nodes.filter(n => n.locked),
    selectedNodeId: null 
  })),
  
  updateLighting: (updates) => set((state) => ({
    lights: { ...state.lights, ...updates }
  })),

  updateEnvironment: (updates) => set((state) => ({
    environment: { ...state.environment, ...updates }
  })),

  updateCamera: (updates) => set((state) => ({
    camera: { ...state.camera, ...updates }
  })),

  restoreState: (nodes, lights, environment, camera) => set((state) => ({ 
    nodes, 
    lights, 
    environment: environment ?? state.environment,
    camera: camera ?? state.camera,
    selectedNodeId: null 
  })),

  cameraResetTick: 0,
  cameraSaveTick: 0,
  
  triggerCameraReset: () => set((state) => ({ 
    cameraResetTick: state.cameraResetTick + 1 
  })),
  
  triggerCameraSave: () => set((state) => ({
    cameraSaveTick: state.cameraSaveTick + 1
  }))
}));