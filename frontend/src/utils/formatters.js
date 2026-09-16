export function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatRuntime(ms) {
  if (ms === null || ms === undefined) return '—';
  return `${ms} ms`;
}

export function getVerdictConfig(verdict) {
  switch (verdict) {
    case 'ACCEPTED':
      return {
        label: 'Accepted',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/30',
        dot: 'bg-emerald-400'
      };
    case 'WRONG_ANSWER':
      return {
        label: 'Wrong Answer',
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/30',
        dot: 'bg-amber-400'
      };
    case 'COMPILATION_ERROR':
      return {
        label: 'Compilation Error',
        color: 'text-rose-400',
        bg: 'bg-rose-500/10 border-rose-500/30',
        dot: 'bg-rose-400'
      };
    case 'RUNTIME_ERROR':
      return {
        label: 'Runtime Error',
        color: 'text-red-400',
        bg: 'bg-red-500/10 border-red-500/30',
        dot: 'bg-red-400'
      };
    case 'TIME_LIMIT_EXCEEDED':
      return {
        label: 'Time Limit Exceeded',
        color: 'text-orange-400',
        bg: 'bg-orange-500/10 border-orange-500/30',
        dot: 'bg-orange-400'
      };
    case 'MEMORY_LIMIT_EXCEEDED':
      return {
        label: 'Memory Limit Exceeded',
        color: 'text-purple-400',
        bg: 'bg-purple-500/10 border-purple-500/30',
        dot: 'bg-purple-400'
      };
    case 'PENDING':
    case 'RUNNING':
    case 'SUBMITTED':
      return {
        label: verdict.charAt(0) + verdict.slice(1).toLowerCase(),
        color: 'text-blue-400',
        bg: 'bg-blue-500/10 border-blue-500/30',
        dot: 'bg-blue-400'
      };
    default:
      return {
        label: verdict || 'Unknown',
        color: 'text-slate-400',
        bg: 'bg-slate-500/10 border-slate-500/30',
        dot: 'bg-slate-400'
      };
  }
}
