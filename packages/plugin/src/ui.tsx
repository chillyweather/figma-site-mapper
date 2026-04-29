import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import './ui.css';
import { installRemoteConsoleOverride } from './utils/remoteLogger';

installRemoteConsoleOverride("plugin:ui");

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
