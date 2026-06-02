// src/services/InputInterceptor.ts

import { StudioEngine } from '../core/StudioEngine';
import { useCanvasStore } from '../store/useCanvasStore';
import { WorkspaceMode, ToolType } from '../types';

const FREEHAND_TOOLS: ToolType[] = ['BRUSH', 'ERASER', 'SMUDGE', 'BLUR'];
const BOUNDING_TOOLS: ToolType[] = ['SHAPE_RECT', 'SHAPE_LINE', 'SHAPE_CIRCLE', 'SELECT_2D'];
const INSTANT_TOOLS: ToolType[] = ['BUCKET', 'MAGIC_WAND', 'EYEDROPPER'];

export class InputInterceptor {
  private static isShortcutListenerAttached = false;

  static initShortcuts() {
    if (this.isShortcutListenerAttached) return;
    this.isShortcutListenerAttached = true;

    window.addEventListener('keydown', (e) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      const state = useCanvasStore.getState();
      switch(e.key.toLowerCase()) {
        case 'b': state.setTool('BRUSH'); break;
        case 'e': state.setTool('ERASER'); break;
        case 'v': state.setTool('MOVE_2D'); break;
        case 'g': state.setTool('BUCKET'); break;
        case 'w': state.setTool('MAGIC_WAND'); break;
        case 'i': state.setTool('EYEDROPPER'); break;
        case 'm': state.setTool('SELECT_2D'); break;
        case '[': state.setBrushSettings({ size: Math.max(1, state.brushSize - 1) }); break;
        case ']': state.setBrushSettings({ size: Math.min(200, state.brushSize + 1) }); break;
      }
    });
  }
  
  private static getEffectiveTool(e: React.PointerEvent<HTMLDivElement>, tool: ToolType): ToolType {
    if (e.pointerType === 'pen') {
      if (e.button === 5 || (e.buttons & 32) !== 0) return 'ERASER';
    }
    if (e.altKey && (tool === 'BRUSH' || tool === 'ERASER')) return 'EYEDROPPER';
    return tool;
  }

  static handlePointerDown(e: React.PointerEvent<HTMLDivElement>, workspace: WorkspaceMode, tool: ToolType, configWidth: number, configHeight: number) {
    const effectiveTool = this.getEffectiveTool(e, tool);

    if (workspace === 'PAINTING') {
      if (e.button !== 0 && e.button !== 5) return; 
      e.stopPropagation();
      
      const engine = StudioEngine.getInstance();
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const scaleX = configWidth / rect.width;
      const scaleY = configHeight / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      e.currentTarget.setPointerCapture(e.pointerId);

      if (effectiveTool === 'EYEDROPPER') {
        engine.pickColor(x, y);
      } else if (effectiveTool === 'MOVE_2D') {
        engine.startMove(x, y);
      } else if (INSTANT_TOOLS.includes(effectiveTool)) {
        engine.floodFill(x, y);
      } else if (BOUNDING_TOOLS.includes(effectiveTool)) {
        engine.startBoundingTool(x, y, effectiveTool);
      } else if (FREEHAND_TOOLS.includes(effectiveTool)) {
        const pressure = e.pressure !== undefined ? e.pressure : 0.5;
        engine.startStroke(x, y, pressure);
      }
    }
  }

  static handlePointerMove(e: React.PointerEvent<HTMLDivElement>, workspace: WorkspaceMode, tool: ToolType, configWidth: number, configHeight: number) {
    const effectiveTool = this.getEffectiveTool(e, tool);

    if (workspace === 'PAINTING') {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      e.stopPropagation();
      
      const engine = StudioEngine.getInstance();
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const scaleX = configWidth / rect.width;
      const scaleY = configHeight / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      if (effectiveTool === 'MOVE_2D') {
        engine.continueMove(x, y, e.shiftKey);
      } else if (effectiveTool === 'EYEDROPPER') {
        engine.pickColor(x, y); // Allows scrubbing to find color
      } else if (BOUNDING_TOOLS.includes(effectiveTool)) {
        engine.continueBoundingTool(x, y, e.shiftKey);
      } else if (FREEHAND_TOOLS.includes(effectiveTool)) {
        const pressure = e.pressure !== undefined ? e.pressure : 0.5;
        engine.continueStroke(x, y, pressure);
      }
    }
  }

  static handlePointerUp(e: React.PointerEvent<HTMLDivElement>, workspace: WorkspaceMode, tool: ToolType) {
    const effectiveTool = this.getEffectiveTool(e, tool);

    if (workspace === 'PAINTING') {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      e.stopPropagation();
      const engine = StudioEngine.getInstance();
      
      if (effectiveTool === 'MOVE_2D') {
        engine.endMove();
      } else if (BOUNDING_TOOLS.includes(effectiveTool)) {
        engine.endBoundingTool();
      } else if (FREEHAND_TOOLS.includes(effectiveTool)) {
        engine.endStroke();
      }
    }
  }
}