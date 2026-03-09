import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '@/lib/api';
import { clearAuth, getToken, saveAuth, User } from '@/lib/auth';

const USER_KEY = 'tradeedge_user';

interface AuthState {
  user: User | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface ApiAuthResponse {
  success: true;
  data: { token: string; user: User };
}

interface ApiMeResponse {
  success: true;
  data: { user: User };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const loadSession = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const data = await get<ApiMeResponse>('/api/auth/me');
      if (data?.success && data.data?.user) {
        setUser(data.data.user);
      } else {
        clearAuth();
      }
    } catch {
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await post<ApiAuthResponse>('/api/auth/login', { email, password });
      if (!data?.success || !data.data?.token || !data.data?.user) {
        throw new Error('Invalid response');
      }
      saveAuth(data.data.token, data.data.user);
      setUser(data.data.user);
    },
    []
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const data = await post<ApiAuthResponse>('/api/auth/register', { email, password, name });
      if (!data?.success || !data.data?.token || !data.data?.user) {
        throw new Error('Invalid response');
      }
      saveAuth(data.data.token, data.data.user);
      setUser(data.data.user);
    },
    []
  );

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    navigate('/login');
  }, [navigate]);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await get<ApiMeResponse>('/api/auth/me');
      if (data?.success && data.data?.user) {
        setUser(data.data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.data.user));
      }
    } catch {
      clearAuth();
      setUser(null);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
