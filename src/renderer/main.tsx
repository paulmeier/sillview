import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Grid drag/resize visuals, then our Tailwind + dark-theme overrides last.
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
