// src/core/StudioEngine.ts

import * as THREE from 'three';
import { getStroke } from 'perfect-freehand';
import { useCanvasStore } from '../store/useCanvasStore';
import { useAnimationStore } from '../store/useAnimationStore';
import { getFlattenedRenderLayers } from '../utils/layerUtils';
import { ToolType } from '../types'; // <--- ADD THIS LINE

interface HistoryState {
  layerId: string;
  blob: Blob | null; 
  status: 'pending' | 'ready' | 'error';
}

export class StudioEngine {
  private static instance: StudioEngine;
  private canvasLayers: Map<string, HTMLCanvasElement> = new Map();
  private ctxs: Map<string, CanvasRenderingContext2D> = new Map();
  private threeCamera: THREE.PerspectiveCamera | null = null;
  private threeScene: THREE.Scene | null = null;
  
  private layerCache: Map<string, HTMLCanvasElement> = new Map();

  private isDrawing: boolean = false;
  private currentPath: { x: number, y: number, pressure: number }[] = [];
  
  private strokeSnapshot: HTMLCanvasElement | null = null;
  private rafId: number | null = null;

  // Track the user's active selection to act as a clipping mask
  private selectionPath: Path2D | null = null;

  private boundingStartPoint: { x: number, y: number } | null = null;
  private currentBoundingTool: ToolType | null = null;

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

  public pickColor(x: number, y: number) {
    const canvas = this.getCompositeCanvas(true);
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const pixel = ctx.getImageData(x * dpr, y * dpr, 1, 1).data;
    
    if (pixel[3] === 0) return;

    const rgbToHex = (r: number, g: number, b: number) => {
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    };

    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    useCanvasStore.getState().setBrushSettings({ color: hex });
  }

  private renderLoop() {
    this.rafId = requestAnimationFrame(this.renderLoop);
    this.flushPaints();
  }

  private updateLayerCache(layerId: string) {
    const canvas = this.canvasLayers.get(layerId);
    if (!canvas) return;
    
    let cacheCanvas = this.layerCache.get(layerId);
    if (!cacheCanvas) {
      cacheCanvas = document.createElement('canvas');
      this.layerCache.set(layerId, cacheCanvas);
    }
    cacheCanvas.width = canvas.width;
    cacheCanvas.height = canvas.height;
    const cCtx = cacheCanvas.getContext('2d');
    if (cCtx) {
      cCtx.clearRect(0, 0, cacheCanvas.width, cacheCanvas.height);
      cCtx.drawImage(canvas, 0, 0);
    }
  }

  private flushPaints() {
    if (this.currentPath.length === 0) return;

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
    
    // --- FIX APPLIED HERE ---
    if (this.strokeSnapshot) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to 1:1 physical pixel mapping
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(this.strokeSnapshot, 0, 0);
      ctx.restore(); // Restore the dpr scaling for the current stroke
    }
    // ------------------------
    
    ctx.save();

    if (this.selectionPath && state.tool !== 'SELECT_2D') {
      ctx.clip(this.selectionPath);
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
    
    const drawPath = (transform?: { scaleX: number, scaleY: number, transX: number, transY: number }) => {
      if (this.currentPath.length === 0) return;
      
      const applyT = (pt: {x:number, y:number, pressure:number}) => {
        if (!transform) return pt;
        return { x: pt.x * transform.scaleX + transform.transX, y: pt.y * transform.scaleY + transform.transY, pressure: pt.pressure };
      };
      
      const p = this.currentPath.map(applyT);
      
      if (state.tool === 'BRUSH' || state.tool === 'ERASER') {
        const strokePoints = getStroke(p.map(pt => [pt.x, pt.y, pt.pressure]), {
          size: state.brushSize,
          thinning: 0.6,
          smoothing: 0.5,
          streamline: 0.5,
          simulatePressure: p.every(pt => pt.pressure === 0.5) 
        });

        if (strokePoints.length === 0) return;

        ctx.beginPath();
        ctx.moveTo(strokePoints[0][0], strokePoints[0][1]);
        for (let i = 1; i < strokePoints.length; i++) {
          ctx.lineTo(strokePoints[i][0], strokePoints[i][1]);
        }
        ctx.closePath();
        
        ctx.fillStyle = brushStr; 
        ctx.fill();
        return; 
      }
      
      if (this.currentPath.length < 2) return;
      ctx.beginPath();
      
      if (state.tool === 'SHAPE_RECT' || state.tool === 'SELECT_2D') {
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

      if (state.tool === 'SELECT_2D') {
        ctx.strokeStyle = '#00ffff';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.stroke();
      }
    };

    drawPath();

    if (canvas && (state.symmetryX || state.symmetryY) && state.tool !== 'SELECT_2D') {
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
    
    const ctx = canvas.getContext('2d', { desynchronized: true });
    if (ctx) {
      ctx.scale(dpr, dpr);
      this.ctxs.set(id, ctx);

      const cachedCanvas = this.layerCache.get(id);
      if (cachedCanvas) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(cachedCanvas, 0, 0);
        ctx.restore();
      }
    }
    this.canvasLayers.set(id, canvas);
  }
  
  public unregisterLayer(id: string) {
    this.canvasLayers.delete(id);
    this.ctxs.delete(id);
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

    if (this.history.length === 0) {
      this.pushToHistory(state.activeLayerId, canvas);
    }

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

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.drawImage(
      this.moveSnapshotCanvas, 
      0, 0, this.moveSnapshotCanvas.width, this.moveSnapshotCanvas.height,
      sb.x * dpr, sb.y * dpr, sb.w * dpr, sb.h * dpr
    );
    ctx.restore();
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
      case 'translate': newBox.x += dx; newBox.y += dy; break;
      case 'se': newBox.w += dx; if (shiftKey) newBox.h = newBox.w / ratio; else newBox.h += dy; break;
      case 'nw':
        newBox.x += dx; newBox.w -= dx;
        if (shiftKey) { const dh = (newBox.w / ratio) - this.startBounds.h; newBox.h += dh; newBox.y -= dh; } 
        else { newBox.y += dy; newBox.h -= dy; }
        break;
      case 'ne':
        newBox.w += dx;
        if (shiftKey) { const dh = (newBox.w / ratio) - this.startBounds.h; newBox.h += dh; newBox.y -= dh; } 
        else { newBox.y += dy; newBox.h -= dy; }
        break;
      case 'sw': newBox.x += dx; newBox.w -= dx; if (shiftKey) newBox.h = newBox.w / ratio; else newBox.h += dy; break;
      case 'e': newBox.w += dx; if (shiftKey) { const dh = (newBox.w / ratio) - this.startBounds.h; newBox.h += dh; newBox.y -= dh / 2; } break;
      case 'w': newBox.x += dx; newBox.w -= dx; if (shiftKey) { const dh = (newBox.w / ratio) - this.startBounds.h; newBox.h += dh; newBox.y -= dh / 2; } break;
      case 's': newBox.h += dy; if (shiftKey) { const dw = (newBox.h * ratio) - this.startBounds.w; newBox.w += dw; newBox.x -= dw / 2; } break;
      case 'n': newBox.y += dy; newBox.h -= dy; if (shiftKey) { const dw = (newBox.h * ratio) - this.startBounds.w; newBox.w += dw; newBox.x -= dw / 2; } break;
    }

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
      if (canvas) {
        this.pushToHistory(state.activeLayerId, canvas);
        this.updateLayerCache(state.activeLayerId);
        state.markLayerUpdated(state.activeLayerId);
      }
    }
    this.updateActiveLayerBounds();
  }
  
  public startStroke(x: number, y: number, pressure: number = 0.5) {
    const state = useCanvasStore.getState();
    const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
    if (activeLayer?.locked) return;

    const canvas = this.canvasLayers.get(state.activeLayerId!);
    const ctx = this.ctxs.get(state.activeLayerId!);
    
    if (canvas && ctx) {
      if (this.history.length === 0) {
        this.pushToHistory(state.activeLayerId!, canvas);
      }
      
      if (!this.strokeSnapshot) {
        this.strokeSnapshot = document.createElement('canvas');
      }
      this.strokeSnapshot.width = canvas.width;
      this.strokeSnapshot.height = canvas.height;
      const snapCtx = this.strokeSnapshot.getContext('2d');
      if (snapCtx) {
        snapCtx.clearRect(0, 0, canvas.width, canvas.height);
        snapCtx.drawImage(canvas, 0, 0);
      }
    }

    let nx = x;
    let ny = y;
    if (state.showGrid) {
      nx = Math.round(nx / 50) * 50;
      ny = Math.round(ny / 50) * 50;
    }

    this.isDrawing = true;
    this.currentPath = [{ x: nx, y: ny, pressure }];
  }

  public continueStroke(x: number, y: number, pressure: number = 0.5) {
    if (!this.isDrawing) return;
    
    const state = useCanvasStore.getState();
    let nx = x;
    let ny = y;
    
    if (state.showGrid) {
      nx = Math.round(nx / 50) * 50;
      ny = Math.round(ny / 50) * 50;
    }

    this.currentPath.push({ x: nx, y: ny, pressure });
  }

  public endStroke() {
    const state = useCanvasStore.getState();

    if (state.tool === 'SELECT_2D') {
      if (this.currentPath.length >= 2) {
         const p = new Path2D();
         const start = this.currentPath[0];
         const end = this.currentPath[this.currentPath.length - 1];
         p.rect(start.x, start.y, end.x - start.x, end.y - start.y);
         this.selectionPath = p;
      } else {
         this.selectionPath = null;
      }
    }

    this.isDrawing = false;
    this.flushPaints();
    this.currentPath = [];

    if (state.activeLayerId && state.tool !== 'SELECT_2D') {
      state.markLayerUpdated(state.activeLayerId);
      const canvas = this.canvasLayers.get(state.activeLayerId);
      if (canvas) {
        this.pushToHistory(state.activeLayerId, canvas);
        this.updateLayerCache(state.activeLayerId);
      }
    }
    this.updateActiveLayerBounds();
  }

  public startBoundingTool(x: number, y: number, tool: ToolType) {
    this.boundingStartPoint = { x, y };
    this.currentBoundingTool = tool;
    
    const state = useCanvasStore.getState();
    if (state.activeLayerId) {
      const canvas = this.canvasLayers.get(state.activeLayerId);
      if (canvas && this.history.length === 0) {
        this.pushToHistory(state.activeLayerId, canvas);
      }
      
      if (!this.strokeSnapshot) {
        this.strokeSnapshot = document.createElement('canvas');
      }
      this.strokeSnapshot.width = canvas!.width;
      this.strokeSnapshot.height = canvas!.height;
      const snapCtx = this.strokeSnapshot.getContext('2d');
      if (snapCtx) {
        snapCtx.clearRect(0, 0, canvas!.width, canvas!.height);
        snapCtx.drawImage(canvas!, 0, 0);
      }
    }
  }

  public continueBoundingTool(x: number, y: number, isShiftPressed: boolean) {
    if (!this.boundingStartPoint || !this.currentBoundingTool) return;

    const state = useCanvasStore.getState();
    const activeLayerId = state.activeLayerId;
    if (!activeLayerId) return;

    const ctx = this.ctxs.get(activeLayerId);
    const canvas = this.canvasLayers.get(activeLayerId);
    if (!ctx || !canvas) return;

    if (this.strokeSnapshot) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(this.strokeSnapshot, 0, 0);
      ctx.restore();
    }

    let endX = x;
    let endY = y;
    const startX = this.boundingStartPoint.x;
    const startY = this.boundingStartPoint.y;

    if (isShiftPressed) {
      const dx = endX - startX;
      const dy = endY - startY;
      const maxDist = Math.max(Math.abs(dx), Math.abs(dy));
      endX = startX + maxDist * Math.sign(dx);
      endY = startY + maxDist * Math.sign(dy);
    }

    ctx.save();
    
    if (this.currentBoundingTool === 'SELECT_2D') {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, startY, endX - startX, endY - startY);
      
      this.selectionPath = new Path2D();
      this.selectionPath.rect(startX, startY, endX - startX, endY - startY);
    } else {
      ctx.strokeStyle = state.brushColor;
      ctx.fillStyle = state.brushColor;
      ctx.lineWidth = state.brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      if (this.currentBoundingTool === 'SHAPE_RECT') {
        ctx.rect(startX, startY, endX - startX, endY - startY);
        ctx.stroke();
      } else if (this.currentBoundingTool === 'SHAPE_CIRCLE') {
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        ctx.arc(startX, startY, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (this.currentBoundingTool === 'SHAPE_LINE') {
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    }
    
    ctx.restore();
    this.updateLayerCache(activeLayerId);
  }

  public endBoundingTool() {
    this.boundingStartPoint = null;
    this.currentBoundingTool = null;
    
    const state = useCanvasStore.getState();
    if (state.activeLayerId) {
      const canvas = this.canvasLayers.get(state.activeLayerId);
      if (canvas && this.strokeSnapshot) {
        const snapCtx = this.strokeSnapshot.getContext('2d');
        if (snapCtx) {
          snapCtx.clearRect(0, 0, this.strokeSnapshot.width, this.strokeSnapshot.height);
          snapCtx.drawImage(canvas, 0, 0);
        }
        this.pushToHistory(state.activeLayerId, canvas);
        state.markLayerUpdated(state.activeLayerId);
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

    if (this.history.length === 0) {
      this.pushToHistory(activeLayerId, canvas);
    }

    const dpr = window.devicePixelRatio || 1;
    const sx = Math.floor(x * dpr);
    const sy = Math.floor(y * dpr);

    if (sx < 0 || sx >= canvas.width || sy < 0 || sy >= canvas.height) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    const visited = new Uint8Array(width * height);

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
      let pixelIndex = currY * width + currX;

      while (currY >= 0 && colorMatch(pos) && !visited[pixelIndex]) {
        currY--;
        pos -= width * 4;
        pixelIndex -= width;
      }
      pos += width * 4;
      pixelIndex += width;
      currY++;

      let reachLeft = false;
      let reachRight = false;

      while (currY < height && colorMatch(pos) && !visited[pixelIndex]) {
        setColor(pos);
        visited[pixelIndex] = 1;

        if (currX > 0) {
          if (colorMatch(pos - 4) && !visited[pixelIndex - 1]) {
            if (!reachLeft) { stack.push([currX - 1, currY]); reachLeft = true; }
          } else if (reachLeft) { reachLeft = false; }
        }

        if (currX < width - 1) {
          if (colorMatch(pos + 4) && !visited[pixelIndex + 1]) {
            if (!reachRight) { stack.push([currX + 1, currY]); reachRight = true; }
          } else if (reachRight) { reachRight = false; }
        }

        currY++;
        pos += width * 4;
        pixelIndex += width;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    this.pushToHistory(activeLayerId, canvas);
    this.updateLayerCache(activeLayerId);
    state.markLayerUpdated(activeLayerId);
    this.updateActiveLayerBounds();
  }

  private pushToHistory(layerId: string, canvas: HTMLCanvasElement) {
    if (this.historyPointer < this.history.length - 1) {
      this.history.splice(this.historyPointer + 1);
    }

    const state: HistoryState = { layerId, blob: null, status: 'pending' };
    this.history.push(state);

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyPointer++;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tCtx = tempCanvas.getContext('2d');
    if (tCtx) tCtx.drawImage(canvas, 0, 0);

    tempCanvas.toBlob((blob) => {
      if (blob) {
        state.blob = blob;
        state.status = 'ready';
      } else {
        state.status = 'error'; 
      }
      tempCanvas.width = 0; 
      tempCanvas.height = 0;
    }, 'image/png');
  }

  private applyHistoryState(state: HistoryState) {
    if (state.status === 'error') return; 

    if (state.status === 'pending' || !state.blob) {
      requestAnimationFrame(() => this.applyHistoryState(state));
      return;
    }

    const ctx = this.ctxs.get(state.layerId);
    const canvas = this.canvasLayers.get(state.layerId);
    if (ctx && canvas) {
      const img = new Image();
      const url = URL.createObjectURL(state.blob);
      
      img.onload = () => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
        
        URL.revokeObjectURL(url);
        
        this.updateLayerCache(state.layerId);
        useCanvasStore.getState().markLayerUpdated(state.layerId);
        this.updateActiveLayerBounds();
      };
      img.src = url;
    }
  }

  public undo() {
    if (this.historyPointer <= 0) return;
    this.historyPointer--;
    this.applyHistoryState(this.history[this.historyPointer]);
  }

  public redo() {
    if (this.historyPointer >= this.history.length - 1) return;
    this.historyPointer++;
    this.applyHistoryState(this.history[this.historyPointer]);
  }

  public getFrameBuffer(layerId: string) {
    return this.canvasLayers.get(layerId);
  }

  public restoreLayerBuffer(layerId: string, bufferData: string | Blob): Promise<void> {
    return new Promise((resolve) => {
      if (!bufferData) {
        this.clearLayer(layerId);
        return resolve();
      }
      
      const canvas = this.canvasLayers.get(layerId);
      const ctx = this.ctxs.get(layerId);
      if (!canvas || !ctx) return resolve();

      const img = new Image();
      img.onload = () => {
        const currentCanvas = this.canvasLayers.get(layerId);
        const currentCtx = this.ctxs.get(layerId);
        
        if (!currentCanvas || !currentCtx || currentCanvas.width === 0 || currentCanvas.height === 0) {
          if (bufferData instanceof Blob) URL.revokeObjectURL(img.src);
          return resolve();
        }

        currentCtx.save();
        currentCtx.setTransform(1, 0, 0, 1, 0, 0);
        currentCtx.globalCompositeOperation = 'source-over';
        currentCtx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
        currentCtx.drawImage(img, 0, 0);
        currentCtx.restore();
        
        this.updateLayerCache(layerId);
        const state = useCanvasStore.getState();
        state.markLayerUpdated(layerId);
        this.updateActiveLayerBounds();
        
        if (bufferData instanceof Blob) {
          URL.revokeObjectURL(img.src);
        }
        
        resolve();
      };
      
      if (bufferData instanceof Blob) {
        img.src = URL.createObjectURL(bufferData);
      } else {
        img.src = bufferData;
      }
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
        // 1. Restore the permanent scale required by the engine for future paths!
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        
        // 2. Draw the backup safely without double-scaling
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
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
      if (this.history.length === 0) this.pushToHistory(layerId, canvas);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      
      this.pushToHistory(layerId, canvas);
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
      if (this.history.length === 0) this.pushToHistory(layerId, canvas);

      const physicalW = canvas.width / columns; 
      const physicalH = canvas.height / rows;
      
      const col = frameIndex % columns;
      const row = Math.floor(frameIndex / columns);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(col * physicalW, row * physicalH, physicalW, physicalH);
      ctx.restore();
      
      this.pushToHistory(layerId, canvas);
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

    if (this.history.length === 0) this.pushToHistory(layerId, canvas);

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

    this.pushToHistory(layerId, canvas);
    this.updateLayerCache(layerId);
    state.markLayerUpdated(layerId);
  }

  public getLayerContentBounds(layerId: string): { x: number, y: number, w: number, h: number } | null {
    const canvas = this.canvasLayers.get(layerId);
    const ctx = this.ctxs.get(layerId);
    if (!canvas || !ctx) return null;

    const width = canvas.width;
    const height = canvas.height;
    
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let minX = width, minY = height, maxX = -1, maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
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
      x: minX / dpr,
      y: minY / dpr,
      w: (maxX - minX + 1) / dpr,
      h: (maxY - minY + 1) / dpr
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

  public getLayerCacheBlob(layerId: string): Promise<Blob | null> {
    return new Promise((resolve) => {
      const cachedCanvas = this.layerCache.get(layerId);
      if (!cachedCanvas) return resolve(null);
      
      cachedCanvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }
}