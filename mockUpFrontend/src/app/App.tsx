import React from 'react';
import { Toaster } from 'sonner';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './context/AuthContext';
import { UnreadBookingsProvider } from './contexts/UnreadBookingsContext';

function App() {
  return (
    <AuthProvider>
      <UnreadBookingsProvider>
        <RouterProvider router={router} />
      </UnreadBookingsProvider>
      <Toaster theme="light" position="top-center" />
    </AuthProvider>
  );
}

export default App;
