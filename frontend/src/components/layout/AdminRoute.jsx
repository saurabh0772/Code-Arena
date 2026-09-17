import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function AdminRoute({ children }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-mono tracking-wider">VERIFYING ADMIN PRIVILEGES...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated visitors redirect to /login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated non-admin users (USER) are redirected to /problems
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/problems" replace />;
  }

  return children;
}

export default AdminRoute;
