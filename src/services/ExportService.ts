import { StudioEngine } from '../core/StudioEngine';
import { useSceneStore } from '../store/useSceneStore';
import { useCanvasStore } from '../store/useCanvasStore';
import { useAnimationStore } from '../store/useAnimationStore';
import { VeilProject } from '../types';

export class ExportService {
  static async importProjectJSON(file: File) {
    try {
      const text = await file.text();
      const project: VeilProject = JSON.parse(text);
      
      if (!project.metadata || !project.scene || !project.layers) {
        throw new Error("Invalid project file");
      }
      
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
      
    } catch (e) {
      console.error("Failed to import project:", e);
      alert("Failed to import project. Please check the file formatting.");
    }
  }

  static async exportProjectJSON() {
    
    const sceneState = useSceneStore.getState();
    const canvasState = useCanvasStore.getState();
    const animationState = useAnimationStore.getState();
    const engine = StudioEngine.getInstance();
    
    const layersData = await Promise.all(canvasState.layers.map(async (layer) => {
      const bufferCanvas = engine.getFrameBuffer(layer.id);
      let buffer = '';
      if (bufferCanvas) {
        buffer = bufferCanvas.toDataURL('image/png');
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
    
    const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
    this.download(blob, `veil-project-${Date.now()}.json`);
  }

  static async exportCompositePNG() {
    const engine = StudioEngine.getInstance();
    const blob = await engine.getCompositeBlob();
    if (blob) {
      this.download(blob, `veil-spritesheet-${Date.now()}.png`);
    }
  }

  static async exportAnimationWebM(fps: number, rows: number, columns: number) {
    const engine = StudioEngine.getInstance();
    const compCanvas = engine.getCompositeCanvas();
    if (!compCanvas) return;

    const frameW = compCanvas.width / columns;
    const frameH = compCanvas.height / rows;
    const totalFrames = rows * columns;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = frameW;
    exportCanvas.height = frameH;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Use 0 as captureStream parameter to allow explicit frame triggering
    const stream = exportCanvas.captureStream(0);
    const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    
    const recorder = new MediaRecorder(stream, { 
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 5000000 
    });
    
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      this.download(blob, `veil-animation-${Date.now()}.webm`);
    };

    recorder.start();

    let currentFrame = 0;
    
    const renderNextFrame = async () => {
      if (currentFrame >= totalFrames) {
        recorder.stop();
        return;
      }
      
      const col = currentFrame % columns;
      const row = Math.floor(currentFrame / columns);
      
      const state = useCanvasStore.getState();
      ctx.fillStyle = state.backgroundColor || '#0a0a0a';
      ctx.fillRect(0, 0, frameW, frameH);

      ctx.drawImage(
        compCanvas, 
        col * frameW, row * frameH, frameW, frameH, 
        0, 0, frameW, frameH
      );
      
      // Force MediaRecorder to capture this exact rendered state
      track.requestFrame();
      currentFrame++;
      
      // Use promises to keep the UI thread clear
      await new Promise(resolve => setTimeout(resolve, 1000 / fps));
      renderNextFrame();
    };
    
    renderNextFrame();
  }

  private static download(blob: Blob, filename: string) {
    const el = document.createElement('a');
    el.href = URL.createObjectURL(blob);
    el.download = filename;
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
  }
}