import { StudioEngine } from '../core/StudioEngine';
import { WorkspaceMode, ToolType } from '../types';

const INTERACTIVE_TOOLS: ToolType[] = [
  'BRUSH', 'ERASER', 'SMUDGE', 'BLUR', 
  'BUCKET', 'MAGIC_WAND', 
  'SHAPE_RECT', 'SHAPE_LINE', 'SHAPE_CIRCLE', 'MOVE_2D'
];

const DRAG_TOOLS: ToolType[] = [
  'BRUSH', 'ERASER', 'SMUDGE', 'BLUR',
  'SHAPE_RECT', 'SHAPE_LINE', 'SHAPE_CIRCLE', 'MOVE_2D'
];

export class InputInterceptor {
  
  // Helper to detect hardware pen eraser
  private static getEffectiveTool(e: React.PointerEvent<HTMLDivElement>, tool: ToolType): ToolType {
    if (e.pointerType === 'pen') {
      // button 5 is standard for eraser tip on down, buttons 32 is the bitmask during move
      if (e.button === 5 || (e.buttons & 32) !== 0) {
        return 'ERASER';
      }
    }
    return tool;
  }

  static handlePointerDown(
    e: React.PointerEvent<HTMLDivElement>, 
    workspace: WorkspaceMode, 
    tool: ToolType,
    configWidth: number,
    configHeight: number
  ) {
    const effectiveTool = this.getEffectiveTool(e, tool);

    if (workspace === 'PAINTING' && INTERACTIVE_TOOLS.includes(effectiveTool)) {
      // Allow standard left click (0) OR the hardware eraser tip (5)
      if (e.button !== 0 && e.button !== 5) return; 
      e.stopPropagation();
      
      const engine = StudioEngine.getInstance();
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const scaleX = configWidth / rect.width;
      const scaleY = configHeight / rect.height;
      
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      if (effectiveTool === 'MOVE_2D') {
        e.currentTarget.setPointerCapture(e.pointerId);
        engine.startMove(x, y);
      } else if (effectiveTool === 'BUCKET' || effectiveTool === 'MAGIC_WAND') {
        engine.floodFill(x, y);
      } else {
        e.currentTarget.setPointerCapture(e.pointerId);
        const pressure = e.pressure !== undefined ? e.pressure : 0.5;
        engine.startStroke(x, y, pressure);
      }
    }
  }

  static handlePointerMove(
    e: React.PointerEvent<HTMLDivElement>, 
    workspace: WorkspaceMode, 
    tool: ToolType,
    configWidth: number,
    configHeight: number
  ) {
    const effectiveTool = this.getEffectiveTool(e, tool);

    if (workspace === 'PAINTING' && DRAG_TOOLS.includes(effectiveTool)) {
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
      } else {
        const pressure = e.pressure !== undefined ? e.pressure : 0.5;
        engine.continueStroke(x, y, pressure);
      }
    }
  }

  static handlePointerUp(
    e: React.PointerEvent<HTMLDivElement>, 
    workspace: WorkspaceMode, 
    tool: ToolType
  ) {
    const effectiveTool = this.getEffectiveTool(e, tool);

    if (workspace === 'PAINTING' && DRAG_TOOLS.includes(effectiveTool)) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      e.stopPropagation();
      const engine = StudioEngine.getInstance();
      
      if (effectiveTool === 'MOVE_2D') {
        engine.endMove();
      } else {
        engine.endStroke();
      }
    }
  }
}