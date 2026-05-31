// src/services/AutoSaveService.ts
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
  private static pendingSave = false; // Queue flag to prevent dropped saves
  private static initialized = false;

  static registerStoreSubscriptions() {
    if (this.initialized) return;
    this.initialized = true;

    useCanvasStore.subscribe((state, prevState) => {
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

    this.saveTimeout = setTimeout(() => {
      this.attemptSave();
    }, 5000);
  }

  // Orchestrator to handle the race condition
  private static async attemptSave() {
    if (this.isGenerating) {
      this.pendingSave = true; // Queue the save for later
      return;
    }

    this.isGenerating = true;
    this.pendingSave = false;

    await this.performSave();

    this.isGenerating = false;

    // If another change occurred during the previous save cycle, trigger again immediately
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
          // OBJECTIVE 3 FIX: If in 3D mode (canvases unmounted), fallback to LayerCache memory blob
          buffer = await engine.getLayerCacheBlob(layer.id);
        }
        
        return {
          ...layer,
          buffer
        };
      }));
      
      const project: any = { // Cast to any or update VeilProject types
        metadata: {
          version: '1.0.0',
          timestamp: new Date().toISOString()
        },
        canvas: {
          width: canvasState.projectConfig.width,
          height: canvasState.projectConfig.height,
          backgroundColor: canvasState.backgroundColor,
          isSpritesheetMode: canvasState.isSpritesheetMode
        },
        scene: {
          nodes: sceneState.nodes,
          lights: sceneState.lights,
          camera: sceneState.camera
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
      if (!project) return false;
      
      console.log("Found auto-save, restoring...");
      
      const sceneState = useSceneStore.getState();
      sceneState.restoreState(project.scene.nodes, project.scene.lights);
      
      if (project.scene.camera && sceneState.updateCamera) {
         sceneState.updateCamera(project.scene.camera);
      }
      
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
      
      useCanvasStore.getState().restoreState(
        project.layers, 
        project.canvas?.backgroundColor,
        project.canvas?.isSpritesheetMode
      );
      
      return true;
    } catch (e) {
      console.error("Failed to restore auto-save:", e);
      return false;
    }
  }
}