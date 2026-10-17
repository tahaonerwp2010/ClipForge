import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// On Android the engine starts first (window.__cfReady is set by the mobile bundle); on desktop there is nothing to wait for.
Promise.resolve((window as any).__cfReady).then(() => createRoot(document.getElementById('root')!).render(<App />));
