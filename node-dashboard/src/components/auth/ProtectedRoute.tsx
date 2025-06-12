import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { isAuthenticated } from '@/services/auth';
import { LoadingSpinner } from '../ui/loading-spinner';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const auth = isAuthenticated();
      setIsAuth(auth);
      
      if (!auth) {
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  if (isAuth === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return isAuth ? <>{children}</> : null;
}
