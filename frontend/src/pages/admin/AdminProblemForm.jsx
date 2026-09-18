import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  LayoutGrid,
  FileCode,
  Trophy,
  Users,
  Repeat,
  Server,
  Megaphone,
  BarChart2,
  ShieldCheck,
  Settings,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Crown,
  Bold,
  Italic,
  Heading,
  List,
  ListOrdered,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  HelpCircle,
  Copy,
  Check,
  Rocket,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Send
} from 'lucide-react';
import { problemService } from '../../services/api/problem.service';
import HomeNavbar from '../../components/layout/HomeNavbar';

export function AdminProblemForm({ mode = 'create' }) {
  const navigate = useNavigate();
  const { problemId } = useParams();
  const isEdit = mode === 'edit' || !!problemId;

  // Form fields
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('two-sum');
  const [difficulty, setDifficulty] = useState('EASY');
  const [selectedTopics, setSelectedTopics] = useState(['Array', 'Hash Table']);
  const [selectedCompanies, setSelectedCompanies] = useState(['Google', 'Amazon']);
  const [isTopicsOpen, setIsTopicsOpen] = useState(false);
  const [isCompaniesOpen, setIsCompaniesOpen] = useState(false);
  const [isDifficultyOpen, setIsDifficultyOpen] = useState(false);

  // Statement fields
  const [statementTab, setStatementTab] = useState('write'); // 'write' | 'preview'
  const [description, setDescription] = useState('');
  const [inputFormat, setInputFormat] = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [constraints, setConstraints] = useState('');

  // Examples
  const [examples, setExamples] = useState([
    { input: '', output: '', explanation: '' }
  ]);

  // Test Cases
  const [testCaseTab, setTestCaseTab] = useState('sample'); // 'sample' | 'hidden'
  const [sampleTestCases, setSampleTestCases] = useState([
    { id: 1, input: '', expectedOutput: '' }
  ]);
  const [hiddenTestCases, setHiddenTestCases] = useState([
    { id: 1, input: '', expectedOutput: '' }
  ]);

  // Code Templates
  const [templateLang, setTemplateLang] = useState('cpp'); // 'cpp' | 'python' | 'java' | 'javascript'
  const [codeTemplates, setCodeTemplates] = useState({
    cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}`,
    python: `def solve():\n    # Write your code here\n    pass\n\nif __name__ == "__main__":\n    solve()`,
    java: `import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}`,
    javascript: `/**\n * @return {void}\n */\nfunction solve() {\n    // Write your code here\n}\n`
  });
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  // Additional settings
  const [settings, setSettings] = useState({
    isPublic: true,
    isFeatured: false,
    addToContest: false,
    setTimeLimit: false
  });

  // UX states
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Auto-generate slug from title if user hasn't explicitly customized
  const handleTitleChange = (val) => {
    setTitle(val);
    if (!isEdit) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setSlug(generated || 'new-problem');
    }
  };

  // Load existing problem if in edit mode
  useEffect(() => {
    if (!isEdit || !problemId) return;

    async function loadProblem() {
      setIsLoading(true);
      setError(null);
      try {
        const problem = await problemService.getProblemById(problemId);
        setTitle(problem.title || '');
        setSlug(problem.slug || problem.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '');
        setDifficulty(problem.difficulty || 'EASY');
        setSelectedTopics(Array.isArray(problem.tags) ? problem.tags : ['Array']);
        setDescription(problem.description || '');
        setInputFormat(problem.inputFormat || '');
        setOutputFormat(problem.outputFormat || '');
        setConstraints(problem.constraints || '');
        if (Array.isArray(problem.examples) && problem.examples.length > 0) {
          setExamples(
            problem.examples.map((ex) => ({
              input: ex.input || '',
              output: ex.output || '',
              explanation: ex.explanation || ''
            }))
          );
        }
      } catch (err) {
        setError(err.message || 'Failed to load problem data for editing');
      } finally {
        setIsLoading(false);
      }
    }

    loadProblem();
  }, [isEdit, problemId]);

  // Example handlers
  const handleAddExample = () => {
    setExamples([...examples, { input: '', output: '', explanation: '' }]);
  };

  const handleRemoveExample = (idx) => {
    if (examples.length <= 1) return;
    setExamples(examples.filter((_, i) => i !== idx));
  };

  const handleExampleChange = (idx, field, val) => {
    const next = [...examples];
    next[idx][field] = val;
    setExamples(next);
  };

  // Test cases handlers
  const handleAddTestCase = () => {
    if (testCaseTab === 'sample') {
      setSampleTestCases([
        ...sampleTestCases,
        { id: sampleTestCases.length + 1, input: '', expectedOutput: '' }
      ]);
    } else {
      setHiddenTestCases([
        ...hiddenTestCases,
        { id: hiddenTestCases.length + 1, input: '', expectedOutput: '' }
      ]);
    }
  };

  const handleRemoveTestCase = (idx) => {
    if (testCaseTab === 'sample') {
      if (sampleTestCases.length <= 1) return;
      setSampleTestCases(sampleTestCases.filter((_, i) => i !== idx));
    } else {
      if (hiddenTestCases.length <= 1) return;
      setHiddenTestCases(hiddenTestCases.filter((_, i) => i !== idx));
    }
  };

  // Copy template
  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(codeTemplates[templateLang]);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  // Markdown toolbar action
  const handleToolbarInsert = (syntax) => {
    setDescription((prev) => prev + syntax);
  };

  // Submit form
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim()) {
      setError('Problem title is required');
      return;
    }
    if (!description.trim()) {
      setError('Problem statement description is required');
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

    const payload = {
      title: title.trim(),
      difficulty,
      tags: selectedTopics,
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
          navigate('/admin/problems');
        }, 1200);
        return;
      }
      setTimeout(() => {
        navigate('/admin/problems');
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to save problem');
    } finally {
      setIsSaving(false);
    }
  };

  const allTopics = ['Array', 'String', 'Hash Table', 'Dynamic Programming', 'Math', 'Tree', 'Graph', 'Two Pointers', 'Binary Search'];
  const allCompanies = ['Google', 'Amazon', 'Meta', 'Microsoft', 'Apple', 'Netflix', 'Uber'];

  return (
    <div className="min-h-screen bg-[#FFFBF7] text-home-text font-sans antialiased flex flex-col">
      {/* Top Navbar */}
      <HomeNavbar />

      {/* Main Container */}
      <div className="max-w-[1580px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-7 items-start">

          {/* ══════════════ LEFT ADMIN SIDEBAR ══════════════ */}
          <aside className="w-full lg:w-60 flex-shrink-0 flex flex-col space-y-6">
            
            {/* Sidebar Title */}
            <div className="flex items-center space-x-2 px-3 pt-1">
              <Crown className="w-4 h-4 text-home-accent fill-home-accent/20" />
              <span className="font-bold text-gray-900 text-sm tracking-tight">Admin Panel</span>
            </div>

            {/* Nav list */}
            <nav className="space-y-1">
              <Link
                to="/admin"
                className="w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/60 transition-colors"
              >
                <LayoutGrid className="w-4 h-4 mr-3 text-gray-400" />
                <span>Dashboard</span>
              </Link>

              {/* Manage Problems (Active Parent) */}
              <div className="space-y-1 pt-0.5">
                <div className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-semibold bg-[#FFF0E6] text-home-accent">
                  <div className="flex items-center">
                    <FileCode className="w-4 h-4 mr-3 text-home-accent" />
                    <span>Manage Problems</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-home-accent opacity-80" />
                </div>

                {/* Sub-items */}
                <div className="pl-6 space-y-1 pt-1">
                  <Link
                    to="/admin/problems/create"
                    className="w-full flex items-center px-3 py-2 rounded-lg text-xs font-semibold text-home-accent bg-orange-50/60 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 mr-2.5 text-home-accent" />
                    <span>Create Problem</span>
                  </Link>

                  <Link
                    to="/admin/problems"
                    className="w-full flex items-center px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/60 transition-colors"
                  >
                    <FileCode className="w-3.5 h-3.5 mr-2.5 text-gray-400" />
                    <span>Problem List</span>
                  </Link>
                </div>
              </div>

              <Link
                to="/admin"
                className="w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/60 transition-colors"
              >
                <Trophy className="w-4 h-4 mr-3 text-gray-400" />
                <span>Manage Contests</span>
              </Link>

              <Link
                to="/admin"
                className="w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/60 transition-colors"
              >
                <Users className="w-4 h-4 mr-3 text-gray-400" />
                <span>Users</span>
              </Link>

              <Link
                to="/admin"
                className="w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/60 transition-colors"
              >
                <Repeat className="w-4 h-4 mr-3 text-gray-400" />
                <span>Submissions</span>
              </Link>

              <Link
                to="/admin"
                className="w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/60 transition-colors"
              >
                <Server className="w-4 h-4 mr-3 text-gray-400" />
                <span>Judge Servers</span>
              </Link>

              <Link
                to="/admin"
                className="w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/60 transition-colors"
              >
                <Megaphone className="w-4 h-4 mr-3 text-gray-400" />
                <span>Announcements</span>
              </Link>

              <Link
                to="/admin"
                className="w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/60 transition-colors"
              >
                <BarChart2 className="w-4 h-4 mr-3 text-gray-400" />
                <span>Reports</span>
              </Link>

              <Link
                to="/admin"
                className="w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/60 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 mr-3 text-gray-400" />
                <span>System Health</span>
              </Link>

              <Link
                to="/admin"
                className="w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/60 transition-colors"
              >
                <Settings className="w-4 h-4 mr-3 text-gray-400" />
                <span>Settings</span>
              </Link>
            </nav>

            {/* Sidebar Illustration Card */}
            <div className="pt-2">
              <div className="rounded-2xl border border-gray-200/80 overflow-hidden shadow-xs relative bg-[#FBF2EA]">
                <img
                  src="/images/admin-sidebar-card.png"
                  alt="Build Manage Empower Developers."
                  className="w-full h-auto object-cover rounded-2xl"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-3 pt-1 text-xs">
              <p className="font-semibold text-gray-800">CodeArena Admin</p>
              <p className="text-gray-400 font-mono text-[11px] mt-0.5">v1.0.0</p>
            </div>
          </aside>

          {/* ══════════════ MAIN CONTENT ══════════════ */}
          <main className="flex-1 w-full min-w-0 space-y-6">

            {/* Breadcrumb & Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2 text-xs font-medium text-gray-500 mb-2">
                  <Link to="/admin/problems" className="hover:text-home-accent transition-colors">Manage Problems</Link>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-800 font-semibold">{isEdit ? 'Edit Problem' : 'Create New Problem'}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
                  {isEdit ? 'Edit Problem' : 'Create New Problem'}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Add a new coding problem to the platform. Fill in the details below.
                </p>
              </div>

              {/* Slanted Stamp on top right */}
              <div className="hidden xl:block text-right -rotate-2 transform self-center">
                <p className="text-xs sm:text-[13px] font-serif italic text-gray-800 font-semibold leading-tight">
                  Quality<br />Problems<br />Better<br />Developers
                </p>
                <div className="w-12 h-0.5 bg-home-accent ml-auto mt-1 rounded-full"></div>
              </div>
            </div>

            {/* Feedback Alerts */}
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center space-x-3 text-red-700 text-xs sm:text-sm animate-fade-in">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-3 text-emerald-700 text-xs sm:text-sm animate-fade-in">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
                <span>{success}</span>
              </div>
            )}

            {/* Form Main Grid */}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* ══════════════ LEFT COLUMN (Main Form) ══════════════ */}
              <div className="lg:col-span-7 xl:col-span-8 space-y-6">

                {/* 1. Basic Information Card */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-xs space-y-5">
                  <h2 className="font-bold text-gray-900 text-base">Basic Information</h2>

                  {/* Problem Title */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-700">
                        Problem Title <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[11px] text-gray-400 font-mono">
                        {title.length}/100
                      </span>
                    </div>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="Enter a clear and concise title"
                      maxLength={100}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-home-accent/20 focus:border-home-accent transition-all"
                    />
                  </div>

                  {/* Problem Slug */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700">
                      Problem Slug <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50/70 overflow-hidden focus-within:ring-2 focus-within:ring-home-accent/20 focus-within:border-home-accent transition-all">
                      <span className="px-3 text-xs text-gray-400 font-mono select-none bg-gray-100/60 py-2.5 border-r border-gray-200">
                        https://codearena.com/problems/
                      </span>
                      <input
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="two-sum"
                        className="flex-1 px-3 py-2.5 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none font-mono text-xs"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400">Use lowercase letters, numbers and hyphens only</p>
                  </div>

                  {/* 3-Column Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    
                    {/* Difficulty */}
                    <div className="space-y-1.5 relative">
                      <label className="text-xs font-semibold text-gray-700">
                        Difficulty <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsDifficultyOpen(!isDifficultyOpen)}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:border-gray-300 transition-all text-left"
                      >
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              difficulty === 'EASY'
                                ? 'bg-emerald-500'
                                : difficulty === 'MEDIUM'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                          ></span>
                          <span className="capitalize">{difficulty.toLowerCase()}</span>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      </button>

                      {isDifficultyOpen && (
                        <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-20 animate-fade-in text-xs">
                          {['EASY', 'MEDIUM', 'HARD'].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => {
                                setDifficulty(d);
                                setIsDifficultyOpen(false);
                              }}
                              className="w-full flex items-center px-3 py-2 hover:bg-orange-50/60 transition-colors space-x-2 text-gray-700"
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  d === 'EASY'
                                    ? 'bg-emerald-500'
                                    : d === 'MEDIUM'
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                              ></span>
                              <span className="capitalize">{d.toLowerCase()}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Topics */}
                    <div className="space-y-1.5 relative">
                      <label className="text-xs font-semibold text-gray-700">
                        Topics <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsTopicsOpen(!isTopicsOpen)}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:border-gray-300 transition-all text-left"
                      >
                        <span className="truncate">
                          {selectedTopics.length > 0 ? selectedTopics.join(', ') : 'Select topics'}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1" />
                      </button>

                      {isTopicsOpen && (
                        <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20 animate-fade-in text-xs max-h-48 overflow-y-auto">
                          {allTopics.map((t) => {
                            const isSelected = selectedTopics.includes(t);
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedTopics(selectedTopics.filter((item) => item !== t));
                                  } else {
                                    setSelectedTopics([...selectedTopics, t]);
                                  }
                                }}
                                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-orange-50/60 transition-colors text-gray-700"
                              >
                                <span>{t}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-home-accent" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Company Tags */}
                    <div className="space-y-1.5 relative">
                      <label className="text-xs font-semibold text-gray-700">Company Tags</label>
                      <button
                        type="button"
                        onClick={() => setIsCompaniesOpen(!isCompaniesOpen)}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:border-gray-300 transition-all text-left"
                      >
                        <span className="truncate">
                          {selectedCompanies.length > 0 ? selectedCompanies.join(', ') : 'Select company tags'}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1" />
                      </button>

                      {isCompaniesOpen && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20 animate-fade-in text-xs max-h-48 overflow-y-auto">
                          {allCompanies.map((c) => {
                            const isSelected = selectedCompanies.includes(c);
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedCompanies(selectedCompanies.filter((item) => item !== c));
                                  } else {
                                    setSelectedCompanies([...selectedCompanies, c]);
                                  }
                                }}
                                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-orange-50/60 transition-colors text-gray-700"
                              >
                                <span>{c}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-home-accent" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                {/* 2. Problem Statement Card */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-xs space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-gray-900 text-base">Problem Statement</h2>
                    
                    {/* Write / Preview Tabs */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setStatementTab('write')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                          statementTab === 'write'
                            ? 'bg-white text-home-accent shadow-xs'
                            : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        Write
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatementTab('preview')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                          statementTab === 'preview'
                            ? 'bg-white text-home-accent shadow-xs'
                            : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        Preview
                      </button>
                    </div>
                  </div>

                  {/* Markdown Toolbar */}
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center space-x-1 sm:space-x-2 text-gray-500">
                      <button
                        type="button"
                        onClick={() => handleToolbarInsert('### ')}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Heading"
                      >
                        <Heading className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToolbarInsert('**bold**')}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Bold"
                      >
                        <Bold className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToolbarInsert('*italic*')}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Italic"
                      >
                        <Italic className="w-4 h-4" />
                      </button>
                      <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
                      <button
                        type="button"
                        onClick={() => handleToolbarInsert('\n- item')}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Bullet List"
                      >
                        <List className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToolbarInsert('\n1. item')}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Numbered List"
                      >
                        <ListOrdered className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToolbarInsert('`code`')}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Code snippet"
                      >
                        <Code className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToolbarInsert('[link](url)')}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Link"
                      >
                        <LinkIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToolbarInsert('![image](url)')}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Image"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                    </div>

                    <a
                      href="https://www.markdownguide.org/basic-syntax/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Markdown Guide</span>
                    </a>
                  </div>

                  {/* Problem statement textarea or preview */}
                  {statementTab === 'write' ? (
                    <div className="space-y-1 relative">
                      <textarea
                        rows={6}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Write the problem statement here..."
                        maxLength={10000}
                        className="w-full p-3.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-home-accent/20 focus:border-home-accent transition-all leading-relaxed"
                      />
                      <div className="text-right text-[11px] text-gray-400 font-mono pr-1">
                        {description.length}/10000
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 min-h-[140px] text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {description || <span className="text-gray-400 italic">No description entered yet.</span>}
                    </div>
                  )}

                  {/* Input Format */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-700">Input Format</label>
                      <span className="text-[11px] text-gray-400 font-mono">{inputFormat.length}/2000</span>
                    </div>
                    <textarea
                      rows={2}
                      value={inputFormat}
                      onChange={(e) => setInputFormat(e.target.value)}
                      placeholder="Describe the input format..."
                      maxLength={2000}
                      className="w-full p-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-home-accent/20 focus:border-home-accent transition-all"
                    />
                  </div>

                  {/* Output Format */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-700">Output Format</label>
                      <span className="text-[11px] text-gray-400 font-mono">{outputFormat.length}/2000</span>
                    </div>
                    <textarea
                      rows={2}
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      placeholder="Describe the output format..."
                      maxLength={2000}
                      className="w-full p-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-home-accent/20 focus:border-home-accent transition-all"
                    />
                  </div>

                  {/* Constraints */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-700">Constraints</label>
                      <span className="text-[11px] text-gray-400 font-mono">{constraints.length}/1000</span>
                    </div>
                    <textarea
                      rows={2}
                      value={constraints}
                      onChange={(e) => setConstraints(e.target.value)}
                      placeholder="Add constraints..."
                      maxLength={1000}
                      className="w-full p-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-home-accent/20 focus:border-home-accent transition-all"
                    />
                  </div>
                </div>

                {/* 3. Examples Section */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                  <h2 className="font-bold text-gray-900 text-base">Examples</h2>

                  {examples.map((ex, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-gray-200/90 bg-gray-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-800">Example {idx + 1}</span>
                        {examples.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveExample(idx)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600 mb-1 block">Input</label>
                          <textarea
                            rows={2}
                            value={ex.input}
                            onChange={(e) => handleExampleChange(idx, 'input', e.target.value)}
                            placeholder="Enter input..."
                            className="w-full p-2.5 rounded-lg border border-gray-200 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-home-accent/20 focus:border-home-accent"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600 mb-1 block">Output</label>
                          <textarea
                            rows={2}
                            value={ex.output}
                            onChange={(e) => handleExampleChange(idx, 'output', e.target.value)}
                            placeholder="Enter output..."
                            className="w-full p-2.5 rounded-lg border border-gray-200 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-home-accent/20 focus:border-home-accent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-gray-600 mb-1 block">Explanation (Optional)</label>
                        <textarea
                          rows={2}
                          value={ex.explanation}
                          onChange={(e) => handleExampleChange(idx, 'explanation', e.target.value)}
                          placeholder="Enter explanation..."
                          className="w-full p-2.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-home-accent/20 focus:border-home-accent"
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddExample}
                    className="inline-flex items-center text-xs font-semibold text-gray-700 hover:text-home-accent border border-gray-200 bg-white hover:border-home-accent/40 px-3.5 py-2 rounded-xl transition-all shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add Example
                  </button>
                </div>

              </div>

              {/* ══════════════ RIGHT COLUMN (Test Cases, Code, Settings) ══════════════ */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-6">

                {/* 1. Test Cases Card */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-gray-900 text-base">Test Cases</h2>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Add sample and hidden test cases for evaluation.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTestCase}
                      className="inline-flex items-center text-xs font-semibold text-gray-700 hover:text-home-accent border border-gray-200 bg-white hover:border-gray-300 px-2.5 py-1.5 rounded-xl shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Test Case
                    </button>
                  </div>

                  {/* Tabs: Sample / Hidden */}
                  <div className="flex items-center border-b border-gray-200 text-xs font-medium space-x-6">
                    <button
                      type="button"
                      onClick={() => setTestCaseTab('sample')}
                      className={`pb-2.5 transition-colors relative ${
                        testCaseTab === 'sample'
                          ? 'text-home-accent font-semibold'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Sample Test Cases
                      {testCaseTab === 'sample' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-home-accent rounded-full"></div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTestCaseTab('hidden')}
                      className={`pb-2.5 transition-colors relative ${
                        testCaseTab === 'hidden'
                          ? 'text-home-accent font-semibold'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Hidden Test Cases
                      {testCaseTab === 'hidden' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-home-accent rounded-full"></div>
                      )}
                    </button>
                  </div>

                  {/* Test Case Items */}
                  {(testCaseTab === 'sample' ? sampleTestCases : hiddenTestCases).map((tc, idx) => (
                    <div key={tc.id || idx} className="p-3.5 rounded-xl border border-gray-200/80 bg-gray-50/50 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-800">Test Case {idx + 1}</span>
                        {(testCaseTab === 'sample' ? sampleTestCases : hiddenTestCases).length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTestCase(idx)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600 mb-1 block">Input</label>
                          <textarea
                            rows={3}
                            value={tc.input}
                            onChange={(e) => {
                              const arr = testCaseTab === 'sample' ? [...sampleTestCases] : [...hiddenTestCases];
                              arr[idx].input = e.target.value;
                              if (testCaseTab === 'sample') setSampleTestCases(arr);
                              else setHiddenTestCases(arr);
                            }}
                            placeholder="Enter input..."
                            className="w-full p-2 rounded-lg border border-gray-200 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-home-accent/20 focus:border-home-accent"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600 mb-1 block">Expected Output</label>
                          <textarea
                            rows={3}
                            value={tc.expectedOutput}
                            onChange={(e) => {
                              const arr = testCaseTab === 'sample' ? [...sampleTestCases] : [...hiddenTestCases];
                              arr[idx].expectedOutput = e.target.value;
                              if (testCaseTab === 'sample') setSampleTestCases(arr);
                              else setHiddenTestCases(arr);
                            }}
                            placeholder="Enter expected output..."
                            className="w-full p-2 rounded-lg border border-gray-200 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-home-accent/20 focus:border-home-accent"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 2. Code Templates (Optional) Card */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-gray-900 text-base">Code Templates <span className="text-xs font-normal text-gray-400">(Optional)</span></h2>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Provide starter code for different languages.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center text-xs font-semibold text-gray-700 hover:text-home-accent border border-gray-200 bg-white hover:border-gray-300 px-2.5 py-1.5 rounded-xl shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Language
                    </button>
                  </div>

                  {/* Language Tabs */}
                  <div className="flex items-center border-b border-gray-200 text-xs font-medium space-x-5">
                    {[
                      { id: 'cpp', name: 'C++' },
                      { id: 'python', name: 'Python' },
                      { id: 'java', name: 'Java' },
                      { id: 'javascript', name: 'JavaScript' }
                    ].map((lang) => (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => setTemplateLang(lang.id)}
                        className={`pb-2.5 transition-colors relative ${
                          templateLang === lang.id
                            ? 'text-home-accent font-semibold'
                            : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        {lang.name}
                        {templateLang === lang.id && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-home-accent rounded-full"></div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Dark Code Box */}
                  <div className="rounded-xl bg-[#0F172A] text-slate-100 p-4 font-mono text-xs relative overflow-hidden shadow-inner">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">{templateLang}</span>
                      <button
                        type="button"
                        onClick={handleCopyTemplate}
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                        title="Copy Template"
                      >
                        {copiedTemplate ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="overflow-x-auto text-[11px] leading-relaxed">
                      {codeTemplates[templateLang].split('\n').map((line, lidx) => (
                        <div key={lidx} className="flex">
                          <span className="w-6 text-slate-500 select-none text-right pr-3 flex-shrink-0">
                            {lidx + 1}
                          </span>
                          <span className="text-slate-200 whitespace-pre">
                            {line}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Additional Settings Card */}
                <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-3.5">
                  <h2 className="font-bold text-gray-900 text-base">Additional Settings</h2>

                  <div className="space-y-3 pt-1 text-xs">
                    
                    {/* Make problem public */}
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.isPublic}
                        onChange={(e) => setSettings({ ...settings, isPublic: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <span className="font-semibold text-gray-800 block">Make problem public</span>
                        <span className="text-gray-400 text-[11px]">Visible to all users after review</span>
                      </div>
                    </label>

                    {/* Feature this problem */}
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.isFeatured}
                        onChange={(e) => setSettings({ ...settings, isFeatured: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <span className="font-semibold text-gray-800 block">Feature this problem</span>
                        <span className="text-gray-400 text-[11px]">Show on homepage / recommended section</span>
                      </div>
                    </label>

                    {/* Add to a contest */}
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.addToContest}
                        onChange={(e) => setSettings({ ...settings, addToContest: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <span className="font-semibold text-gray-800 block">Add to a contest</span>
                        <span className="text-gray-400 text-[11px]">Select contest later</span>
                      </div>
                    </label>

                    {/* Set time limit */}
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.setTimeLimit}
                        onChange={(e) => setSettings({ ...settings, setTimeLimit: e.target.checked })}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <span className="font-semibold text-gray-800 block">Set time limit</span>
                        <span className="text-gray-400 text-[11px]">Override default time limit (2s)</span>
                      </div>
                    </label>

                  </div>
                </div>

                {/* 4. Action Buttons */}
                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/admin/problems')}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs sm:text-sm font-semibold hover:border-gray-300 hover:bg-gray-50 transition-all shadow-xs"
                  >
                    Save as Draft
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center px-6 py-2.5 rounded-xl bg-home-accent text-white text-xs sm:text-sm font-semibold hover:bg-home-accent-hover active:scale-[0.98] transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 mr-2 -rotate-45" />
                    <span>{isSaving ? 'Creating...' : isEdit ? 'Update Problem' : 'Create Problem'}</span>
                  </button>
                </div>

              </div>

            </form>

          </main>
        </div>
      </div>
    </div>
  );
}

export default AdminProblemForm;
