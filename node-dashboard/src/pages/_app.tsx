import type { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { AppLayout } from '@/components/layout/app-layout';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import '@/styles/globals.css';

// Pages that don't require authentication
const publicPages = ['/login', '/register', '/forgot-password'];

function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if the current page is public
  const isPublicPage = publicPages.includes(router.pathname);

  // Don't render anything until the app is mounted
  if (!mounted) {
    return null;
  }

  // Wrap all pages with AppLayout for authentication handling
  // For non-public pages, also wrap with DashboardLayout
  return (
    <AppLayout requiresAuth={!isPublicPage}>
      {isPublicPage ? (
        <Component {...pageProps} />
      ) : (
        <DashboardLayout>
          <Component {...pageProps} />
        </DashboardLayout>
      )}
    </AppLayout>
  );
}

export default App;
