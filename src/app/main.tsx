import '@/shared/lib/zodConfig'; // first: before any schema is parsed
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import { AppProviders } from '@/app/AppProviders';
import { resolveInitialCity } from '@/app/lastCity';
import { listenForInstallPrompt } from '@/features/pwa';
// Imported directly (not via the feature index) so tests never load the virtual module.
import { registerServiceWorker } from '@/features/pwa/registerServiceWorker';

// Before render: beforeinstallprompt may fire before any component mounts.
listenForInstallPrompt();
registerServiceWorker();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('index.html is missing the #root element.');

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <App initialCity={resolveInitialCity()} />
    </AppProviders>
  </StrictMode>,
);
