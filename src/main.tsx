import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { SessionProvider } from './shared/session/SessionProvider';
import { createAppRouter } from './app/router';

const router = createAppRouter({
  distribution: import.meta.env.MODE === 'offline' ? 'offline' : 'pages',
  baseUrl: import.meta.env.BASE_URL,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  </StrictMode>,
);
