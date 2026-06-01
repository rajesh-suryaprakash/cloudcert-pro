import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  loginApi,
  registerApi,
  getMeApi,
  logoutApi,
  forgotPasswordApi,
  resetPasswordApi,
} from './api/auth';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'user' | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ code: string }>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // The httpOnly cookie is sent automatically; no token handling needed client-side
      const data = await getMeApi();
      setUser(data.user);
    } catch {
      // No valid session — user stays null
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const data = await loginApi(email, password);
    // Cookie is set by the server; just update local user state
    setUser(data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const data = await registerApi(email, password, name);
    setUser(data.user);
  };

  const logout = async () => {
    await logoutApi();
    setUser(null);
  };

  const forgotPassword = async (email: string) => {
    return await forgotPasswordApi(email);
  };

  const resetPassword = async (email: string, code: string, password: string) => {
    await resetPasswordApi(email, code, password);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        loading,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
