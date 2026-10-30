import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { fetchCurrentUser, loginUser, registerUser } from '../api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { username: string; password: string }) => Promise<void>;
  register: (details: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
    role?: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('bm_auth_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const res = await fetchCurrentUser();
          setUser(res.user);
        } catch {
          // If token invalid, auto logout
          localStorage.removeItem('bm_auth_token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    }
    loadUser();
  }, [token]);

  const login = async (credentials: { username: string; password: string }) => {
    const data = await loginUser(credentials);
    localStorage.setItem('bm_auth_token', data.token);
    localStorage.setItem('bm_user_cache', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (details: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
    role?: string;
  }) => {
    const data = await registerUser(details);
    localStorage.setItem('bm_auth_token', data.token);
    localStorage.setItem('bm_user_cache', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('bm_auth_token');
    localStorage.removeItem('bm_user_cache');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
