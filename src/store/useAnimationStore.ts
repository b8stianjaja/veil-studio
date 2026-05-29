import { create } from 'zustand';

interface AnimationState {
  rows: number;
  columns: number;
  activeFrame: number;
  isPlaying: boolean;
  fps: number;
  onionSkinFrames: number;
  onionSkinOpacity: number;
  showPreview: boolean;
  
  setGrid: (rows: number, columns: number) => void;
  setActiveFrame: (frame: number) => void;
  togglePlayback: () => void;
  setFps: (fps: number) => void;
  setOnionSkin: (frames: number, opacity: number) => void;
  setShowPreview: (show: boolean) => void;
  restoreState: (rows: number, columns: number, activeFrame: number) => void;
}

export const useAnimationStore = create<AnimationState>((set) => ({
  rows: 4,
  columns: 4,
  activeFrame: 0,
  isPlaying: false,
  fps: 12,
  onionSkinFrames: 1,
  onionSkinOpacity: 0.3,
  showPreview: false,
  
  setGrid: (rows, columns) => set({ rows, columns }),
  setActiveFrame: (frame) => set({ activeFrame: frame }),
  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setFps: (fps) => set({ fps }),
  setOnionSkin: (onionSkinFrames, onionSkinOpacity) => set({ onionSkinFrames, onionSkinOpacity }),
  setShowPreview: (showPreview) => set({ showPreview }),
  restoreState: (rows, columns, activeFrame) => set({ rows, columns, activeFrame })
}));
