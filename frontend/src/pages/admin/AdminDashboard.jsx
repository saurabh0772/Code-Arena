import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield,
  FileCode,
  Plus,
  ListOrdered,
  LogOut,
  UserCheck,
  ArrowRight,
  AlertCircle,
  Database
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { problemService } from '../../services/api/problem.service';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalProblems: 0,
    activeProblems: 0,
    easyCount: 0,
    mediumCount: 0,
    hardCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadStats() {
      setIsLoading(true);
      setError(null);
      try {
        const problems = await problemService.getProblems();
        const total = problems.length;
        const easy = problems.filter((p) => p.difficulty === 'EASY').length;
        const medium = problems.filter((p) => p.difficulty === 'MEDIUM').length;
        const hard = problems.filter((p) => p.difficulty === 'HARD').length;

        setStats({
          totalProblems: total,
          activeProblems: total,
          easyCount: easy,
          mediumCount: medium,
          hardCount: hard
        });
      } catch (err) {
        setError(err.message || 'Failed to load system metrics');
      } finally {
        setIsLoading(false);
      }
    }

    loadStats();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/80">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-primary shadow-lg shadow-indigo-500/10">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
                CodeArena Admin Dashboard
              </h1>
              <p className="text-sm text-slate-400">
                System Administration & Problem Operations
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link to="/admin/problems/create">
            <Button variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-1.5" />
              Create Problem
            </Button>
          </Link>
          <Link to="/admin/problems">
            <Button variant="secondary" size="sm">
              <ListOrdered className="w-4 h-4 mr-1.5" />
              Manage Problems
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center space-x-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Overview Statistics */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 font-mono uppercase tracking-wider mb-4">
          Overview Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-surface/90 border-border/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">Total Problems</p>
                  <p className="text-2xl font-bold text-white font-mono mt-1">
                    {isLoading ? '...' : stats.totalProblems}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <FileCode className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface/90 border-border/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">Active Problems</p>
                  <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                    {isLoading ? '...' : stats.activeProblems}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Database className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface/90 border-border/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">Easy / Medium</p>
                  <p className="text-2xl font-bold text-slate-200 font-mono mt-1">
                    {isLoading ? '...' : `${stats.easyCount} / ${stats.mediumCount}`}
                  </p>
                </div>
                <div className="flex space-x-1">
                  <Badge variant="success" className="text-[10px]">EASY</Badge>
                  <Badge variant="warning" className="text-[10px]">MED</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface/90 border-border/80">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">Hard Problems</p>
                  <p className="text-2xl font-bold text-rose-400 font-mono mt-1">
                    {isLoading ? '...' : stats.hardCount}
                  </p>
                </div>
                <Badge variant="danger" className="text-[10px]">HARD</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Management Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Problem Operations Card */}
        <Card className="lg:col-span-2 bg-surface/90 border-border/80">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle className="text-base font-semibold text-slate-100 flex items-center space-x-2">
              <FileCode className="w-4 h-4 text-primary" />
              <span>Problem Management</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Create, modify, configure test cases, and manage problem visibility
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/admin/problems/create" className="flex-1">
                <Button variant="primary" className="w-full justify-between group">
                  <span className="flex items-center">
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Problem
                  </span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/admin/problems" className="flex-1">
                <Button variant="secondary" className="w-full justify-between group">
                  <span className="flex items-center">
                    <ListOrdered className="w-4 h-4 mr-2" />
                    Manage All Problems
                  </span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-2">
              <div className="font-mono text-slate-300 font-medium">Administration Guidelines:</div>
              <ul className="list-disc list-inside space-y-1 text-slate-400">
                <li>Problem deactivation uses idempotent soft deletion (<code className="text-slate-300">isActive: false</code>).</li>
                <li>Public test cases are exposed to users for sample verification.</li>
                <li>Hidden test cases are strictly isolated by backend database queries during evaluation.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Current Admin Information Card */}
        <Card className="bg-surface/90 border-border/80">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle className="text-base font-semibold text-slate-100 flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Current Admin</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Active administrator session
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Name</p>
                <p className="text-sm font-medium text-slate-200 mt-0.5">{user?.name || 'Administrator'}</p>
              </div>

              <div>
                <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Email</p>
                <p className="text-xs font-mono text-slate-300 mt-0.5 break-all">{user?.email}</p>
              </div>

              <div>
                <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Authorization Role</p>
                <div className="mt-1">
                  <Badge variant="primary" className="text-xs px-2 py-0.5 font-mono">
                    {user?.role || 'ADMIN'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/70">
              <Button
                variant="danger"
                size="sm"
                onClick={handleLogout}
                className="w-full justify-center"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out Admin
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AdminDashboard;
