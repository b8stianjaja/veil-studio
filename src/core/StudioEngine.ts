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
  
  // FIX 2: Persistent Layer Cache to survive React unmounts during Workspace switches
  private layerCache: Map<string, ImageData> = new Map();

  private isDrawing: boolean = false;
  private currentPath: { x: number, y: number }[] = [];
  private strokeSnapshot: ImageData | null = null;
  private rafId: number | null = null;

  private isMoving: boolean = false;
  private moveStartX: number = 0;
  private moveStartY: number = 0;
  private moveSnapshotCanvas: HTMLCanvasElement | null = null;
  private transformType: 'translate' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' = 'translate';
  private startBounds: {x: number, y: number, w: number, h: number} | null = null;

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

  // Internal helper to keep the memory cache fresh
  private updateLayerCache(layerId: string) {
    const canvas = this.canvasLayers.get(layerId);
    const ctx = this.ctxs.get(layerId);
    if (canvas && ctx) {
      this.layerCache.set(layerId, ctx.getImageData(0, 0, canvas.width, canvas.height));
    }
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
    
    ctx.save();
    
    // FIX 3: Removed Spritesheet clipping block so the user can draw anywhere freely

    const drawPath = (transform?: { scaleX: number, scaleY: number, transX: number, transY: number }) => {
      if (this.currentPath.length < 2) return;
      ctx.beginPath();
      
      const applyT = (pt: {x:number,y:number}) => {
        if (!transform) return pt;
        return { x: pt.x * transform.scaleX + transform.transX, y: pt.y * transform.scaleY + transform.transY };
      };
      
      const p = this.currentPath.map(applyT);
      
      if (state.tool === 'SHAPE_RECT') {
        const start = p[0];
        const end = p[p.length - 1];
        ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
      } else if (state.tool === 'SHAPE_CIRCLE') {
        const start = p[0];
        const end = p[p.length - 1];
        const radius = Math.hypot(end.x - start.x, end.y - start.y);
        ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
      } else if (state.tool === 'SHAPE_LINE') {
        const start = p[0];
        const end = p[p.length - 1];
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
      } else {
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

      // FIX 2 Implementation: Instantly restore pixel data if React unmounted this canvas previously
      const cached = this.layerCache.get(id);
      if (cached) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.putImageData(cached, 0, 0);
        ctx.restore();
      }
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
    this.layerCache.delete(id);
  }
  
  public getProjectionMatrix() {
    if (!this.threeCamera) return new THREE.Matrix4();
    return this.threeCamera.projectionMatrix.clone();
  }

  public updateActiveLayerBounds() {
    const state = useCanvasStore.getState();
    if (state.activeLayerId && state.workspace === 'PAINTING') {
      const bounds = this.getLayerContentBounds(state.activeLayerId);
      state.setActiveLayerBounds(bounds);
    } else {
      state.setActiveLayerBounds(null);
    }
  }

  // --- FIX 1: Overhauled Transform Tool Engine ---
  public startMove(x: number, y: number) {
    const state = useCanvasStore.getState();
    if (!state.activeLayerId) return;
    
    const layer = state.layers.find(l => l.id === state.activeLayerId);
    if (layer?.locked) return;

    const canvas = this.canvasLayers.get(state.activeLayerId);
    const ctx = this.ctxs.get(state.activeLayerId);
    if (!canvas || !ctx) return;

    this.startBounds = this.getLayerContentBounds(state.activeLayerId);
    if (!this.startBounds) return; 

    this.isMoving = true;
    this.moveStartX = x;
    this.moveStartY = y;

    const sb = this.startBounds;
    const THRESHOLD = 20; 
    
    const midX = sb.x + sb.w / 2;
    const midY = sb.y + sb.h / 2;

    const dNW = Math.hypot(x - sb.x, y - sb.y);
    const dNE = Math.hypot(x - (sb.x + sb.w), y - sb.y);
    const dSW = Math.hypot(x - sb.x, y - (sb.y + sb.h));
    const dSE = Math.hypot(x - (sb.x + sb.w), y - (sb.y + sb.h));
    const dN  = Math.hypot(x - midX, y - sb.y);
    const dS  = Math.hypot(x - midX, y - (sb.y + sb.h));
    const dE  = Math.hypot(x - (sb.x + sb.w), y - midY);
    const dW  = Math.hypot(x - sb.x, y - midY);

    const minD = Math.min(dNW, dNE, dSW, dSE, dN, dS, dE, dW);
    
    if (minD < THRESHOLD) {
      if (minD === dNW) this.transformType = 'nw';
      else if (minD === dNE) this.transformType = 'ne';
      else if (minD === dSW) this.transformType = 'sw';
      else if (minD === dSE) this.transformType = 'se';
      else if (minD === dN) this.transformType = 'n';
      else if (minD === dS) this.transformType = 's';
      else if (minD === dE) this.transformType = 'e';
      else if (minD === dW) this.transformType = 'w';
    } else {
      this.transformType = 'translate';
    }

    if (!this.moveSnapshotCanvas) {
      this.moveSnapshotCanvas = document.createElement('canvas');
    }
    
    const dpr = window.devicePixelRatio || 1;
    this.moveSnapshotCanvas.width = sb.w * dpr;
    this.moveSnapshotCanvas.height = sb.h * dpr;
    
    const snapCtx = this.moveSnapshotCanvas.getContext('2d');
    if (snapCtx) {
      snapCtx.clearRect(0, 0, sb.w * dpr, sb.h * dpr);
      snapCtx.drawImage(
        canvas, 
        sb.x * dpr, sb.y * dpr, sb.w * dpr, sb.h * dpr,
        0, 0, sb.w * dpr, sb.h * dpr
      );
    }

    this.saveHistoryState(state.activeLayerId, ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  public continueMove(x: number, y: number, shiftKey: boolean = false) {
    if (!this.isMoving || !this.moveSnapshotCanvas || !this.startBounds) return;

    const state = useCanvasStore.getState();
    const canvas = this.canvasLayers.get(state.activeLayerId!);
    const ctx = this.ctxs.get(state.activeLayerId!);
    if (!canvas || !ctx) return;

    const dx = x - this.moveStartX;
    const dy = y - this.moveStartY;
    
    let newBox = { ...this.startBounds };
    const ratio = this.startBounds.w / this.startBounds.h;

    switch (this.transformType) {
      case 'translate':
        newBox.x += dx;
        newBox.y += dy;
        break;
      case 'se':
        newBox.w += dx;
        if (shiftKey) newBox.h = newBox.w / ratio;
        else newBox.h += dy;
        break;
      case 'nw':
        newBox.x += dx;
        newBox.w -= dx;
        if (shiftKey) {
          const dh = (newBox.w / ratio) - this.startBounds.h;
          newBox.h += dh;
          newBox.y -= dh;
        } else {
          newBox.y += dy;
          newBox.h -= dy;
        }
        break;
      case 'ne':
        newBox.w += dx;
        if (shiftKey) {
          const dh = (newBox.w / ratio) - this.startBounds.h;
          newBox.h += dh;
          newBox.y -= dh;
        } else {
          newBox.y += dy;
          newBox.h -= dy;
        }
        break;
      case 'sw':
        newBox.x += dx;
        newBox.w -= dx;
        if (shiftKey) newBox.h = newBox.w / ratio;
        else newBox.h += dy;
        break;
      case 'e':
        newBox.w += dx;
        if (shiftKey) {
          const dh = (newBox.w / ratio) - this.startBounds.h;
          newBox.h += dh;
          newBox.y -= dh / 2; 
        }
        break;
      case 'w':
        newBox.x += dx;
        newBox.w -= dx;
        if (shiftKey) {
          const dh = (newBox.w / ratio) - this.startBounds.h;
          newBox.h += dh;
          newBox.y -= dh / 2;
        }
        break;
      case 's':
        newBox.h += dy;
        if (shiftKey) {
          const dw = (newBox.h * ratio) - this.startBounds.w;
          newBox.w += dw;
          newBox.x -= dw / 2;
        }
        break;
      case 'n':
        newBox.y += dy;
        newBox.h -= dy;
        if (shiftKey) {
          const dw = (newBox.h * ratio) - this.startBounds.w;
          newBox.w += dw;
          newBox.x -= dw / 2;
        }
        break;
    }

    // Absolute rendering logic fixes geometric distortion completely
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform matrix
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw directly from source to destination to prevent compound scaling errors
    ctx.drawImage(
      this.moveSnapshotCanvas, 
      0, 0, this.moveSnapshotCanvas.width, this.moveSnapshotCanvas.height,
      newBox.x * dpr, newBox.y * dpr, newBox.w * dpr, newBox.h * dpr
    );
    ctx.restore();

    state.setActiveLayerBounds(newBox);
  }

  public endMove() {
    if (!this.isMoving) return;
    this.isMoving = false;

    const state = useCanvasStore.getState();
    if (state.activeLayerId) {
      const canvas = this.canvasLayers.get(state.activeLayerId);
      const ctx = this.ctxs.get(state.activeLayerId);
      if (canvas && ctx) {
        this.saveHistoryState(state.activeLayerId, ctx.getImageData(0, 0, canvas.width, canvas.height));
        this.updateLayerCache(state.activeLayerId);
        state.markLayerUpdated(state.activeLayerId);
      }
    }
    this.updateActiveLayerBounds();
  }
  
  // --- DRAWING TOOL LOGIC ---
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
        this.updateLayerCache(state.activeLayerId);
      }
    }
    this.updateActiveLayerBounds();
  }

  public floodFill(x: number, y: number) {
    const state = useCanvasStore.getState();
    const activeLayerId = state.activeLayerId;
    if (!activeLayerId) return;

    const layer = state.layers.find(l => l.id === activeLayerId);
    if (layer?.locked) return;

    const canvas = this.canvasLayers.get(activeLayerId);
    const ctx = this.ctxs.get(activeLayerId);
    if (!canvas || !ctx) return;

    const beforeImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.saveHistoryState(activeLayerId, beforeImageData);

    const dpr = window.devicePixelRatio || 1;
    const sx = Math.floor(x * dpr);
    const sy = Math.floor(y * dpr);

    if (sx < 0 || sx >= canvas.width || sy < 0 || sy >= canvas.height) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    const targetPos = (sy * width + sx) * 4;
    const tr = data[targetPos], tg = data[targetPos+1], tb = data[targetPos+2], ta = data[targetPos+3];

    const hex = state.brushColor.replace('#', '');
    const fr = parseInt(hex.substring(0, 2), 16) || 0;
    const fg = parseInt(hex.substring(2, 4), 16) || 0;
    const fb = parseInt(hex.substring(4, 6), 16) || 0;
    const fa = Math.round(state.brushOpacity * 255);

    if (tr === fr && tg === fg && tb === fb && Math.abs(ta - fa) < 5) return;

    const colorMatch = (pos: number) => {
      return Math.abs(data[pos] - tr) <= 5 && 
             Math.abs(data[pos+1] - tg) <= 5 && 
             Math.abs(data[pos+2] - tb) <= 5 && 
             Math.abs(data[pos+3] - ta) <= 5;
    };
    
    const setColor = (pos: number) => { data[pos] = fr; data[pos+1] = fg; data[pos+2] = fb; data[pos+3] = fa; };

    const stack = [[sx, sy]];
    while (stack.length > 0) {
      const [cx, cy] = stack.pop()!;
      let currX = cx;
      let currY = cy;
      let pos = (currY * width + currX) * 4;

      while (currY >= 0 && colorMatch(pos)) {
        currY--;
        pos -= width * 4;
      }
      pos += width * 4;
      currY++;

      let reachLeft = false;
      let reachRight = false;

      while (currY < height && colorMatch(pos)) {
        setColor(pos);

        if (currX > 0) {
          if (colorMatch(pos - 4)) {
            if (!reachLeft) { stack.push([currX - 1, currY]); reachLeft = true; }
          } else if (reachLeft) { reachLeft = false; }
        }

        if (currX < width - 1) {
          if (colorMatch(pos + 4)) {
            if (!reachRight) { stack.push([currX + 1, currY]); reachRight = true; }
          } else if (reachRight) { reachRight = false; }
        }

        currY++;
        pos += width * 4;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const afterImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.saveHistoryState(activeLayerId, afterImageData);
    this.updateLayerCache(activeLayerId);
    state.markLayerUpdated(activeLayerId);
    this.updateActiveLayerBounds();
  }

  public undo() {
    if (this.historyPointer <= 0) return;
    
    this.historyPointer--;
    const previousState = this.history[this.historyPointer];
    
    const ctx = this.ctxs.get(previousState.layerId);
    if (ctx && previousState.imageData) {
      ctx.putImageData(previousState.imageData, 0, 0);
      this.updateLayerCache(previousState.layerId);
      useCanvasStore.getState().markLayerUpdated(previousState.layerId);
      this.updateActiveLayerBounds();
    }
  }

  public redo() {
    if (this.historyPointer >= this.history.length - 1) return;
    
    this.historyPointer++;
    const nextState = this.history[this.historyPointer];
    
    const ctx = this.ctxs.get(nextState.layerId);
    if (ctx && nextState.imageData) {
      ctx.putImageData(nextState.imageData, 0, 0);
      this.updateLayerCache(nextState.layerId);
      useCanvasStore.getState().markLayerUpdated(nextState.layerId);
      this.updateActiveLayerBounds();
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
        
        this.updateLayerCache(layerId);
        const state = useCanvasStore.getState();
        state.markLayerUpdated(layerId);
        this.updateActiveLayerBounds();
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
        this.updateLayerCache(id);
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
      this.updateLayerCache(layerId);
      state.markLayerUpdated(layerId);
      this.updateActiveLayerBounds();
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
      
      this.updateLayerCache(layerId);
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

    this.updateLayerCache(layerId);
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

    return {
      x: Math.max(0, (minX / scale) / dpr),
      y: Math.max(0, (minY / scale) / dpr),
      w: ((maxX - minX + 1) / scale) / dpr,
      h: ((maxY - minY + 1) / scale) / dpr
    };
  }

  private compositeCanvas: HTMLCanvasElement | null = null;
  
  public getCompositeCanvas(includeBackground: boolean = true): HTMLCanvasElement | null {
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
    
    if (includeBackground && state.backgroundColor && state.backgroundColor !== 'transparent') {
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

  public getCompositeBlob(includeBackground: boolean = true): Promise<Blob | null> {
    return new Promise((resolve) => {
      const canvas = this.getCompositeCanvas(includeBackground);
      if (!canvas) resolve(null);
      else canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }
}