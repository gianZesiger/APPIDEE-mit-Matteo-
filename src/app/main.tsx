import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tokens.css';
import '../styles/fonts.css';
import '../styles/app.css';
import App from './App';
import { capFx, initFx } from '../ui/fx-level';
import { registerServiceWorker } from './pwa';

// Im Handy-Rahmen der Landingpage läuft die App ruhiger: dort bewegt sich schon die Seite
if (new URLSearchParams(location.search).get('rahmen') === '1' && window.top !== window) capFx('mittel');
initFx();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
