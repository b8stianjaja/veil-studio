import { StudioEngine } from '../core/StudioEngine';
import { useCanvasStore } from '../store/useCanvasStore';
import { WorkspaceMode, ToolType } from '../types';

const INTERACTIVE_TOOLS: ToolType[] = [
  'BRUSH', 'ERASER', 'SMUDGE', 'BLUR', 
  'BUCKET', 'MAGIC_WAND', 
  'SHAPE_RECT', 'SHAPE_LINE', 'SHAPE_CIRCLE', 'MOVE_2D',
  'EYEDROPPER', 'SELECT_2D'
];

const DRAG_TOOLS: ToolType[] = [
  'BRUSH', 'ERASER', 'SMUDGE', 'BLUR',
  'SHAPE_RECT', 'SHAPE_LINE', 'SHAPE_CIRCLE', 'MOVE_2D', 'SELECT_2D'
];

export class InputInterceptor {
  private static isShortcutListenerAttached = false;

  // INITIALIZE GLOBAL SHORTCUTS
  static initShortcuts() {
    if (this.isShortcutListenerAttached) return;
    this.isShortcutListenerAttached = true;

    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing in a text field
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
      if (e.button === 5 || (e.buttons & 32) !== 0) {
        return 'ERASER';
      }
    }
    // Alt key automatically triggers eyedropper temporarily 
    if (e.altKey && (tool === 'BRUSH' || tool === 'ERASER')) {
      return 'EYEDROPPER';
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
      if (e.button !== 0 && e.button !== 5) return; 
      e.stopPropagation();
      
      const engine = StudioEngine.getInstance();
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const scaleX = configWidth / rect.width;
      const scaleY = configHeight / rect.height;
      
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      if (effectiveTool === 'EYEDROPPER') {
        engine.pickColor(x, y);
      } else if (effectiveTool === 'MOVE_2D') {
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
      
      if (effectiveTool === 'MOVE_2D') {
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        engine.continueMove(x, y, e.shiftKey);
      } else {
        // 120HZ FIX: Capture high-fidelity hardware polling events between frames
        const nativeEvent = e.nativeEvent;
        if (nativeEvent.getCoalescedEvents) {
          const events = nativeEvent.getCoalescedEvents();
          if (events.length > 0) {
            events.forEach(coalescedEvent => {
              const x = (coalescedEvent.clientX - rect.left) * scaleX;
              const y = (coalescedEvent.clientY - rect.top) * scaleY;
              const pressure = coalescedEvent.pressure !== undefined ? coalescedEvent.pressure : 0.5;
              engine.continueStroke(x, y, pressure);
            });
            return;
          }
        }
        
        // Fallback for older browsers
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
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