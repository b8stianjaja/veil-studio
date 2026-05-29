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
      <div className="w-full h-screen bg-bg-app flex items-center justify-center text-text-primary">
        <div className="animate-pulse tracking-widest uppercase text-xs text-text-muted font-medium">Checking Workspace...</div>
      </div>
    );
  }

  return isConfigured ? <WorkspaceLayout /> : <ProjectSetupModal hasAutoSave={hasAutoSave} />;
}


