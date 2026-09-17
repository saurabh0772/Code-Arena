import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Code2, Terminal, User, LogOut, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { name: 'Problems', path: '/problems' },
    { name: 'Submissions', path: '/submissions' },
    ...(user?.role === 'ADMIN' ? [{ name: 'Admin Dashboard', path: '/admin' }] : [])
  ];

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border/80 bg-surface/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-8">
            <Link to="/problems" className="flex items-center space-x-2.5 group">
              <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-md shadow-indigo-500/10">
                <Terminal className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white font-mono">
                Code<span className="text-primary">Arena</span>
              </span>
            </Link>

            {/* Nav links */}
            <div className="hidden md:flex items-center space-x-1">
              {navLinks
                .filter((link) => link.path === '/problems' || isAuthenticated)
                .map((link) => {
                  const isActive = location.pathname.startsWith(link.path);
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                      }`}
                    >
                      {link.name}
                    </Link>
                  );
                })}
            </div>
          </div>

          {/* User profile & actions */}
          <div className="flex items-center space-x-4">
            {isAuthenticated && user ? (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:flex flex-col items-end">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-slate-200">{user.name}</span>
                    {user.role === 'ADMIN' && (
                      <Badge variant="primary" className="text-[10px] px-1.5 py-0">
                        ADMIN
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{user.email}</span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            ) : (
              <Link to="/login">
                <Button variant="primary" size="sm">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
