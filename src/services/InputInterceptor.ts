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
  
  static handlePointerDown(
    e: React.PointerEvent<HTMLDivElement>, 
    workspace: WorkspaceMode, 
    tool: ToolType,
    configWidth: number,
    configHeight: number
  ) {
    if (workspace === 'PAINTING' && INTERACTIVE_TOOLS.includes(tool)) {
      if (e.button !== 0) return; 
      e.stopPropagation();
      
      const engine = StudioEngine.getInstance();
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const scaleX = configWidth / rect.width;
      const scaleY = configHeight / rect.height;
      
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      if (tool === 'MOVE_2D') {
        e.currentTarget.setPointerCapture(e.pointerId);
        engine.startMove(x, y);
      } else if (tool === 'BUCKET' || tool === 'MAGIC_WAND') {
        engine.floodFill(x, y);
      } else {
        e.currentTarget.setPointerCapture(e.pointerId);
        engine.startStroke(x, y);
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
    if (workspace === 'PAINTING' && DRAG_TOOLS.includes(tool)) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      
      e.stopPropagation();
      const engine = StudioEngine.getInstance();
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const scaleX = configWidth / rect.width;
      const scaleY = configHeight / rect.height;
      
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      if (tool === 'MOVE_2D') {
        // FIXED: Passing shiftKey for proportional scaling
        engine.continueMove(x, y, e.shiftKey);
      } else {
        engine.continueStroke(x, y);
      }
    }
  }

  static handlePointerUp(
    e: React.PointerEvent<HTMLDivElement>, 
    workspace: WorkspaceMode, 
    tool: ToolType
  ) {
    if (workspace === 'PAINTING' && DRAG_TOOLS.includes(tool)) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      e.stopPropagation();
      const engine = StudioEngine.getInstance();
      
      if (tool === 'MOVE_2D') {
        engine.endMove();
      } else {
        engine.endStroke();
      }
    }
  }
}