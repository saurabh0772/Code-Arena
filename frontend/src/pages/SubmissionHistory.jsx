import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { History, Eye, Copy, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { submissionService } from '../services/api/submission.service';
import { problemService } from '../services/api/problem.service';
import { formatDate, formatRuntime, getVerdictConfig } from '../utils/formatters';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '../components/ui/Table';

export function SubmissionHistory() {
  const [submissions, setSubmissions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [problemsMap, setProblemsMap] = useState({});
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  async function loadSubmissions(page = 1) {
    setIsLoading(true);
    setError(null);
    try {
      const [subData, probList] = await Promise.all([
        submissionService.getMySubmissions({ page, limit: 20 }),
        problemService.getProblems().catch(() => [])
      ]);

      setSubmissions(subData.submissions || []);
      setPagination(subData.pagination || { page: 1, totalPages: 1, total: 0 });

      // Build map of problemId -> problem title
      const pMap = {};
      probList.forEach((p) => {
        pMap[p.id] = p.title;
      });
      setProblemsMap(pMap);
    } catch (err) {
      setError(err.message || 'Failed to load submissions');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSubmissions(1);
  }, []);

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Submission History
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review your past code submissions, verdicts, and performance metrics.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => loadSubmissions(pagination.page)}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center space-x-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <Card className="p-12 flex flex-col items-center justify-center space-y-4">
          <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-mono">Loading your submissions...</p>
        </Card>
      ) : submissions.length === 0 ? (
        <Card className="p-12 text-center">
          <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">No submissions yet</h3>
          <p className="text-sm text-slate-400 mt-1 mb-6 max-w-sm mx-auto">
            You have not submitted solutions to any problems yet.
          </p>
          <Link to="/problems">
            <Button variant="primary">Browse Problems</Button>
          </Link>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/80 bg-surface/90 shadow-xl">
          <Table>
            <TableHeader>
              <tr>
                <TableHead className="w-24">ID</TableHead>
                <TableHead>Problem</TableHead>
                <TableHead className="w-32">Verdict</TableHead>
                <TableHead className="w-24">Language</TableHead>
                <TableHead className="w-28">Tests</TableHead>
                <TableHead className="w-24">Runtime</TableHead>
                <TableHead className="w-36">Submitted</TableHead>
                <TableHead className="w-24 text-right">Details</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {submissions.map((sub) => {
                const verdictConfig = getVerdictConfig(sub.verdict);
                const problemTitle = problemsMap[sub.problemId] || 'Problem';

                return (
                  <TableRow
                    key={sub.id}
                    onClick={() => setSelectedSubmission(sub)}
                  >
                    <TableCell className="font-mono text-xs text-slate-500">
                      #{sub.id?.slice(-6)}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/problems/${sub.problemId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-slate-200 hover:text-primary transition-colors"
                      >
                        {problemTitle}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold border ${verdictConfig.bg} ${verdictConfig.color}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${verdictConfig.dot}`}
                        ></span>
                        {verdictConfig.label}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-400">
                      {sub.language}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-300">
                      {sub.testsPassed !== null && sub.totalTests !== null
                        ? `${sub.testsPassed} / ${sub.totalTests}`
                        : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-300">
                      {formatRuntime(sub.runtimeMs)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {formatDate(sub.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1.5 text-slate-400 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSubmission(sub);
                        }}
                        title="View Code & Metrics"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-border/60 flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => loadSubmissions(pagination.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadSubmissions(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Code Inspection Modal */}
      {selectedSubmission && (
        <Modal
          isOpen={!!selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          title={`Submission #${selectedSubmission.id?.slice(-6)}`}
          className="max-w-3xl"
        >
          <div className="space-y-4">
            {/* Meta Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/80 p-3 rounded-lg border border-border/50 text-xs">
              <div>
                <span className="text-slate-500 uppercase font-mono block">Verdict</span>
                <span
                  className={`font-semibold font-mono ${
                    getVerdictConfig(selectedSubmission.verdict).color
                  }`}
                >
                  {selectedSubmission.verdict}
                </span>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-mono block">Tests</span>
                <span className="text-slate-200 font-mono">
                  {selectedSubmission.testsPassed !== null
                    ? `${selectedSubmission.testsPassed} / ${selectedSubmission.totalTests}`
                    : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-mono block">Runtime</span>
                <span className="text-slate-200 font-mono">
                  {formatRuntime(selectedSubmission.runtimeMs)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-mono block">Language</span>
                <span className="text-slate-200 font-mono">
                  {selectedSubmission.language}
                </span>
              </div>
            </div>

            {/* Source Code Header */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-mono font-semibold text-slate-300 uppercase">
                Submitted Source Code
              </span>
              <button
                onClick={() => handleCopy(selectedSubmission.sourceCode)}
                className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 p-1 rounded hover:bg-slate-800"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            {/* Source Code Viewer */}
            <pre className="bg-[#0b0f19] p-4 rounded-lg border border-border/60 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-96 selection:bg-indigo-600/40">
              <code>{selectedSubmission.sourceCode}</code>
            </pre>
          </div>
        </Modal>
      )}
    </div>
  );
}
