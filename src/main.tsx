import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silence benign Vite HMR websocket errors that can surface as unhandled rejections
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason === 'WebSocket closed without opened.' || 
      (event.reason && event.reason.message === 'WebSocket closed without opened.')) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
