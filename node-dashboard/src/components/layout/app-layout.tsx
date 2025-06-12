import { ReactNode } from 'react';
import { useRouter } from 'next/router';
import { isAuthenticated } from '@/services/auth';
import { LoadingSpinner } from '../ui/loading-spinner';

interface AppLayoutProps {
  children: ReactNode;
  requiresAuth?: boolean;
}

export function AppLayout({ children, requiresAuth = true }: AppLayoutProps) {
  const router = useRouter();
  
  // If authentication is not required, just render the children
  if (!requiresAuth) {
    return <>{children}</>;
  }

  // Check if user is authenticated
  const auth = isAuthenticated();
  
  // If not authenticated and not on the login page, redirect to login
  if (!auth && router.pathname !== '/login') {
    if (typeof window !== 'undefined') {
      router.push('/login');
    }
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If we're still checking authentication, show a loading spinner
  if (auth === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If authenticated, render the children
  return <>{children}</>;
}
