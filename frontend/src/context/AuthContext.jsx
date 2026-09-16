import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api/auth.service';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('codearena_token'));
  const [isLoading, setIsLoading] = useState(true);

  // Restore authenticated user state on load
  useEffect(() => {
    async function restoreSession() {
      const storedToken = localStorage.getItem('codearena_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const userData = await authService.getMe();
        setUser(userData);
      } catch (err) {
        console.warn('Session expired or invalid:', err.message);
        localStorage.removeItem('codearena_token');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = async (email, password) => {
    const data = await authService.login(email, password);
    localStorage.setItem('codearena_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (name, email, password) => {
    await authService.register(name, email, password);
    // After registration, automatically log in
    return await login(email, password);
  };

  const logout = () => {
    localStorage.removeItem('codearena_token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    register,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
