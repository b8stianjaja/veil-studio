import { StudioEngine } from '../core/StudioEngine';
import { WorkspaceMode, ToolType } from '../types';

/**
 * Intercepts raw browser pointer events before they reach the renderer.
 * Routes events to 3D controller or Canvas engine based on workspace mode.
 */
export class InputInterceptor {
  
  static handlePointerDown(
    e: React.PointerEvent<HTMLDivElement>, 
    workspace: WorkspaceMode, 
    tool: ToolType,
    configWidth: number,
    configHeight: number
  ) {
    if (workspace === 'PAINTING' && (tool === 'BRUSH' || tool === 'ERASER')) {
      if (e.button !== 0) return; // Only draw on primary click
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      
      const engine = StudioEngine.getInstance();
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const scaleX = configWidth / rect.width;
      const scaleY = configHeight / rect.height;
      
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      engine.startStroke(x, y);
    }
  }

  static handlePointerMove(
    e: React.PointerEvent<HTMLDivElement>, 
    workspace: WorkspaceMode, 
    tool: ToolType,
    configWidth: number,
    configHeight: number
  ) {
    if (workspace === 'PAINTING' && (tool === 'BRUSH' || tool === 'ERASER')) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      
      e.stopPropagation();
      const engine = StudioEngine.getInstance();
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const scaleX = configWidth / rect.width;
      const scaleY = configHeight / rect.height;
      
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      engine.continueStroke(x, y);
    }
  }

  static handlePointerUp(
    e: React.PointerEvent<HTMLDivElement>, 
    workspace: WorkspaceMode, 
    tool: ToolType
  ) {
    if (workspace === 'PAINTING' && (tool === 'BRUSH' || tool === 'ERASER')) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      e.stopPropagation();
      const engine = StudioEngine.getInstance();
      engine.endStroke();
    }
  }
}
