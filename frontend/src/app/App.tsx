import React from 'react';
import { Toaster } from 'sonner';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './context/AuthContext';
import { UnreadBookingsProvider } from './contexts/UnreadBookingsContext';
import { NotificationsProvider } from './contexts/NotificationsContext';

function App() {
  return (
    <AuthProvider>
      <UnreadBookingsProvider>
        <NotificationsProvider>
          <RouterProvider router={router} />
        </NotificationsProvider>
      </UnreadBookingsProvider>
      <Toaster theme="light" position="top-center" />
    </AuthProvider>
  );
}

export default App;
