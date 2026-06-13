import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { pushSystemToast } from './lib/systemToast';
import './index.css';

registerSW({
  immediate: true,
  onNeedRefresh() {
    pushSystemToast('A new version is available. Refresh the page when you are ready.', 'info', 12000);
  },
  onOfflineReady() {
    pushSystemToast('Niolla PM is ready to work offline.', 'success', 6000);
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
