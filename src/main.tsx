import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import '../assets/style.css';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker for PWA offline capabilities
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New content available, reloading...');
  },
  onOfflineReady() {
    console.log('[PWA] App cached for offline use.');
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
