/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { WorkspaceLayout } from './components/views/WorkspaceLayout';
import { ProjectSetupModal } from './components/views/ProjectSetupModal';
import { useCanvasStore } from './store/useCanvasStore';
import { AutoSaveService } from './services/AutoSaveService';

export default function App() {
  const isConfigured = useCanvasStore(state => state.projectConfigured);
  const [hasAutoSave, setHasAutoSave] = useState(false);
  const [checkingSave, setCheckingSave] = useState(true);
  const theme = useCanvasStore(state => state.theme);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    AutoSaveService.hasAutoSave().then((hasSave) => {
       setHasAutoSave(hasSave);
       setCheckingSave(false);
       AutoSaveService.registerStoreSubscriptions();
    });
  }, []);

if (checkingSave) {
    return (
      <div className="w-full h-screen bg-bg-app flex items-center justify-center text-text-primary overflow-hidden relative font-sans">
        {/* Ambient background glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 bg-accent/20 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '4s' }}></div>
        </div>
        
        {/* Central Logo & Loaders */}
        <div className="relative z-10 flex flex-col items-center gap-8 animate-in fade-in duration-1000">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Outer spinning ring */}
            <div className="absolute inset-0 border-2 border-transparent border-t-accent/80 border-l-accent/30 rounded-full animate-spin" style={{ animationDuration: '1.5s' }}></div>
            {/* Inner counter-spinning ring */}
            <div className="absolute inset-3 border border-transparent border-b-text-muted/50 border-r-text-muted/50 rounded-full animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>
            
            {/* Logo */}
            <img 
              src="/marisopa.png" 
              alt="Veil Studio" 
              className="w-10 h-10 object-contain drop-shadow-[0_0_15px_var(--color-accent)] opacity-90" 
            />
          </div>
          
          <div className="flex flex-col items-center gap-3">
            <h1 className="font-display font-medium tracking-[0.25em] uppercase text-sm text-text-primary drop-shadow-md">
              Veil Studio
            </h1>
            <div className="flex items-center gap-2.5 opacity-70">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" style={{ animationDuration: '1.5s' }}></span>
              <span className="tracking-widest uppercase text-[9px] text-text-muted font-semibold">
                Initializing Environment
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return isConfigured ? <WorkspaceLayout /> : <ProjectSetupModal hasAutoSave={hasAutoSave} />;
}


