import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Save,
  FileCode
} from 'lucide-react';
import { problemService } from '../../services/api/problem.service';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';

export function AdminProblemForm({ mode = 'create' }) {
  const navigate = useNavigate();
  const { problemId } = useParams();

  const isEdit = mode === 'edit' || !!problemId;

  // Form states
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState('EASY');
  const [tagsInput, setTagsInput] = useState('');
  const [description, setDescription] = useState('');
  const [inputFormat, setInputFormat] = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [constraints, setConstraints] = useState('');
  const [examples, setExamples] = useState([{ input: '', output: '' }]);

  // UX states
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load existing problem if in edit mode
  useEffect(() => {
    if (!isEdit || !problemId) return;

    async function loadProblem() {
      setIsLoading(true);
      setError(null);
      try {
        const problem = await problemService.getProblemById(problemId);
        setTitle(problem.title || '');
        setDifficulty(problem.difficulty || 'EASY');
        setTagsInput(Array.isArray(problem.tags) ? problem.tags.join(', ') : '');
        setDescription(problem.description || '');
        setInputFormat(problem.inputFormat || '');
        setOutputFormat(problem.outputFormat || '');
        setConstraints(problem.constraints || '');
        if (Array.isArray(problem.examples) && problem.examples.length > 0) {
          setExamples(problem.examples.map((ex) => ({ input: ex.input || '', output: ex.output || '' })));
        }
      } catch (err) {
        setError(err.message || 'Failed to load problem data for editing');
      } finally {
        setIsLoading(false);
      }
    }

    loadProblem();
  }, [isEdit, problemId]);

  // Example list management
  const handleAddExample = () => {
    setExamples([...examples, { input: '', output: '' }]);
  };

  const handleRemoveExample = (index) => {
    if (examples.length <= 1) {
      setError('At least one example is required.');
      return;
    }
    setExamples(examples.filter((_, i) => i !== index));
  };

  const handleExampleChange = (index, field, value) => {
    const updated = [...examples];
    updated[index][field] = value;
    setExamples(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Client-side validations
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (title.trim().length > 200) {
      setError('Title cannot exceed 200 characters');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (!inputFormat.trim()) {
      setError('Input format is required');
      return;
    }
    if (!outputFormat.trim()) {
      setError('Output format is required');
      return;
    }
    if (!constraints.trim()) {
      setError('Constraints are required');
      return;
    }
    for (let i = 0; i < examples.length; i++) {
      if (typeof examples[i].input !== 'string' || typeof examples[i].output !== 'string') {
        setError(`Example ${i + 1} must have valid input and output`);
        return;
      }
    }

    const tagsArray = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      difficulty,
      tags: tagsArray,
      description: description.trim(),
      inputFormat: inputFormat.trim(),
      outputFormat: outputFormat.trim(),
      constraints: constraints.trim(),
      examples: examples.map((ex) => ({
        input: ex.input,
        output: ex.output
      }))
    };

    setIsSaving(true);

    try {
      if (isEdit) {
        await problemService.updateProblem(problemId, payload);
        setSuccess('Problem updated successfully!');
      } else {
        const created = await problemService.createProblem(payload);
        setSuccess('Problem created successfully!');
        setTimeout(() => {
          navigate(`/admin/problems/${created.id}/test-cases`);
        }, 1000);
        return;
      }

      setTimeout(() => {
        navigate('/admin/problems');
      }, 1000);
    } catch (err) {
      setError(err.message || 'Failed to save problem');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm font-mono text-slate-400">Loading problem details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-border/80">
        <Link
          to="/admin/problems"
          className="inline-flex items-center text-xs font-mono text-slate-400 hover:text-slate-200 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Problem Management
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2.5">
          <FileCode className="w-6 h-6 text-primary" />
          {isEdit ? 'Edit Problem' : 'Create New Problem'}
        </h1>
        <p className="text-sm text-slate-400">
          {isEdit
            ? 'Modify existing problem description, constraints, and examples.'
            : 'Author a new competitive programming challenge with description and test formats.'}
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center space-x-2.5 text-red-400 text-sm animate-in fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center space-x-2.5 text-emerald-400 text-sm animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-surface/90 border-border/80">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle className="text-base font-semibold text-slate-100">
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* Title */}
            <Input
              label="Problem Title"
              placeholder="e.g. Invert a Binary Tree"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
            />

            {/* Difficulty & Tags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
                  Difficulty Level
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                >
                  <option value="EASY">EASY</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HARD">HARD</option>
                </select>
              </div>

              <div>
                <Input
                  label="Tags (Comma separated)"
                  placeholder="e.g. math, arrays, binary-search"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
                Problem Description
              </label>
              <textarea
                rows={5}
                placeholder="Detailed description of the problem..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
          </CardContent>
        </Card>

        {/* I/O Specifications */}
        <Card className="bg-surface/90 border-border/80">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle className="text-base font-semibold text-slate-100">
              Input / Output Specifications & Constraints
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
                Input Format
              </label>
              <textarea
                rows={3}
                placeholder="e.g. The first line contains an integer T..."
                value={inputFormat}
                onChange={(e) => setInputFormat(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
                Output Format
              </label>
              <textarea
                rows={3}
                placeholder="e.g. For each test case, print the answer on a new line..."
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
                Constraints
              </label>
              <textarea
                rows={3}
                placeholder="e.g. 1 <= N <= 10^5, -10^9 <= A[i] <= 10^9"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Examples */}
        <Card className="bg-surface/90 border-border/80">
          <CardHeader className="border-b border-border/70 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-100">
                Public Examples
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Shown to candidates on the problem description page
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddExample}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Example
            </Button>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {examples.map((ex, idx) => (
              <div
                key={idx}
                className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-medium text-primary uppercase">
                    Example #{idx + 1}
                  </span>
                  {examples.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveExample(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      title="Remove Example"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1 uppercase">
                      Input
                    </label>
                    <textarea
                      rows={3}
                      value={ex.input}
                      onChange={(e) => handleExampleChange(idx, 'input', e.target.value)}
                      placeholder="Input data..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1 uppercase">
                      Expected Output
                    </label>
                    <textarea
                      rows={3}
                      value={ex.output}
                      onChange={(e) => handleExampleChange(idx, 'output', e.target.value)}
                      placeholder="Expected output data..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-4">
          <Link to="/admin/problems">
            <Button variant="secondary" type="button" disabled={isSaving}>
              Cancel
            </Button>
          </Link>
          <Button variant="primary" type="submit" isLoading={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isEdit ? 'Save Changes' : 'Create Problem'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default AdminProblemForm;
