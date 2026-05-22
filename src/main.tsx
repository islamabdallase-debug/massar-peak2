// ============================================================
//  مسار — Entry Point  v5.0.0
// ============================================================

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary, installGlobalErrorHandlers } from '@/components/ui/ErrorBoundary';
import './index.css';

// Install global error handlers before mounting
installGlobalErrorHandlers();

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found in document');

createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary context="root">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
