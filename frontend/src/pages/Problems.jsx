import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Code, ArrowRight, Filter, AlertCircle } from 'lucide-react';
import { problemService } from '../services/api/problem.service';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '../components/ui/Table';

export function Problems() {
  const [problems, setProblems] = useState([]);
  const [filteredProblems, setFilteredProblems] = useState([]);
  const [difficulty, setDifficulty] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    async function loadProblems() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await problemService.getProblems({ difficulty });
        setProblems(data);
      } catch (err) {
        setError(err.message || 'Failed to load problems');
      } finally {
        setIsLoading(false);
      }
    }

    loadProblems();
  }, [difficulty]);

  useEffect(() => {
    let result = problems;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    setFilteredProblems(result);
  }, [problems, searchQuery]);

  const difficulties = ['ALL', 'EASY', 'MEDIUM', 'HARD'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Problem Catalog
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse and solve algorithmic challenges evaluated by the C++ execution engine.
          </p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        {/* Difficulty Tabs */}
        <div className="flex items-center p-1 bg-surface border border-border/80 rounded-lg space-x-1 w-full sm:w-auto">
          {difficulties.map((diff) => (
            <button
              key={diff}
              onClick={() => setDifficulty(diff)}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-md text-xs font-medium tracking-wide uppercase transition-all ${
                difficulty === diff
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search problems or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface border border-border/80 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Content Area */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center space-x-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <Card className="p-12 flex flex-col items-center justify-center space-y-4">
          <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-mono">Fetching active problems...</p>
        </Card>
      ) : filteredProblems.length === 0 ? (
        <Card className="p-12 text-center">
          <Code className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">No problems found</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            No active problems match your current search or difficulty filter.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/80 bg-surface/90 shadow-xl">
          <Table>
            <TableHeader>
              <tr>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-32">Difficulty</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="w-24 text-right">Action</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {filteredProblems.map((problem, index) => (
                <TableRow
                  key={problem.id}
                  onClick={() => navigate(`/problems/${problem.id}`)}
                >
                  <TableCell className="font-mono text-xs text-slate-500">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-slate-100 group-hover:text-primary transition-colors">
                      {problem.title}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={problem.difficulty}>
                      {problem.difficulty}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {problem.tags && problem.tags.length > 0 ? (
                        problem.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 text-xs">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="group-hover:bg-primary group-hover:text-white transition-all"
                    >
                      <span>Solve</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
