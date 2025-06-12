import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { logout } from '@/services/auth';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    // Clear auth state and redirect to login
    logout();
    // Redirect to login page after logout
    router.push('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 text-indigo-600">
          <svg
            className="animate-spin h-12 w-12"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        <p className="mt-4 text-lg font-medium text-gray-900">Signing out...</p>
      </div>
    </div>
  );
}
