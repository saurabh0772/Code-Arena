import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Play, ArrowLeft, CheckCircle, AlertCircle, FileText, Code2, Send } from 'lucide-react';
import { problemService } from '../services/api/problem.service';
import { submissionService } from '../services/api/submission.service';
import { CodeEditor, DEFAULT_CPP_TEMPLATE } from '../components/editor/CodeEditor';
import { STARTER_TEMPLATES } from '../utils/constants';
import { VerdictCard } from '../components/verdict/VerdictCard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';

export function ProblemDetails() {
  const { problemId } = useParams();

  const [problem, setProblem] = useState(null);
  const [publicTestCases, setPublicTestCases] = useState([]);
  const [language, setLanguage] = useState('CPP');
  const [sourceCode, setSourceCode] = useState(DEFAULT_CPP_TEMPLATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [error, setError] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    async function loadProblemData() {
      setIsLoading(true);
      setError(null);
      try {
        const [probData, tcData] = await Promise.all([
          problemService.getProblemById(problemId),
          problemService.getPublicTestCases(problemId)
        ]);
        setProblem(probData);
        setPublicTestCases(tcData);
      } catch (err) {
        setError(err.message || 'Failed to load problem');
      } finally {
        setIsLoading(false);
      }
    }

    loadProblemData();
  }, [problemId]);

  const handleLanguageChange = (newLang) => {
    const prevTemplate = STARTER_TEMPLATES[language];
    if (!sourceCode.trim() || sourceCode === prevTemplate) {
      setSourceCode(STARTER_TEMPLATES[newLang] || '');
    }
    setLanguage(newLang);
  };

  const handleSubmit = async () => {
    if (!sourceCode.trim()) {
      setSubmitError('Source code cannot be empty');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    setSubmissionResult(null);

    try {
      // 1. POST submission
      const createdSub = await submissionService.createSubmission({
        problemId,
        language,
        sourceCode
      });

      // 2. Fetch completed submission result
      const completedSub = await submissionService.getSubmissionById(createdSub.id);
      setSubmissionResult(completedSub);
    } catch (err) {
      setSubmitError(err.message || 'Submission execution failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm font-mono">Loading problem statement...</p>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Problem Not Found</h2>
        <p className="text-slate-400 text-sm mb-6">{error || 'The requested problem is unavailable.'}</p>
        <Link to="/problems">
          <Button variant="secondary">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Problems
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Bar navigation */}
      <div className="flex items-center justify-between mb-4">
        <Link
          to="/problems"
          className="inline-flex items-center text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Problem List
        </Link>
        <Link
          to="/submissions"
          className="text-xs text-primary hover:text-primary-light transition-colors font-mono"
        >
          View All Submissions &rarr;
        </Link>
      </div>

      {/* Split-pane Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Problem Details */}
        <div className="lg:col-span-6 xl:col-span-5 space-y-6">
          <Card className="border-border/80 bg-surface/90 shadow-xl overflow-hidden">
            {/* Problem Title & Meta */}
            <div className="p-6 border-b border-border/80">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {problem.title}
                </h1>
                <Badge variant={problem.difficulty}>
                  {problem.difficulty}
                </Badge>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {problem.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Description Body */}
            <div className="p-6 space-y-6 text-sm text-slate-200 leading-relaxed overflow-y-auto max-h-[calc(100vh-280px)]">
              {/* Description */}
              <div>
                <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Description
                </h4>
                <div className="whitespace-pre-line text-slate-300">
                  {problem.description}
                </div>
              </div>

              {/* Input Format */}
              {problem.inputFormat && (
                <div>
                  <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Input Format
                  </h4>
                  <p className="text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-border/40 font-mono text-xs">
                    {problem.inputFormat}
                  </p>
                </div>
              )}

              {/* Output Format */}
              {problem.outputFormat && (
                <div>
                  <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Output Format
                  </h4>
                  <p className="text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-border/40 font-mono text-xs">
                    {problem.outputFormat}
                  </p>
                </div>
              )}

              {/* Constraints */}
              {problem.constraints && (
                <div>
                  <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Constraints
                  </h4>
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-border/40 font-mono text-xs text-slate-300">
                    {problem.constraints}
                  </div>
                </div>
              )}

              {/* Examples */}
              {problem.examples && problem.examples.length > 0 && (
                <div>
                  <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 mb-3">
                    Examples
                  </h4>
                  <div className="space-y-4">
                    {problem.examples.map((example, index) => (
                      <div
                        key={index}
                        className="bg-slate-900/80 rounded-lg p-3.5 border border-border/60 space-y-2"
                      >
                        <div className="text-xs font-mono font-semibold text-primary">
                          Example {index + 1}
                        </div>
                        <div>
                          <span className="text-[11px] font-mono text-slate-500 uppercase block">
                            Input
                          </span>
                          <pre className="bg-black/40 p-2 rounded text-xs font-mono text-slate-200 mt-1 overflow-x-auto">
                            {example.input}
                          </pre>
                        </div>
                        <div>
                          <span className="text-[11px] font-mono text-slate-500 uppercase block">
                            Output
                          </span>
                          <pre className="bg-black/40 p-2 rounded text-xs font-mono text-slate-200 mt-1 overflow-x-auto">
                            {example.output}
                          </pre>
                        </div>
                        {example.explanation && (
                          <p className="text-xs text-slate-400 italic pt-1">
                            Explanation: {example.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Code Editor & Submission Controls */}
        <div className="lg:col-span-6 xl:col-span-7 space-y-4 flex flex-col">
          {/* Editor */}
          <div className="flex-1 min-h-[440px]">
            <CodeEditor
              value={sourceCode}
              onChange={setSourceCode}
              language={language}
              onLanguageChange={handleLanguageChange}
              disabled={isSubmitting}
            />
          </div>

          {/* Error notice if submission failed */}
          {submitError && (
            <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start space-x-2 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between p-3.5 bg-surface border border-border/80 rounded-xl">
            <div className="text-xs text-slate-400 font-mono">
              Runtime: <span className="text-slate-200 font-semibold">{language === 'CPP' ? 'g++ (C++17)' : language === 'PYTHON' ? 'Python 3' : 'Node.js'}</span>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit}
              isLoading={isSubmitting}
              className="px-6"
            >
              <Send className="w-4 h-4 mr-2" />
              <span>{isSubmitting ? 'Evaluating Submission...' : 'Submit Code'}</span>
            </Button>
          </div>

          {/* Real-time Verdict Output */}
          {submissionResult && (
            <div className="pt-2">
              <VerdictCard submission={submissionResult} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
