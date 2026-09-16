import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Flame, Clock, Cpu } from 'lucide-react';
import { getVerdictConfig, formatRuntime, formatDate } from '../../utils/formatters';
import { Card, CardContent } from '../ui/Card';

export function VerdictCard({ submission }) {
  if (!submission) return null;

  const config = getVerdictConfig(submission.verdict);

  const getVerdictIcon = () => {
    switch (submission.verdict) {
      case 'ACCEPTED':
        return <CheckCircle2 className="w-6 h-6 text-emerald-400" />;
      case 'WRONG_ANSWER':
        return <XCircle className="w-6 h-6 text-amber-400" />;
      case 'COMPILATION_ERROR':
        return <AlertTriangle className="w-6 h-6 text-rose-400" />;
      case 'RUNTIME_ERROR':
        return <Flame className="w-6 h-6 text-red-400" />;
      default:
        return <Clock className="w-6 h-6 text-blue-400 animate-pulse" />;
    }
  };

  return (
    <Card className="border-border/90 bg-surface/95 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className={`p-4 flex items-center justify-between border-b border-border/60 ${config.bg}`}>
        <div className="flex items-center space-x-3">
          {getVerdictIcon()}
          <div>
            <div className="flex items-center space-x-2">
              <span className={`text-base font-bold font-mono tracking-tight ${config.color}`}>
                {config.label}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                #{submission.id?.slice(-6)}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Submitted at {formatDate(submission.createdAt)}
            </p>
          </div>
        </div>

        <div className="text-right font-mono">
          <span className="text-xs uppercase tracking-wider text-slate-400">Status</span>
          <p className="text-sm font-semibold text-slate-200">{submission.status}</p>
        </div>
      </div>

      <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {/* Test Cases Passed */}
        <div className="bg-slate-900/60 p-3 rounded-lg border border-border/50">
          <span className="text-xs text-slate-400 block font-mono uppercase">Tests Passed</span>
          <p className="text-base font-bold text-slate-100 mt-1 font-mono">
            {submission.testsPassed !== null && submission.totalTests !== null
              ? `${submission.testsPassed} / ${submission.totalTests}`
              : '—'}
          </p>
        </div>

        {/* Runtime */}
        <div className="bg-slate-900/60 p-3 rounded-lg border border-border/50">
          <span className="text-xs text-slate-400 block font-mono uppercase">Runtime</span>
          <p className="text-base font-bold text-slate-100 mt-1 font-mono">
            {formatRuntime(submission.runtimeMs)}
          </p>
        </div>

        {/* Language */}
        <div className="bg-slate-900/60 p-3 rounded-lg border border-border/50 col-span-2 sm:col-span-1">
          <span className="text-xs text-slate-400 block font-mono uppercase">Language</span>
          <p className="text-base font-bold text-slate-100 mt-1 font-mono">
            {submission.language}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
