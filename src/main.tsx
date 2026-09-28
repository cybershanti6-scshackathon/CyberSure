import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { CyberSureProvider } from '@/lib/store';
import { ThemeProvider } from '@/hooks/useTheme';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root was not found in index.html');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <CyberSureProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </CyberSureProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
