import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
  MutationCache,
} from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import type { AxiosError } from 'axios';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import './index.css';

// Global error handler for queries
const queryCache = new QueryCache({
  onError: (error: unknown) => {
    const axiosError = error as AxiosError<{ message?: string }>;

    // Skip handling if:
    // 1. 401 (unauthorized) - handled by API interceptor (redirects to login)
    // 2. Cancelled requests
    if (
      axiosError.response?.status === 401 ||
      axiosError.code === 'ERR_CANCELED'
    ) {
      return;
    }

    // Extract error message
    const errorMessage =
      (axiosError.response?.data as { message?: string })?.message ??
      axiosError.message ??
      'Something went wrong';

    toast.error(errorMessage);
  },
});

// Same for mutations
const mutationCache = new MutationCache({
  onError: (error: unknown) => {
    const axiosError = error as AxiosError<{ message?: string }>;
    if (
      axiosError.response?.status === 401 ||
      axiosError.code === 'ERR_CANCELED'
    ) {
      return;
    }
    const errorMessage =
      (axiosError.response?.data as { message?: string })?.message ??
      axiosError.message ??
      'Something went wrong';
    toast.error(errorMessage);
  },
});

const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry on network errors (server down)
        if (error && (error as AxiosError).code === 'ERR_NETWORK') {
          return false;
        }
        // Retry once for other errors
        return failureCount < 1;
      },
      // Don't throw errors by default - let components handle them
      throwOnError: false,
    },
    mutations: {
      // Don't throw errors by default - handled globally and in hooks
      throwOnError: false,
    },
  },
});

// Get Google OAuth Client ID from environment variable
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Analytics />
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
