import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  ArrowLeft,
  Search,
  Filter,
  Eye,
  Edit3,
  Trash2,
  ListChecks,
  AlertCircle,
  CheckCircle2,
  Database
} from 'lucide-react';
import { problemService } from '../../services/api/problem.service';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { formatDate } from '../../utils/formatters';

export function AdminProblems() {
  const navigate = useNavigate();

  const [problems, setProblems] = useState([]);
  const [filteredProblems, setFilteredProblems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('ALL');

  // Deactivate modal state
  const [deactivatingProblem, setDeactivatingProblem] = useState(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const loadProblems = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await problemService.getProblems();
      setProblems(data);
      setFilteredProblems(data);
    } catch (err) {
      setError(err.message || 'Failed to load problems');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProblems();
  }, []);

  // Filter logic
  useEffect(() => {
    let result = [...problems];

    if (selectedDifficulty !== 'ALL') {
      result = result.filter((p) => p.difficulty === selectedDifficulty);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.tags?.some((t) => t.toLowerCase().includes(query))
      );
    }

    setFilteredProblems(result);
  }, [searchQuery, selectedDifficulty, problems]);

  const handleConfirmDeactivate = async () => {
    if (!deactivatingProblem) return;

    setIsDeactivating(true);
    setError(null);
    try {
      await problemService.deactivateProblem(deactivatingProblem.id);
      setSuccessMessage(`Problem "${deactivatingProblem.title}" deactivated successfully.`);
      setDeactivatingProblem(null);
      await loadProblems();
    } catch (err) {
      setError(err.message || 'Failed to deactivate problem');
    } finally {
      setIsDeactivating(false);
    }
  };

  const getDifficultyBadge = (difficulty) => {
    switch (difficulty) {
      case 'EASY':
        return <Badge variant="success">EASY</Badge>;
      case 'MEDIUM':
        return <Badge variant="warning">MEDIUM</Badge>;
      case 'HARD':
        return <Badge variant="danger">HARD</Badge>;
      default:
        return <Badge variant="secondary">{difficulty}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/80">
        <div>
          <Link
            to="/admin"
            className="inline-flex items-center text-xs font-mono text-slate-400 hover:text-slate-200 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Admin Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2.5">
            <Database className="w-6 h-6 text-primary" />
            Problem Management
          </h1>
          <p className="text-sm text-slate-400">
            View, edit, configure test cases, and manage problem visibility
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link to="/admin/problems/create">
            <Button variant="primary">
              <Plus className="w-4 h-4 mr-1.5" />
              Create Problem
            </Button>
          </Link>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-emerald-400 text-sm animate-in fade-in">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-xs hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center space-x-2.5 text-red-400 text-sm animate-in fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-surface/70 p-4 rounded-xl border border-border/70">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search problems or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:inline" />
          <div className="flex rounded-lg border border-border/70 overflow-hidden bg-slate-900/60 p-0.5 w-full sm:w-auto">
            {['ALL', 'EASY', 'MEDIUM', 'HARD'].map((diff) => (
              <button
                key={diff}
                type="button"
                onClick={() => setSelectedDifficulty(diff)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedDifficulty === diff
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Problems Table */}
      <div className="bg-surface/90 border border-border/80 rounded-xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 font-mono text-sm space-y-3">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
            <p>Loading problems...</p>
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Database className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="font-medium text-slate-300">No problems found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || selectedDifficulty !== 'ALL'
                ? 'Try adjusting your search query or difficulty filter.'
                : 'No problems exist yet in the database. Create the first one!'}
            </p>
            {searchQuery || selectedDifficulty !== 'ALL' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDifficulty('ALL');
                }}
              >
                Clear Filters
              </Button>
            ) : (
              <Link to="/admin/problems/create">
                <Button variant="primary" size="sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create Problem
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full caption-bottom text-sm text-left">
              <thead className="border-b border-border/80 text-xs font-mono text-slate-400 uppercase bg-slate-900/60">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Difficulty</th>
                  <th className="px-4 py-3 font-medium">Test Cases</th>
                  <th className="px-4 py-3 font-medium">Readiness</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-sans">
                {filteredProblems.map((prob) => (
                  <tr
                    key={prob.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3.5 font-medium text-slate-100">
                      <Link
                        to={`/problems/${prob.id}`}
                        className="hover:text-primary transition-colors hover:underline"
                      >
                        {prob.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      {getDifficultyBadge(prob.difficulty)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-300">
                      {prob.testCasesCount ?? 0} Test Cases
                    </td>
                    <td className="px-4 py-3.5">
                      {(prob.testCasesCount ?? 0) > 0 ? (
                        <span className="inline-flex items-center text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                          ✓ Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                          ⚠ Not Ready
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant="success" className="text-[10px] px-2 py-0.5">
                        Active
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <Link to={`/problems/${prob.id}`} title="View Problem">
                          <Button variant="ghost" size="sm" className="h-8 px-2">
                            <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-slate-100" />
                          </Button>
                        </Link>
                        <Link to={`/admin/problems/${prob.id}/edit`} title="Edit Problem">
                          <Button variant="ghost" size="sm" className="h-8 px-2">
                            <Edit3 className="w-3.5 h-3.5 text-indigo-400 hover:text-indigo-300" />
                          </Button>
                        </Link>
                        <Link
                          to={`/admin/problems/${prob.id}/test-cases`}
                          title="Manage Test Cases"
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-emerald-400 hover:text-emerald-300"
                          >
                            <ListChecks className="w-3.5 h-3.5 mr-1" />
                            <span className="text-xs">Manage Tests</span>
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeactivatingProblem(prob)}
                          title="Deactivate Problem"
                          className="h-8 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Deactivation */}
      <Modal
        isOpen={!!deactivatingProblem}
        onClose={() => setDeactivatingProblem(null)}
        title="Confirm Problem Deactivation"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start space-x-3 text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Soft Deletion Notice</p>
              <p className="mt-0.5 text-amber-200/80">
                Are you sure you want to deactivate{' '}
                <strong className="text-white">"{deactivatingProblem?.title}"</strong>?
                It will immediately become invisible to normal users on problem lists and detail endpoints.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-border/80">
            <Button
              variant="secondary"
              size="sm"
              disabled={isDeactivating}
              onClick={() => setDeactivatingProblem(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeactivating}
              onClick={handleConfirmDeactivate}
            >
              Deactivate Problem
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default AdminProblems;
