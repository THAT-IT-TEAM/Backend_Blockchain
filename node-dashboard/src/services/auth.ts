const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

// Helper function to get API URL
const getApiUrl = (path: string): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '';
  return `${baseUrl}${path}`;
};

// Token Management
export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
};

export const clearToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

// User Management
export const getCurrentUser = (): any | null => {
  if (typeof window === 'undefined') return null;
  const userData = localStorage.getItem(USER_KEY);
  return userData ? JSON.parse(userData) : null;
};

const setCurrentUser = (user: any): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
};

export const isAuthenticated = (): boolean => {
  return !!getToken();
};

export const hasRole = (role: string): boolean => {
  const user = getCurrentUser();
  return user?.role === role;
};

// API Calls
export const login = async (email: string, password: string, walletId: string): Promise<{ token: string; user: any }> => {
  try {
    const apiUrl = getApiUrl('/auth/login');
    console.log('Login request to:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ email, password, walletId }),
      credentials: 'include', // Important for sending/receiving cookies
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }
    
    console.log('Login response:', data);
    
    if (data.token) {
      setToken(data.token);
      setCurrentUser(data.user);
      return { token: data.token, user: data.user };
    }

    throw new Error('No token received');
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const register = async (userData: { email: string; password: string; role?: string }) => {
  try {
    // Get token for authenticated registration (if available)
    const token = getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(getApiUrl('/auth/register'), {
      method: 'POST',
      headers,
      body: JSON.stringify(userData),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Registration failed. Please try again.');
    }

    const data = await response.json();
    
    // If this is the first user (admin), store the token
    if (data.token) {
      setToken(data.token);
      if (data.user) {
        setCurrentUser(data.user);
      }
    }
    
    return data;
  } catch (error) {
    console.error('Registration error:', error);
    throw new Error(error instanceof Error ? error.message : 'An error occurred during registration');
  }
};

export const logout = (): void => {
  clearToken();
  
  // Redirect to login page
  if (typeof window !== 'undefined') {
    // Clear any auth-related data
    window.localStorage.clear();
    
    // Redirect to login page
    window.location.href = '/login';
  }
};

// Check if user is admin
export const isAdmin = (): boolean => {
  const user = getCurrentUser();
  return user?.role === 'admin';
};

// Get auth headers for API calls
export const getAuthHeaders = (): HeadersInit => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};
