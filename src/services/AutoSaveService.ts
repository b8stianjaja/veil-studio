import { get, set } from 'idb-keyval';
import { StudioEngine } from '../core/StudioEngine';
import { useSceneStore } from '../store/useSceneStore';
import { useCanvasStore } from '../store/useCanvasStore';
import { useAnimationStore } from '../store/useAnimationStore';
import { VeilProject } from '../types';

const AUTOSAVE_KEY = 'veil-autosave-project';

export class AutoSaveService {
  private static saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private static isGenerating = false;
  private static initialized = false;

  static registerStoreSubscriptions() {
    if (this.initialized) return;
    this.initialized = true;

    useCanvasStore.subscribe((state, prevState) => {
      // Don't save on view transformations, just content/structure changes
      if (
        state.layers !== prevState.layers || 
        state.layerUpdateTick !== prevState.layerUpdateTick ||
        state.backgroundColor !== prevState.backgroundColor
      ) {
        this.triggerAutoSave();
      }
    });

    useSceneStore.subscribe((state, prevState) => {
      if (state.nodes !== prevState.nodes || state.lights !== prevState.lights) {
        this.triggerAutoSave();
      }
    });

    useAnimationStore.subscribe((state, prevState) => {
      if (
        state.rows !== prevState.rows || 
        state.columns !== prevState.columns || 
        state.activeFrame !== prevState.activeFrame
      ) {
        this.triggerAutoSave();
      }
    });
  }
  
  static triggerAutoSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    useCanvasStore.getState().setAutoSaveStatus('dirty');

    // Debounce saves by 5 seconds
    this.saveTimeout = setTimeout(() => {
      this.performSave();
    }, 5000);
  }
  
  private static async performSave() {
    if (this.isGenerating) return;
    this.isGenerating = true;
    useCanvasStore.getState().setAutoSaveStatus('saving');
    
    try {
      console.log("Auto-saving project to IndexedDB...");
      const sceneState = useSceneStore.getState();
      const canvasState = useCanvasStore.getState();
      const animationState = useAnimationStore.getState();
      const engine = StudioEngine.getInstance();
      
      const layersData = await Promise.all(canvasState.layers.map(async (layer) => {
        const bufferCanvas = engine.getFrameBuffer(layer.id);
        let buffer = '';
        if (bufferCanvas) {
          buffer = bufferCanvas.toDataURL('image/png'); // Can optimize but this is okay in background
        }
        return {
          ...layer,
          buffer
        };
      }));
      
      const project: VeilProject = {
        metadata: {
          version: '1.0.0',
          timestamp: new Date().toISOString()
        },
        canvas: {
          width: canvasState.projectConfig.width,
          height: canvasState.projectConfig.height,
          backgroundColor: canvasState.backgroundColor
        },
        scene: {
          nodes: sceneState.nodes,
          lights: sceneState.lights
        },
        animation: {
          rows: animationState.rows,
          columns: animationState.columns,
          activeFrame: animationState.activeFrame
        },
        layers: layersData
      };
      
      await set(AUTOSAVE_KEY, project);
      console.log("Auto-save complete.");
      useCanvasStore.getState().setAutoSaveStatus('saved');
      
      // We could trigger a toast here if we had a global toast store
    } catch (e) {
      console.warn("Failed to auto-save project:", e);
      // Wait a little before making it dirty again to prevent hard locks
      useCanvasStore.getState().setAutoSaveStatus('dirty');
    } finally {
      this.isGenerating = false;
    }
  }
  
  static async hasAutoSave(): Promise<boolean> {
    try {
      const project = await get<VeilProject>(AUTOSAVE_KEY);
      return !!project;
    } catch (e) {
      return false;
    }
  }

  static async checkAndRestoreAutoSave(): Promise<boolean> {
    try {
      const project = await get<VeilProject>(AUTOSAVE_KEY);
      if (!project) return false;
      
      console.log("Found auto-save, restoring...");
      
      useSceneStore.getState().restoreState(project.scene.nodes, project.scene.lights);
      
      if (project.animation) {
        useAnimationStore.getState().restoreState(
          project.animation.rows, 
          project.animation.columns, 
          project.animation.activeFrame
        );
      }
      
      if (project.canvas?.width && project.canvas?.height) {
        useCanvasStore.getState().setProjectConfig({ width: project.canvas.width, height: project.canvas.height });
        StudioEngine.getInstance().resizeAllLayers(project.canvas.width, project.canvas.height);
      }
      useCanvasStore.getState().restoreState(project.layers, project.canvas?.backgroundColor);
      
      return true;
    } catch (e) {
      console.error("Failed to restore auto-save:", e);
      return false;
    }
  }
}
