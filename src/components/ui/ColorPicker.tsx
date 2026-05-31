// src/components/ui/ColorPicker.tsx
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HexColorPicker } from 'react-colorful';
import { Plus, X } from 'lucide-react';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  className?: string;
}

const PALETTE_STORAGE_KEY = 'veil-studio-global-palette';

// Helper to grab the global palette, falling back to a default theme-matching palette
const getStoredPalette = (): string[] => {
  try {
    const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : ['#db2777', '#4a044e', '#fdf8fb', '#160621', '#831843', '#f472b6'];
  } catch {
    return ['#db2777', '#4a044e', '#fdf8fb'];
  }
};

// Helper to save the palette and broadcast the update to all active pickers
const setStoredPalette = (palette: string[]) => {
  localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(palette));
  window.dispatchEvent(new Event('palette-updated'));
};

export const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [palette, setPalette] = useState<string[]>(getStoredPalette());

  const togglePicker = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      
      // Calculate position: 220px to the left of the button
      // Prevent it from clipping off the bottom of the screen (picker is now taller, ~320px)
      const maxTop = window.innerHeight - 330; 
      
      setCoords({
        top: Math.min(rect.top, maxTop),
        left: rect.left - 220, 
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close if clicking outside both the popover and the trigger button
      if (
        popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    // Close picker if user scrolls the sidebar to prevent floating
    const handleScroll = () => {
      if (isOpen) setIsOpen(false);
    };

    // Sync palette state across multiple color picker instances
    const handlePaletteSync = () => setPalette(getStoredPalette());

    window.addEventListener('palette-updated', handlePaletteSync);

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true); 
    }
    
    return () => {
      window.removeEventListener('palette-updated', handlePaletteSync);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const handleAddColor = () => {
    const normalizedColor = color.toLowerCase();
    if (!palette.includes(normalizedColor)) {
      setStoredPalette([...palette, normalizedColor]);
    }
  };

  const handleRemoveColor = (indexToRemove: number) => {
    const newPalette = palette.filter((_, idx) => idx !== indexToRemove);
    setStoredPalette(newPalette);
  };

  return (
    <div className={`relative ${className}`}>
      {/* The Color Swatch Button */}
      <div
        ref={buttonRef}
        className="w-full h-8 cursor-pointer rounded-md border border-border-subtle hover:border-border-strong transition-colors shadow-sm"
        style={{ backgroundColor: color }}
        onClick={togglePicker}
      />
      
      {/* The Floating Popover */}
      {isOpen && createPortal(
        <div 
          ref={popoverRef} 
          className="fixed z-[99999] w-[204px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-border-strong rounded-xl bg-bg-panel p-3 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-3"
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`,
          }}
        >
          {/* Main Picker */}
          <HexColorPicker color={color} onChange={onChange} />
          
          {/* Hex Input */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted font-mono uppercase">Hex</span>
            <input 
              type="text" 
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 bg-bg-input border border-border-subtle rounded text-[10px] text-text-primary px-2 py-1 outline-none font-mono uppercase focus:border-border-strong transition-colors"
            />
          </div>

          {/* Saved Palette Section */}
          <div className="pt-3 border-t border-border-subtle">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-semibold tracking-widest text-text-muted uppercase">Global Palette</span>
              <button 
                onClick={handleAddColor}
                className="p-1 rounded-md bg-bg-input hover:bg-bg-hover border border-border-subtle hover:border-border-strong text-text-secondary hover:text-text-primary transition-all flex items-center justify-center gap-1 group"
                title="Save current color"
              >
                <Plus size={12} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>
            
            <div className="flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto custom-scrollbar pr-1 -mr-1 content-start">
              {palette.length === 0 ? (
                <div className="text-[9px] text-text-muted italic w-full text-center py-2 bg-bg-input/50 rounded border border-border-subtle border-dashed">
                  No saved colors
                </div>
              ) : (
                palette.map((c, i) => (
                  <div
                    key={`${c}-${i}`}
                    className="relative group w-6 h-6 rounded-md cursor-pointer border border-border-subtle shadow-sm hover:scale-110 hover:z-10 transition-transform flex-shrink-0"
                    style={{ backgroundColor: c }}
                    onClick={() => onChange(c)}
                    title={c}
                  >
                    {/* Delete Button (Revealed on Hover) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevents setting the color when deleting
                        handleRemoveColor(i);
                      }}
                      className="absolute -top-1.5 -right-1.5 bg-bg-panel text-text-muted hover:text-red-400 hover:bg-red-500/10 border border-border-strong rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-all shadow-sm scale-75 hover:scale-90"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};