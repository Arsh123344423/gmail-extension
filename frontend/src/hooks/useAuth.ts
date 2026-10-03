import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, '');

type User = {
  name: string;
  email: string;
  picture: string;
};

export const useAuth = (redirectIfAuthenticated: boolean = false, redirectIfNotAuthenticated: boolean = false) => {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/health`, {
          method: 'GET',
          credentials: 'include'
        });
        const data = await res.json();
        setUser(data.authenticated);
      } catch (error) {
        console.error('Failed to check auth status:', error);
        setUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuthStatus();
  }, [router]);

  useEffect(() => {
    if (!isCheckingAuth) {
      if (redirectIfAuthenticated && user) {
        router.push('/');
      }
      if (redirectIfNotAuthenticated && !user) {
        router.push('/login');
      }
    }
  }, [user, isCheckingAuth, router, redirectIfAuthenticated, redirectIfNotAuthenticated]);

  return { user, isCheckingAuth };
};