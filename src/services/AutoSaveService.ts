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
  private static pendingSave = false; 
  private static initialized = false;

  static registerStoreSubscriptions() {
    if (this.initialized) return;
    this.initialized = true;

    useCanvasStore.subscribe((state, prevState) => {
      // 120HZ/RECURSION FIX: Prevent infinite loop! 
      // If the store updated ONLY because the auto-save status changed, ignore it.
      if (state.autoSaveStatus !== prevState.autoSaveStatus) {
        if (
          state.globalUpdateTick === prevState.globalUpdateTick && 
          state.layerUpdateTick === prevState.layerUpdateTick
        ) {
          return; 
        }
      }
      this.triggerAutoSave();
    });

    useSceneStore.subscribe(() => { this.triggerAutoSave(); });
    useAnimationStore.subscribe(() => { this.triggerAutoSave(); });
  }
  
  static triggerAutoSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    // RECURSION FIX: Only dispatch a state update if it isn't already dirty
    const state = useCanvasStore.getState();
    if (state.autoSaveStatus === 'saved') {
      state.setAutoSaveStatus('dirty');
    }

    this.saveTimeout = setTimeout(() => {
      this.attemptSave();
    }, 5000);
  }

  private static async attemptSave() {
    if (this.isGenerating) {
      this.pendingSave = true; 
      return;
    }

    this.isGenerating = true;
    this.pendingSave = false;

    await this.performSave();

    this.isGenerating = false;

    if (this.pendingSave) {
      this.triggerAutoSave();
    }
  }
  
  private static async performSave() {
    useCanvasStore.getState().setAutoSaveStatus('saving');
    
    try {
      console.log("Auto-saving project to IndexedDB...");
      const sceneState = useSceneStore.getState();
      const canvasState = useCanvasStore.getState();
      const animationState = useAnimationStore.getState();
      const engine = StudioEngine.getInstance();
      
      const layersData = await Promise.all(canvasState.layers.map(async (layer) => {
        const bufferCanvas = engine.getFrameBuffer(layer.id);
        let buffer: Blob | null = null;
        
        if (bufferCanvas) {
          buffer = await new Promise<Blob | null>((resolve) => {
            bufferCanvas.toBlob((blob) => resolve(blob), 'image/png');
          });
        } else {
          buffer = await engine.getLayerCacheBlob(layer.id);
        }
        
        return { ...layer, buffer };
      }));
      
      const project: VeilProject = { 
        metadata: {
          version: '1.0.0',
          timestamp: new Date().toISOString()
        },
        canvas: {
          width: canvasState.projectConfig.width,
          height: canvasState.projectConfig.height,
          backgroundColor: canvasState.backgroundColor,
          isSpritesheetMode: canvasState.isSpritesheetMode,
          workspace: canvasState.workspace,
          theme: canvasState.theme,
          tool: canvasState.tool,
          brushSize: canvasState.brushSize,
          brushColor: canvasState.brushColor,
          brushOpacity: canvasState.brushOpacity,
          brushHardness: canvasState.brushHardness,
          brushFlow: canvasState.brushFlow,
          globalOpacity: canvasState.globalOpacity,
          symmetryX: canvasState.symmetryX,
          symmetryY: canvasState.symmetryY,
          showGrid: canvasState.showGrid,
          referenceGrid: canvasState.referenceGrid,
          zoom: canvasState.zoom,
          pan: canvasState.pan,
          activeLayerId: canvasState.activeLayerId
        },
        scene: {
          nodes: sceneState.nodes,
          lights: sceneState.lights,
          environment: sceneState.environment,
          camera: sceneState.camera,
          savedViews: sceneState.savedViews
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
      
    } catch (e) {
      console.warn("Failed to auto-save project:", e);
      useCanvasStore.getState().setAutoSaveStatus('dirty');
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
      if (!project || !project.canvas || !project.scene) return false;
      
      console.log("Found auto-save, restoring...");
      
      useSceneStore.getState().restoreState(project.scene);
      
      if (project.animation) {
        useAnimationStore.getState().restoreState(
          project.animation.rows, 
          project.animation.columns, 
          project.animation.activeFrame
        );
      }
      
      if (project.canvas.width && project.canvas.height) {
        StudioEngine.getInstance().resizeAllLayers(project.canvas.width, project.canvas.height);
      }
      
      useCanvasStore.getState().restoreState(project.canvas, project.layers);

      setTimeout(() => {
        const engine = StudioEngine.getInstance();
        project.layers.forEach(layer => {
          if (layer.buffer) {
             engine.restoreLayerBuffer(layer.id, layer.buffer);
          }
        });
      }, 100);
      
      return true;
    } catch (e) {
      console.error("Failed to restore auto-save:", e);
      return false;
    }
  }
}