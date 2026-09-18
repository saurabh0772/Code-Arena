import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Code2, ArrowRight, ChevronDown, ChevronLeft, ChevronRight,
  Bookmark, List, LayoutGrid, Flame, PlaySquare, Building2, Timer,
  Tags, CheckCircle2, Trophy, Users, BarChart3, AlertCircle
} from 'lucide-react';
import { problemService } from '../services/api/problem.service';
import { HomeNavbar } from '../components/layout/HomeNavbar';

// Showcase sample problems matching the UI design, mapped to real backend problem IDs when available
const SHOWCASE_PROBLEMS = [
  {
    displayId: 1,
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    topics: ['Array', 'Hash Map'],
    extraTopicsCount: 1,
    acceptance: '52.3%',
    solvedCount: '124.6K',
    company: 'Google'
  },
  {
    displayId: 2,
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    topics: ['Stack', 'String'],
    acceptance: '48.7%',
    solvedCount: '98.4K',
    company: 'Amazon'
  },
  {
    displayId: 3,
    slug: 'merge-two-sorted-lists',
    title: 'Merge Two Sorted Lists',
    difficulty: 'Easy',
    topics: ['Linked List', 'Recursion'],
    acceptance: '50.1%',
    solvedCount: '92.1K',
    company: 'Microsoft'
  },
  {
    displayId: 4,
    slug: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    topics: ['String', 'Hash Map', 'Sliding Window'],
    acceptance: '36.2%',
    solvedCount: '78.5K',
    company: 'Amazon'
  },
  {
    displayId: 5,
    slug: 'median-of-two-sorted-arrays',
    title: 'median of Two Sorted Arrays',
    difficulty: 'Hard',
    topics: ['Array', 'Binary Search', 'Divide & Conquer'],
    acceptance: '32.1%',
    solvedCount: '64.2K',
    company: 'Google'
  },
  {
    displayId: 6,
    slug: 'palindrome-number',
    title: 'Palindrome Number',
    difficulty: 'Easy',
    topics: ['Math', 'String'],
    acceptance: '55.6%',
    solvedCount: '110.4K',
    company: 'Meta'
  },
  {
    displayId: 7,
    slug: 'reverse-linked-list',
    title: 'Reverse Linked List',
    difficulty: 'Easy',
    topics: ['Linked List', 'Recursion'],
    acceptance: '58.3%',
    solvedCount: '101.3K',
    company: 'Apple'
  },
  {
    displayId: 8,
    slug: 'maximum-subarray',
    title: 'Maximum Subarray',
    difficulty: 'Medium',
    topics: ['Array', 'Dynamic Programming'],
    acceptance: '44.9%',
    solvedCount: '86.7K',
    company: 'Microsoft'
  },
  {
    displayId: 9,
    slug: 'climbing-stairs',
    title: 'Climbing Stairs',
    difficulty: 'Easy',
    topics: ['Dynamic Programming', 'Math'],
    acceptance: '49.2%',
    solvedCount: '93.1K',
    company: 'Amazon'
  },
  {
    displayId: 10,
    slug: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    difficulty: 'Hard',
    topics: ['Array', 'Two Pointers', 'Stack'],
    acceptance: '41.7%',
    solvedCount: '71.9K',
    company: 'Google'
  }
];

const SIDEBAR_NAV = [
  { id: 'all', label: 'All Problems', icon: Code2 },
  { id: 'recommended', label: 'Recommended', icon: Flame },
  { id: 'playlist', label: 'Playlist', icon: PlaySquare },
  { id: 'companies', label: 'Company Tags', icon: Building2 },
  { id: 'difficulty', label: 'Difficulty', icon: Timer },
  { id: 'topics', label: 'Topics', icon: Tags },
  { id: 'solved', label: 'Solved By Me', icon: CheckCircle2 }
];

const PAGE_SIZE = 10;
const TOTAL_PROBLEMS_COUNT = 532;

export function Problems() {
  const navigate = useNavigate();

  // State
  const [activeNav, setActiveNav] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [selectedCompany, setSelectedCompany] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortBy, setSortBy] = useState('default');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [currentPage, setCurrentPage] = useState(1);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());

  // Dropdown open states
  const [openDropdown, setOpenDropdown] = useState(null);

  // Backend problems data
  const [backendProblems, setBackendProblems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch problems from backend
  useEffect(() => {
    async function loadProblems() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await problemService.getProblems();
        setBackendProblems(data);
      } catch (err) {
        console.warn('Could not load backend problems:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProblems();
  }, []);

  // Map real backend problem IDs to showcase list by matching titles
  const allProblems = useMemo(() => {
    const titleMap = new Map();
    backendProblems.forEach((p) => {
      titleMap.set(p.title.toLowerCase().trim(), p);
    });

    // Merge showcase problems with real IDs
    const mergedShowcase = SHOWCASE_PROBLEMS.map((sp) => {
      const real = titleMap.get(sp.title.toLowerCase().trim());
      return {
        ...sp,
        id: real ? real.id : (backendProblems[0]?.id || 'showcase-' + sp.displayId),
        realProblem: !!real
      };
    });

    // Also include any backend problems that weren't in the top 10 showcase list
    const existingTitles = new Set(mergedShowcase.map((p) => p.title.toLowerCase().trim()));
    const additional = backendProblems
      .filter((bp) => !existingTitles.has(bp.title.toLowerCase().trim()))
      .map((bp, idx) => ({
        displayId: SHOWCASE_PROBLEMS.length + idx + 1,
        id: bp.id,
        title: bp.title,
        difficulty: bp.difficulty ? bp.difficulty.charAt(0) + bp.difficulty.slice(1).toLowerCase() : 'Medium',
        topics: bp.tags && bp.tags.length > 0 ? bp.tags.map((t) => t.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())) : ['Algorithms'],
        extraTopicsCount: 0,
        acceptance: '45.0%',
        solvedCount: '15.2K',
        company: 'CodeArena',
        realProblem: true
      }));

    return [...mergedShowcase, ...additional];
  }, [backendProblems]);

  // Toggle bookmark
  const toggleBookmark = (id) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Filter & Search Logic
  const filteredProblems = useMemo(() => {
    return allProblems.filter((p) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesTopics = p.topics.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesTopics) return false;
      }

      // Difficulty
      if (selectedDifficulty !== 'All') {
        if (p.difficulty.toLowerCase() !== selectedDifficulty.toLowerCase()) return false;
      }

      // Topic
      if (selectedTopic !== 'All') {
        if (!p.topics.some((t) => t.toLowerCase().includes(selectedTopic.toLowerCase()))) return false;
      }

      // Company
      if (selectedCompany !== 'All') {
        if (p.company?.toLowerCase() !== selectedCompany.toLowerCase()) return false;
      }

      // Status
      if (selectedStatus === 'Solved') {
        if (p.solvedCount === '0') return false;
      }

      // Sidebar filter
      if (activeNav === 'recommended') {
        return p.displayId <= 5;
      }
      if (activeNav === 'solved') {
        return bookmarkedIds.has(p.id) || p.displayId % 2 === 0;
      }

      return true;
    });
  }, [allProblems, searchQuery, selectedDifficulty, selectedTopic, selectedCompany, selectedStatus, activeNav, bookmarkedIds]);

  // Paginated slice
  const paginatedProblems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredProblems.slice(start, start + PAGE_SIZE);
  }, [filteredProblems, currentPage]);

  const totalPages = Math.ceil(TOTAL_PROBLEMS_COUNT / PAGE_SIZE);
  const currentStart = (currentPage - 1) * PAGE_SIZE + 1;
  const currentEnd = Math.min(currentPage * PAGE_SIZE, TOTAL_PROBLEMS_COUNT);

  // Handle problem navigation
  const handleSolve = (problem) => {
    if (problem.id && !problem.id.startsWith('showcase-')) {
      navigate(`/problems/${problem.id}`);
    } else if (backendProblems.length > 0) {
      navigate(`/problems/${backendProblems[0].id}`);
    } else {
      navigate(`/problems/${problem.id}`);
    }
  };

  return (
    <div className="home-page min-h-screen bg-home-bg text-home-text font-sans flex flex-col selection:bg-orange-100 selection:text-home-accent">
      {/* Top Light Navbar */}
      <HomeNavbar />

      {/* Main Page Layout */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* ══════════════ LEFT SIDEBAR ══════════════ */}
          <aside className="w-full lg:w-60 xl:w-64 shrink-0">
            <div className="mb-2 px-3">
              <span className="text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                PROBLEMS
              </span>
            </div>

            {/* Sidebar Navigation */}
            <nav className="space-y-1">
              {SIDEBAR_NAV.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveNav(item.id); setCurrentPage(1); }}
                    className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#FFF0E6] text-home-accent font-semibold shadow-xs'
                        : 'text-home-text-secondary hover:text-home-text hover:bg-orange-50/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-home-accent' : 'text-gray-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Consistency Graphic Card */}
            <div className="mt-8 bg-gradient-to-b from-[#FFF5ED] via-[#FFF0E6] to-[#FDDCBF]/35 rounded-2xl p-5 border border-orange-100 shadow-xs relative overflow-hidden">
              <h3 className="text-base font-extrabold text-[#1A1A2E] leading-tight">
                Consistency<br />Builds Great<br />Developers.
              </h3>
              <div className="w-8 h-1 bg-home-accent rounded-full mt-2 mb-4"></div>

              {/* Developer Illustration (From back with laptop and indoor plant) */}
              <div className="relative my-1 flex items-center justify-center">
                <svg viewBox="0 0 200 150" className="w-full h-auto max-w-[190px]" fill="none">
                  {/* Subtle room light */}
                  <circle cx="100" cy="80" r="60" fill="#FFFDF8" opacity="0.6" />

                  {/* Potted plant on right */}
                  <ellipse cx="172" cy="132" rx="14" ry="4" fill="#E0D3C1" />
                  <path d="M162 110 C 160 85, 172 65, 180 50 C 182 72, 178 95, 168 110 Z" fill="#2E7D32" />
                  <path d="M168 110 C 172 90, 186 75, 192 60 C 188 85, 182 102, 172 110 Z" fill="#4CAF50" />
                  <path d="M158 110 C 150 95, 142 80, 150 65 C 156 80, 160 98, 160 110 Z" fill="#66BB6A" />
                  <rect x="160" y="108" width="22" height="24" rx="3" fill="#D7CCC8" />
                  <rect x="158" y="106" width="26" height="4" rx="2" fill="#BCAAA4" />

                  {/* Desk top */}
                  <rect x="6" y="130" width="188" height="6" rx="2" fill="#E0D3C1" />
                  <line x1="20" y1="136" x2="20" y2="150" stroke="#BCAAA4" strokeWidth="3" />
                  <line x1="178" y1="136" x2="178" y2="150" stroke="#BCAAA4" strokeWidth="3" />

                  {/* Laptop open on desk */}
                  <rect x="36" y="105" width="48" height="24" rx="2" fill="#1E293B" />
                  <polygon points="32,130 88,130 84,127 36,127" fill="#334155" />
                  {/* Code on screen */}
                  <rect x="42" y="110" width="16" height="2" rx="1" fill="#F26522" />
                  <rect x="42" y="114" width="24" height="2" rx="1" fill="#38BDF8" />
                  <rect x="42" y="118" width="20" height="2" rx="1" fill="#4ADE80" />
                  <rect x="42" y="122" width="12" height="2" rx="1" fill="#FBBF24" />

                  {/* Office Chair back */}
                  <path d="M10 75 C 10 70, 24 70, 24 75 L 24 135 L 10 135 Z" fill="#64748B" rx="3" />

                  {/* Developer sitting (Back view) */}
                  {/* Orange hoodie body */}
                  <path d="M42 100 C 42 80, 78 80, 84 100 L 88 132 L 38 132 Z" fill="#F26522" />
                  <path d="M50 86 C 50 82, 70 82, 74 86 C 76 96, 50 96, 50 86 Z" fill="#EA580C" />
                  {/* Arms typing */}
                  <path d="M42 104 Q 40 120 48 126" stroke="#D9480F" strokeWidth="6" strokeLinecap="round" />
                  <path d="M78 104 Q 72 120 62 126" stroke="#D9480F" strokeWidth="6" strokeLinecap="round" />

                  {/* Head & dark hair */}
                  <circle cx="62" cy="74" r="13" fill="#334155" />
                  <path d="M50 72 C 50 60, 74 60, 74 72 C 72 70, 52 70, 50 72 Z" fill="#1E293B" />
                </svg>
              </div>

              {/* Light swoosh & quote under card */}
              <div className="pt-2 text-center">
                <p className="text-xs text-home-text-secondary italic font-serif leading-relaxed">
                  “A problem today,<br />a better you tomorrow.”
                </p>
                <svg className="w-24 h-2 mx-auto text-home-accent mt-1 stroke-current" viewBox="0 0 100 8" fill="none">
                  <path d="M5 4 Q 50 1, 95 5" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </aside>

          {/* ══════════════ MAIN CONTENT AREA ══════════════ */}
          <main className="flex-1 w-full min-w-0">

            {/* Breadcrumb Tag */}
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-orange-100/80 text-home-accent flex items-center justify-center">
                <Users className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-gray-500">Problems</span>
            </div>

            {/* Hero Header + Mountain Graphic */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative">
              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1A1A2E] tracking-tight leading-[1.18]">
                  Sharpen Your <span className="text-home-accent">Problem-Solving</span> Skills
                </h1>
                <p className="text-sm sm:text-base text-home-text-secondary mt-2 max-w-xl">
                  Solve problems, learn new concepts, and become a better developer — one challenge at a time.
                </p>
              </div>

              {/* Mountain Illustration Banner (Right) */}
              <div className="hidden sm:flex items-center space-x-4 shrink-0 self-end md:self-auto select-none">
                {/* Motivational Steps */}
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-800 font-serif leading-tight">
                    Solve<br />
                    Learn<br />
                    Improve<br />
                    Repeat
                  </p>
                  <div className="w-12 h-1 bg-home-accent rounded-full ml-auto mt-1 rotate-[-2deg]"></div>
                </div>

                {/* Stylized Mountain Peak with Orange Flag */}
                <svg viewBox="0 0 120 80" className="w-28 h-20" fill="none">
                  <defs>
                    <linearGradient id="mtnGrad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F5EDE4" />
                      <stop offset="100%" stopColor="#E5D6C8" />
                    </linearGradient>
                    <linearGradient id="mtnGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E0CFC0" />
                      <stop offset="100%" stopColor="#C9B39F" />
                    </linearGradient>
                  </defs>
                  {/* Rear peak */}
                  <polygon points="15,80 65,22 105,80" fill="url(#mtnGrad1)" />
                  {/* Foreground peak */}
                  <polygon points="40,80 80,16 120,80" fill="url(#mtnGrad2)" />
                  <polygon points="40,80 80,16 68,80" fill="#BFA793" opacity="0.6" />
                  {/* Flagpole */}
                  <line x1="80" y1="16" x2="80" y2="5" stroke="#78350F" strokeWidth="1.5" strokeLinecap="round" />
                  {/* Orange Flag */}
                  <polygon points="80,5 94,9 80,13" fill="#F26522" />
                </svg>
              </div>
            </div>

            {/* ══════════════ STATS CARDS ══════════════ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {/* Card 1: Problems */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs flex items-center space-x-3.5 hover:border-orange-200 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-orange-50/90 border border-orange-100 flex items-center justify-center text-home-accent font-mono font-bold text-lg shrink-0">
                  &lt;/&gt;
                </div>
                <div>
                  <div className="text-xl font-extrabold text-[#1A1A2E]">
                    {TOTAL_PROBLEMS_COUNT}+
                  </div>
                  <div className="text-xs text-gray-500 font-medium">Problems</div>
                </div>
              </div>

              {/* Card 2: Active Solvers */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs flex items-center space-x-3.5 hover:border-orange-200 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-orange-50/90 border border-orange-100 flex items-center justify-center text-home-accent shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xl font-extrabold text-[#1A1A2E]">10K+</div>
                  <div className="text-xs text-gray-500 font-medium">Active Solvers</div>
                </div>
              </div>

              {/* Card 3: Company Tags */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs flex items-center space-x-3.5 hover:border-orange-200 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-orange-50/90 border border-orange-100 flex items-center justify-center text-home-accent shrink-0">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xl font-extrabold text-[#1A1A2E]">50+</div>
                  <div className="text-xs text-gray-500 font-medium">Company Tags</div>
                </div>
              </div>

              {/* Card 4: Difficulty Levels */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs flex items-center space-x-3.5 hover:border-orange-200 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-orange-50/90 border border-orange-100 flex items-center justify-center text-home-accent shrink-0">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xl font-extrabold text-[#1A1A2E]">Multiple</div>
                  <div className="text-xs text-gray-500 font-medium">Difficulty Levels</div>
                </div>
              </div>
            </div>

            {/* ══════════════ SEARCH & FILTER BAR ══════════════ */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-8 mb-4">
              {/* Search input */}
              <div className="relative flex-1 min-w-[280px] max-w-sm lg:max-w-md">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search problems by title, description or tags..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50/90 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-sm text-home-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-home-accent/30 focus:border-home-accent/50 transition-all"
                />
              </div>

              {/* Filter Dropdowns */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Difficulty Dropdown */}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenDropdown(openDropdown === 'difficulty' ? null : 'difficulty')}
                    className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                      selectedDifficulty !== 'All'
                        ? 'bg-orange-50 text-home-accent border-orange-200'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span>{selectedDifficulty === 'All' ? 'Difficulty' : selectedDifficulty}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>
                  {openDropdown === 'difficulty' && (
                    <div className="absolute top-full left-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-30">
                      {['All', 'Easy', 'Medium', 'Hard'].map((diff) => (
                        <button
                          key={diff}
                          onClick={() => { setSelectedDifficulty(diff); setOpenDropdown(null); setCurrentPage(1); }}
                          className={`w-full text-left px-3.5 py-1.5 text-xs transition-colors ${
                            selectedDifficulty === diff ? 'text-home-accent font-bold bg-orange-50' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Topics Dropdown */}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenDropdown(openDropdown === 'topics' ? null : 'topics')}
                    className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                      selectedTopic !== 'All'
                        ? 'bg-orange-50 text-home-accent border-orange-200'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span>{selectedTopic === 'All' ? 'Topics' : selectedTopic}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>
                  {openDropdown === 'topics' && (
                    <div className="absolute top-full left-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-30 max-h-60 overflow-y-auto">
                      {['All', 'Array', 'String', 'Hash Map', 'Dynamic Programming', 'Stack', 'Linked List', 'Binary Search', 'Math', 'Two Pointers'].map((t) => (
                        <button
                          key={t}
                          onClick={() => { setSelectedTopic(t); setOpenDropdown(null); setCurrentPage(1); }}
                          className={`w-full text-left px-3.5 py-1.5 text-xs transition-colors ${
                            selectedTopic === t ? 'text-home-accent font-bold bg-orange-50' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Companies Dropdown */}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenDropdown(openDropdown === 'companies' ? null : 'companies')}
                    className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                      selectedCompany !== 'All'
                        ? 'bg-orange-50 text-home-accent border-orange-200'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span>{selectedCompany === 'All' ? 'Companies' : selectedCompany}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>
                  {openDropdown === 'companies' && (
                    <div className="absolute top-full left-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-30">
                      {['All', 'Google', 'Amazon', 'Meta', 'Microsoft', 'Apple'].map((c) => (
                        <button
                          key={c}
                          onClick={() => { setSelectedCompany(c); setOpenDropdown(null); setCurrentPage(1); }}
                          className={`w-full text-left px-3.5 py-1.5 text-xs transition-colors ${
                            selectedCompany === c ? 'text-home-accent font-bold bg-orange-50' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status Dropdown */}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                    className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                      selectedStatus !== 'All'
                        ? 'bg-orange-50 text-home-accent border-orange-200'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span>{selectedStatus === 'All' ? 'Status' : selectedStatus}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>
                  {openDropdown === 'status' && (
                    <div className="absolute top-full left-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-30">
                      {['All', 'Todo', 'Solved', 'Attempted'].map((s) => (
                        <button
                          key={s}
                          onClick={() => { setSelectedStatus(s); setOpenDropdown(null); setCurrentPage(1); }}
                          className={`w-full text-left px-3.5 py-1.5 text-xs transition-colors ${
                            selectedStatus === s ? 'text-home-accent font-bold bg-orange-50' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sort by Dropdown */}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenDropdown(openDropdown === 'sort' ? null : 'sort')}
                    className="flex items-center space-x-1.5 px-3 py-2 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 text-xs font-semibold rounded-xl transition-all"
                  >
                    <span>Sort by</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>
                  {openDropdown === 'sort' && (
                    <div className="absolute top-full right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-30">
                      {[
                        { id: 'default', label: 'Default (#)' },
                        { id: 'acceptance', label: 'Acceptance Rate' },
                        { id: 'diff-asc', label: 'Difficulty (Easy first)' },
                        { id: 'diff-desc', label: 'Difficulty (Hard first)' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => { setSortBy(item.id); setOpenDropdown(null); }}
                          className={`w-full text-left px-3.5 py-1.5 text-xs transition-colors ${
                            sortBy === item.id ? 'text-home-accent font-bold bg-orange-50' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center space-x-1 ml-1 border border-gray-200 rounded-xl p-0.5 bg-white">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-all ${
                      viewMode === 'list'
                        ? 'bg-orange-50 text-home-accent shadow-xs'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    title="List view"
                    aria-label="List view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-all ${
                      viewMode === 'grid'
                        ? 'bg-orange-50 text-home-accent shadow-xs'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    title="Grid view"
                    aria-label="Grid view"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Error Message if any */}
            {error && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center space-x-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* ══════════════ PROBLEMS TABLE (LIST VIEW) ══════════════ */}
            {viewMode === 'list' ? (
              <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[720px]">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">Title</th>
                        <th className="py-3 px-4 w-28">Difficulty</th>
                        <th className="py-3 px-4">Topics</th>
                        <th className="py-3 px-4 w-24">Acceptance</th>
                        <th className="py-3 px-4 w-24">Solved</th>
                        <th className="py-3 px-4 w-32 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {paginatedProblems.map((problem) => {
                        const isBookmarked = bookmarkedIds.has(problem.id);
                        return (
                          <tr
                            key={problem.id}
                            onClick={() => handleSolve(problem)}
                            className="group hover:bg-orange-50/30 transition-colors cursor-pointer"
                          >
                            {/* # Index */}
                            <td className="py-3.5 px-4 text-center font-mono text-xs text-gray-500 font-medium">
                              {problem.displayId}
                            </td>

                            {/* Title */}
                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-home-text group-hover:text-home-accent transition-colors">
                                {problem.title}
                              </span>
                            </td>

                            {/* Difficulty */}
                            <td className="py-3.5 px-4">
                              <DifficultyBadge difficulty={problem.difficulty} />
                            </td>

                            {/* Topics */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center flex-wrap gap-1.5">
                                {problem.topics.map((topic) => (
                                  <span
                                    key={topic}
                                    className="px-2.5 py-0.5 rounded-lg bg-gray-100/90 text-gray-600 text-xs font-medium border border-gray-200/40"
                                  >
                                    {topic}
                                  </span>
                                ))}
                                {problem.extraTopicsCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-gray-100/90 text-gray-500 text-xs font-semibold">
                                    +{problem.extraTopicsCount}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Acceptance */}
                            <td className="py-3.5 px-4 text-sm font-medium text-gray-600">
                              {problem.acceptance}
                            </td>

                            {/* Solved Count */}
                            <td className="py-3.5 px-4 text-sm font-medium text-gray-600">
                              {problem.solvedCount}
                            </td>

                            {/* Actions: Solve & Bookmark */}
                            <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => handleSolve(problem)}
                                  className="px-3.5 py-1.5 text-xs font-semibold text-home-accent bg-orange-50 hover:bg-home-accent hover:text-white border border-orange-200/60 rounded-xl transition-all inline-flex items-center space-x-1 shadow-xs hover:shadow active:scale-95"
                                >
                                  <span>Solve</span>
                                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                </button>
                                <button
                                  onClick={() => toggleBookmark(problem.id)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    isBookmarked
                                      ? 'text-home-accent bg-orange-50'
                                      : 'text-gray-400 hover:text-home-accent hover:bg-gray-100'
                                  }`}
                                  aria-label="Bookmark"
                                >
                                  <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-home-accent text-home-accent' : ''}`} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* ══════════════ GRID VIEW ══════════════ */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedProblems.map((problem) => {
                  const isBookmarked = bookmarkedIds.has(problem.id);
                  return (
                    <div
                      key={problem.id}
                      onClick={() => handleSolve(problem)}
                      className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs hover:shadow-md hover:border-orange-200 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs text-gray-400 font-bold">#{problem.displayId}</span>
                            <DifficultyBadge difficulty={problem.difficulty} />
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleBookmark(problem.id); }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isBookmarked ? 'text-home-accent bg-orange-50' : 'text-gray-400 hover:text-home-accent'
                            }`}
                          >
                            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-home-accent text-home-accent' : ''}`} />
                          </button>
                        </div>

                        <h3 className="font-bold text-base text-home-text hover:text-home-accent transition-colors mb-3">
                          {problem.title}
                        </h3>

                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {problem.topics.map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded-lg bg-gray-100/90 text-gray-600 text-xs font-medium">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          <span>{problem.acceptance} acceptance</span> • <span>{problem.solvedCount} solved</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSolve(problem); }}
                          className="px-3 py-1.5 text-xs font-semibold text-home-accent bg-orange-50 hover:bg-home-accent hover:text-white rounded-xl border border-orange-200/60 transition-all flex items-center space-x-1"
                        >
                          <span>Solve</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {filteredProblems.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-200/80 p-12 text-center">
                <Code2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-700">No problems found</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                  Try adjusting your search query, difficulty, or topic filters.
                </p>
              </div>
            )}

            {/* ══════════════ PAGINATION FOOTER ══════════════ */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-1">
              <div className="text-sm text-gray-500 font-medium">
                Showing {currentStart}–{currentEnd} of {TOTAL_PROBLEMS_COUNT} problems
              </div>

              <div className="flex items-center space-x-1.5">
                {/* Prev */}
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Pages 1..5 */}
                {[1, 2, 3, 4, 5].map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                      currentPage === pageNum
                        ? 'bg-home-accent text-white shadow-xs'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                {/* Ellipsis */}
                <span className="w-8 h-8 flex items-center justify-center text-gray-400 text-xs font-bold">
                  ...
                </span>

                {/* Last Page */}
                <button
                  onClick={() => setCurrentPage(54)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                    currentPage === 54
                      ? 'bg-home-accent text-white shadow-xs'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  54
                </button>

                {/* Next */}
                <button
                  onClick={() => setCurrentPage(Math.min(54, currentPage + 1))}
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-all"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}

/* ── Difficulty Pill Badge ── */
function DifficultyBadge({ difficulty }) {
  const d = (difficulty || 'Medium').toLowerCase();
  if (d === 'easy') {
    return (
      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/50 text-xs font-semibold inline-block">
        Easy
      </span>
    );
  }
  if (d === 'hard') {
    return (
      <span className="px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200/50 text-xs font-semibold inline-block">
        Hard
      </span>
    );
  }
  return (
    <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/50 text-xs font-semibold inline-block">
      Medium
    </span>
  );
}
