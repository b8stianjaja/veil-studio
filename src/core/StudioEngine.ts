import * as THREE from 'three';
import { useCanvasStore } from '../store/useCanvasStore';
import { useAnimationStore } from '../store/useAnimationStore';
import { getFlattenedRenderLayers } from '../utils/layerUtils';

interface HistoryState {
  layerId: string;
  imageData: ImageData | null;
}

export class StudioEngine {
  private static instance: StudioEngine;
  private canvasLayers: Map<string, HTMLCanvasElement> = new Map();
  private ctxs: Map<string, CanvasRenderingContext2D> = new Map();
  private threeCamera: THREE.PerspectiveCamera | null = null;
  private threeScene: THREE.Scene | null = null;
  
  // High-frequency state managed outside React
  private isDrawing: boolean = false;
  private currentPath: { x: number, y: number }[] = [];
  private strokeSnapshot: ImageData | null = null;
  private rafId: number | null = null;

  // Optimized History Stack using ImageData
  private history: HistoryState[] = [];
  private historyPointer: number = -1;
  private maxHistory: number = 20;

  private constructor() {
    this.renderLoop = this.renderLoop.bind(this);
    this.rafId = requestAnimationFrame(this.renderLoop);
  }
  
  public static getInstance(): StudioEngine {
    if (!StudioEngine.instance) {
      StudioEngine.instance = new StudioEngine();
    }
    return StudioEngine.instance;
  }

  private renderLoop() {
    this.rafId = requestAnimationFrame(this.renderLoop);
    this.flushPaints();
  }

  private flushPaints() {
    if (this.currentPath.length < 2) return;

    const state = useCanvasStore.getState();
    const activeLayerId = state.activeLayerId;
    if (!activeLayerId) {
      this.currentPath = [];
      return;
    }
    
    const activeLayer = state.layers.find(l => l.id === activeLayerId);
    if (activeLayer?.locked) {
      this.currentPath = [];
      return;
    }

    const ctx = this.ctxs.get(activeLayerId);
    const canvas = this.canvasLayers.get(activeLayerId);
    if (!ctx || !canvas) {
      this.currentPath = [];
      return;
    }
    
    if (this.strokeSnapshot) {
      ctx.putImageData(this.strokeSnapshot, 0, 0);
    }
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = state.brushSize;
    
    let brushStr = state.brushColor;
    if (state.tool !== 'ERASER') {
      const hex = state.brushColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      brushStr = `rgba(${r},${g},${b},${state.brushOpacity})`;
    } else {
      brushStr = `rgba(0,0,0,${state.brushOpacity})`;
    }
    
    ctx.strokeStyle = brushStr;
    ctx.globalCompositeOperation = state.tool === 'ERASER' ? 'destination-out' : 'source-over';
    
    const animState = useAnimationStore.getState();
    const isPainting = state.workspace === 'PAINTING';
    const hasGrid = animState.columns > 1 || animState.rows > 1;
    
    ctx.save();
    if (isPainting && hasGrid && animState.activeFrame !== undefined) {
      const dpr = window.devicePixelRatio || 1;
      
      const frameW = (canvas.width / dpr) / animState.columns;
      const frameH = (canvas.height / dpr) / animState.rows;
      const col = animState.activeFrame % animState.columns;
      const row = Math.floor(animState.activeFrame / animState.columns);
      
      ctx.beginPath();
      ctx.rect(col * frameW, row * frameH, frameW, frameH);
      ctx.clip();
    }

    const drawPath = (transform?: { scaleX: number, scaleY: number, transX: number, transY: number }) => {
      if (this.currentPath.length < 2) return;
      ctx.beginPath();
      
      const applyT = (pt: {x:number,y:number}) => {
        if (!transform) return pt;
        return { x: pt.x * transform.scaleX + transform.transX, y: pt.y * transform.scaleY + transform.transY };
      };
      
      const p = this.currentPath.map(applyT);
      
      ctx.moveTo(p[0].x, p[0].y);
      
      for (let i = 1; i < p.length - 2; i++) {
        const xc = (p[i].x + p[i + 1].x) / 2;
        const yc = (p[i].y + p[i + 1].y) / 2;
        ctx.quadraticCurveTo(p[i].x, p[i].y, xc, yc);
      }
      
      if (p.length > 2) {
        const last = p.length - 1;
        ctx.quadraticCurveTo(p[last - 1].x, p[last - 1].y, p[last].x, p[last].y);
      } else {
        ctx.lineTo(p[1].x, p[1].y);
      }
      
      ctx.stroke();
    };

    drawPath();

    if (canvas && (state.symmetryX || state.symmetryY)) {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr; 
      const h = canvas.height / dpr;
      
      if (state.symmetryX) {
        drawPath({ scaleX: -1, scaleY: 1, transX: w, transY: 0 });
      }
      if (state.symmetryY) {
        drawPath({ scaleX: 1, scaleY: -1, transX: 0, transY: h });
      }
      if (state.symmetryX && state.symmetryY) {
        drawPath({ scaleX: -1, scaleY: -1, transX: w, transY: h });
      }
    }
    
    ctx.restore();
  }
  
  public setThreeScene(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.threeScene = scene;
    this.threeCamera = camera;
  }
  
  public registerLayer(id: string, canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;
    const config = useCanvasStore.getState().projectConfig;
    
    canvas.width = config.width * dpr;
    canvas.height = config.height * dpr;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.scale(dpr, dpr);
      this.ctxs.set(id, ctx);
    }
    this.canvasLayers.set(id, canvas);
  }
  
  public removeLayer(id: string) {
    const canvas = this.canvasLayers.get(id);
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    this.canvasLayers.delete(id);
    this.ctxs.delete(id);
  }
  
  public getProjectionMatrix() {
    if (!this.threeCamera) return new THREE.Matrix4();
    return this.threeCamera.projectionMatrix.clone();
  }
  
  public startStroke(x: number, y: number) {
    const state = useCanvasStore.getState();
    const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
    if (activeLayer?.locked) return;

    const canvas = this.canvasLayers.get(state.activeLayerId!);
    const ctx = this.ctxs.get(state.activeLayerId!);
    
    if (canvas && ctx) {
      this.strokeSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      this.saveHistoryState(state.activeLayerId!, this.strokeSnapshot);
    }

    let nx = x;
    let ny = y;
    if (state.showGrid) {
      nx = Math.round(nx / 50) * 50;
      ny = Math.round(ny / 50) * 50;
    }

    this.isDrawing = true;
    this.currentPath = [{ x: nx, y: ny }];
  }

  public continueStroke(x: number, y: number) {
    if (!this.isDrawing) return;
    
    const state = useCanvasStore.getState();
    let nx = x;
    let ny = y;
    
    if (state.showGrid) {
      nx = Math.round(nx / 50) * 50;
      ny = Math.round(ny / 50) * 50;
    }

    this.currentPath.push({ x: nx, y: ny });
  }

  private saveHistoryState(layerId: string, imageData: ImageData) {
    if (this.historyPointer < this.history.length - 1) {
      this.history.splice(this.historyPointer + 1);
    }
    
    // Deep copy the ImageData to prevent mutations
    const dataCopy = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );
    
    this.history.push({ layerId, imageData: dataCopy });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyPointer++;
    }
  }

  public endStroke() {
    this.isDrawing = false;
    this.flushPaints();
    this.currentPath = [];
    this.strokeSnapshot = null;

    const state = useCanvasStore.getState();
    if (state.activeLayerId) {
      state.markLayerUpdated(state.activeLayerId);
      
      const canvas = this.canvasLayers.get(state.activeLayerId);
      const ctx = this.ctxs.get(state.activeLayerId);
      if (canvas && ctx) {
        const finalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        this.saveHistoryState(state.activeLayerId, finalImageData);
      }
    }
  }

  public undo() {
    if (this.historyPointer <= 0) return;
    
    this.historyPointer--;
    const previousState = this.history[this.historyPointer];
    
    const ctx = this.ctxs.get(previousState.layerId);
    if (ctx && previousState.imageData) {
      ctx.putImageData(previousState.imageData, 0, 0);
      useCanvasStore.getState().markLayerUpdated(previousState.layerId);
    }
  }

  public redo() {
    if (this.historyPointer >= this.history.length - 1) return;
    
    this.historyPointer++;
    const nextState = this.history[this.historyPointer];
    
    const ctx = this.ctxs.get(nextState.layerId);
    if (ctx && nextState.imageData) {
      ctx.putImageData(nextState.imageData, 0, 0);
      useCanvasStore.getState().markLayerUpdated(nextState.layerId);
    }
  }

  public getFrameBuffer(layerId: string) {
    return this.canvasLayers.get(layerId);
  }

  public restoreLayerBuffer(layerId: string, base64Buffer: string): Promise<void> {
    return new Promise((resolve) => {
      if (!base64Buffer) {
        this.clearLayer(layerId);
        return resolve();
      }
      
      const canvas = this.canvasLayers.get(layerId);
      const ctx = this.ctxs.get(layerId);
      if (!canvas || !ctx) return resolve();

      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
        const state = useCanvasStore.getState();
        state.markLayerUpdated(layerId);
        resolve();
      };
      img.src = base64Buffer;
    });
  }

  public resizeAllLayers(newWidth: number, newHeight: number) {
    const dpr = window.devicePixelRatio || 1;
    this.canvasLayers.forEach((canvas, id) => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) tCtx.drawImage(canvas, 0, 0);

      canvas.width = newWidth * dpr;
      canvas.height = newHeight * dpr;

      const ctx = this.ctxs.get(id);
      if (ctx) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.scale(dpr, dpr);
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
      }
    });
    
    this.history = [];
    this.historyPointer = -1;
  }

  public clearLayer(layerId: string) {
    const state = useCanvasStore.getState();
    const layer = state.layers.find(l => l.id === layerId);
    if (layer?.locked) return;

    const canvas = this.canvasLayers.get(layerId);
    const ctx = this.ctxs.get(layerId);
    if (canvas && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      state.markLayerUpdated(layerId);
    }
  }

  public clearFrame(layerId: string, frameIndex: number, columns: number, rows: number) {
    const state = useCanvasStore.getState();
    const layer = state.layers.find(l => l.id === layerId);
    if (layer?.locked) return;

    const canvas = this.canvasLayers.get(layerId);
    const ctx = this.ctxs.get(layerId);
    if (canvas && ctx) {
      const physicalW = canvas.width / columns; 
      const physicalH = canvas.height / rows;
      
      const col = frameIndex % columns;
      const row = Math.floor(frameIndex / columns);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(col * physicalW, row * physicalH, physicalW, physicalH);
      ctx.restore();
      
      state.markLayerUpdated(layerId);
    }
  }

  public duplicateFrame(layerId: string, sourceFrame: number, targetFrame: number, columns: number, rows: number) {
    const state = useCanvasStore.getState();
    const layer = state.layers.find(l => l.id === layerId);
    if (layer?.locked) return;

    const canvas = this.canvasLayers.get(layerId);
    const ctx = this.ctxs.get(layerId);
    if (!canvas || !ctx) return;

    const physicalW = canvas.width / columns;
    const physicalH = canvas.height / rows;
    
    const sCol = sourceFrame % columns;
    const sRow = Math.floor(sourceFrame / columns);
    const tCol = targetFrame % columns;
    const tRow = Math.floor(targetFrame / columns);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = physicalW;
    tempCanvas.height = physicalH;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.drawImage(
      canvas, 
      sCol * physicalW, sRow * physicalH, physicalW, physicalH, 
      0, 0, physicalW, physicalH
    );

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    
    ctx.clearRect(tCol * physicalW, tRow * physicalH, physicalW, physicalH);
    ctx.drawImage(
      tempCanvas, 
      0, 0, physicalW, physicalH, 
      tCol * physicalW, tRow * physicalH, physicalW, physicalH
    );
    ctx.restore();

    state.markLayerUpdated(layerId);
  }

  private thumbCanvas: HTMLCanvasElement | null = null;
  
  public getLayerContentBounds(layerId: string): { x: number, y: number, w: number, h: number } | null {
    const canvas = this.canvasLayers.get(layerId);
    if (!canvas) return null;

    const width = canvas.width;
    const height = canvas.height;
    
    if (!this.thumbCanvas) {
      this.thumbCanvas = document.createElement('canvas');
    }
    const scale = 0.05; 
    const thumbW = Math.max(1, Math.floor(width * scale));
    const thumbH = Math.max(1, Math.floor(height * scale));

    if (this.thumbCanvas.width !== thumbW) this.thumbCanvas.width = thumbW;
    if (this.thumbCanvas.height !== thumbH) this.thumbCanvas.height = thumbH;
    
    const thumbCtx = this.thumbCanvas.getContext('2d', { willReadFrequently: true });
    if (!thumbCtx) return null;

    thumbCtx.drawImage(canvas, 0, 0, thumbW, thumbH);
    const imageData = thumbCtx.getImageData(0, 0, thumbW, thumbH).data;

    let minX = thumbW, minY = thumbH, maxX = -1, maxY = -1;

    for (let y = 0; y < thumbH; y++) {
      for (let x = 0; x < thumbW; x++) {
        const alpha = imageData[(y * thumbW + x) * 4 + 3];
        if (alpha > 5) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return null;

    const dpr = window.devicePixelRatio || 1;
    const padding = 20;

    return {
      x: Math.max(0, (minX / scale) / dpr - padding),
      y: Math.max(0, (minY / scale) / dpr - padding),
      w: ((maxX - minX + 1) / scale) / dpr + (padding * 2),
      h: ((maxY - minY + 1) / scale) / dpr + (padding * 2)
    };
  }

  private compositeCanvas: HTMLCanvasElement | null = null;
  
  public getCompositeCanvas(): HTMLCanvasElement | null {
    const firstCanvas = Array.from(this.canvasLayers.values())[0];
    const width = firstCanvas?.width || 800;
    const height = firstCanvas?.height || 600;
    
    if (!this.compositeCanvas) {
      this.compositeCanvas = document.createElement('canvas');
    }
    if (this.compositeCanvas.width !== width) this.compositeCanvas.width = width;
    if (this.compositeCanvas.height !== height) this.compositeCanvas.height = height;
    
    const ctx = this.compositeCanvas.getContext('2d');
    if (!ctx) return null;
    
    const state = useCanvasStore.getState();
    
    ctx.clearRect(0, 0, width, height);
    
    if (state.backgroundColor && state.backgroundColor !== 'transparent') {
      ctx.fillStyle = state.backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }
    
    const getAggregatedVisibility = (layerId: string): boolean => {
      const layer = state.layers.find(l => l.id === layerId);
      if (!layer || !layer.visible) return false;
      if (layer.parentId) return getAggregatedVisibility(layer.parentId);
      return true;
    };

    const getAggregatedOpacity = (layerId: string): number => {
      const layer = state.layers.find(l => l.id === layerId);
      if (!layer) return 1;
      const parentOpacity = layer.parentId ? getAggregatedOpacity(layer.parentId) : 1;
      return (layer.opacity ?? 1) * parentOpacity;
    };

    const sorted = getFlattenedRenderLayers(state.layers);
    
    sorted.forEach(layer => {
       if(getAggregatedVisibility(layer.id)) {
           const layerCanvas = this.canvasLayers.get(layer.id);
           if(layerCanvas) {
              ctx.save();
              ctx.globalAlpha = getAggregatedOpacity(layer.id);
              ctx.globalCompositeOperation = (layer.blendMode === 'normal' || !layer.blendMode) 
                ? 'source-over' 
                : layer.blendMode as GlobalCompositeOperation;
              ctx.drawImage(layerCanvas, 0, 0);
              ctx.restore();
           }
       }
    });
    
    return this.compositeCanvas;
  }

  public getCompositeBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const canvas = this.getCompositeCanvas();
      if (!canvas) resolve(null);
      else canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }
}