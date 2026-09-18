import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Target, Shield, BarChart3, Code2,
  Users, FileCode, Send, Heart, Bookmark, Sparkles
} from 'lucide-react';
import { HomeNavbar } from '../components/layout/HomeNavbar';
import { CodeEditorMockup } from '../components/home/CodeEditorMockup';
import { FloatingElements } from '../components/home/FloatingElements';
import { ScrollReveal } from '../components/home/ScrollReveal';
import { problemService } from '../services/api/problem.service';

export function Home() {
  const navigate = useNavigate();
  const [featuredProblems, setFeaturedProblems] = useState([]);
  const [problemsLoaded, setProbLemsLoaded] = useState(false);

  useEffect(() => {
    async function loadFeatured() {
      try {
        const data = await problemService.getProblems({});
        setFeaturedProblems(data.slice(0, 4));
      } catch {
        // Use fallback static data if API is unavailable
        setFeaturedProblems(FALLBACK_PROBLEMS);
      } finally {
        setProbLemsLoaded(true);
      }
    }
    loadFeatured();
  }, []);

  const displayProblems = featuredProblems.length > 0 ? featuredProblems : FALLBACK_PROBLEMS;

  return (
    <div className="home-page min-h-screen bg-home-bg text-home-text font-sans">
      <HomeNavbar />

      {/* ═══════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════ */}
      <section className="relative overflow-hidden pt-8 pb-16 lg:pt-12 lg:pb-24">
        {/* Background decorative blobs */}
        <div className="home-blob home-blob-peach w-[400px] h-[400px] -top-20 -right-20" />
        <div className="home-blob home-blob-orange w-[300px] h-[300px] top-40 -left-20 opacity-[0.08]" />
        <div className="home-blob home-blob-peach w-[200px] h-[200px] bottom-10 right-1/4 opacity-[0.1]" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Pill banner */}
          <div className="flex items-center mb-8 opacity-0 animate-fade-in home-stagger-1">
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-home-accent-light border border-home-accent-soft rounded-full">
              <Sparkles className="w-4 h-4 text-home-accent" />
              <span className="text-sm font-medium text-home-accent">
                Practice · Solve · Compete · Grow
              </span>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Left: Hero text */}
            <div className="max-w-xl">
              <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold leading-[1.1] tracking-tight mb-6">
                <span className="block opacity-0 animate-fade-in-up home-stagger-2">Code Today.</span>
                <span className="block opacity-0 animate-fade-in-up home-stagger-3">Build a Better</span>
                <span className="block text-home-accent opacity-0 animate-fade-in-up home-stagger-4">Tomorrow.</span>
              </h1>

              <p className="text-lg text-home-text-secondary leading-relaxed mb-8 opacity-0 animate-fade-in-up home-stagger-5 max-w-md">
                CodeArena is an online judge platform to help you practice
                coding problems, improve your problem-solving skills, and
                become a better developer.
              </p>

              {/* CTA buttons */}
              <div className="flex flex-wrap items-center gap-4 mb-10 opacity-0 animate-fade-in-up home-stagger-6">
                <Link
                  to="/problems"
                  className="inline-flex items-center px-7 py-3.5 text-base font-semibold text-white bg-home-accent hover:bg-home-accent-hover rounded-xl shadow-lg shadow-orange-200/50 transition-all hover:shadow-xl hover:shadow-orange-200/60 active:scale-[0.98] group"
                >
                  Start Solving
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/problems"
                  className="inline-flex items-center px-7 py-3.5 text-base font-semibold text-home-text bg-white border-2 border-gray-200 hover:border-home-accent/30 rounded-xl transition-all hover:shadow-md active:scale-[0.98]"
                >
                  Explore Problems
                </Link>
              </div>

              {/* Feature highlights */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-8 opacity-0 animate-fade-in-up home-stagger-7">
                {HERO_FEATURES.map((f) => (
                  <div key={f.label} className="flex items-center space-x-2 text-sm text-home-text-secondary">
                    <span className="text-home-accent">✦</span>
                    <span>{f.label}</span>
                  </div>
                ))}
              </div>

              {/* Quote */}
              <div className="opacity-0 animate-fade-in-up home-stagger-8">
                <p className="text-sm italic text-home-text-muted border-l-2 border-home-accent/30 pl-4">
                  "Discipline today,<br />
                  better developers tomorrow."
                </p>
              </div>
            </div>

            {/* Right: Code editor mockup + floating elements */}
            <div className="relative opacity-0 animate-slide-in-right home-stagger-3">
              <FloatingElements />
              <div className="relative z-10">
                <CodeEditorMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          PLATFORM STATISTICS
          ═══════════════════════════════════════ */}
      <section className="py-12 lg:py-16 bg-white border-y border-home-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {STATS.map((stat, i) => (
                <div
                  key={stat.label}
                  className="stat-card-home flex items-center p-5 bg-home-stat-bg rounded-2xl border border-home-border"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 mr-4 ${stat.iconBg}`}>
                    <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-home-text tracking-tight">
                      {stat.value}
                    </div>
                    <div className="text-sm text-home-text-secondary">
                      {stat.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          WHY CODEARENA SECTION
          ═══════════════════════════════════════ */}
      <section className="py-16 lg:py-24 bg-home-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-home-accent mb-3">
              Why CodeArena?
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-home-text tracking-tight mb-4">
              Everything You Need to{' '}
              <span className="text-home-accent">Grow</span>
            </h2>
            <p className="text-base text-home-text-secondary max-w-lg mx-auto">
              A complete platform for your competitive programming journey.
            </p>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature, i) => (
              <ScrollReveal key={feature.title} delay={i * 100}>
                <div className="feature-card-home bg-white rounded-2xl p-6 border border-home-border h-full flex flex-col">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${feature.iconBg}`}>
                    <feature.icon className={`w-6 h-6 ${feature.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-bold text-home-text mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-home-text-secondary leading-relaxed flex-1">
                    {feature.description}
                  </p>
                  <div className="mt-4">
                    <span className="inline-flex items-center text-home-accent text-sm font-medium group cursor-pointer">
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FEATURED PROBLEMS
          ═══════════════════════════════════════ */}
      <section className="py-16 lg:py-24 bg-white border-t border-home-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-home-text-muted mb-2">
                  Featured Problems
                </p>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-home-text tracking-tight">
                  Start with{' '}
                  <span className="text-home-accent">These</span>
                </h2>
              </div>
              <Link
                to="/problems"
                className="hidden sm:inline-flex items-center px-5 py-2.5 text-sm font-medium text-home-text border border-gray-200 rounded-xl hover:border-home-accent/30 hover:text-home-accent transition-all group"
              >
                View All Problems
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayProblems.map((problem, i) => (
              <ScrollReveal key={problem._id || problem.id || i} delay={i * 100}>
                <div
                  className="problem-card-home bg-white rounded-2xl border border-home-border p-5 cursor-pointer flex flex-col h-full"
                  onClick={() => {
                    const pid = problem._id || problem.id;
                    if (pid && !pid.startsWith('fallback')) navigate(`/problems/${pid}`);
                    else navigate('/problems');
                  }}
                >
                  {/* Difficulty badge */}
                  <div className="mb-3">
                    <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${getDifficultyClasses(problem.difficulty)}`}>
                      {problem.difficulty}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-home-text mb-2 line-clamp-2">
                    {problem.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-home-text-secondary leading-relaxed mb-4 line-clamp-2 flex-1">
                    {problem.description
                      ? truncateDesc(problem.description)
                      : 'Solve this problem to improve your skills.'
                    }
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(problem.tags || []).slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 text-[11px] font-medium bg-gray-100 text-home-text-secondary rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Bottom row */}
                  <div className="flex items-center justify-between pt-3 border-t border-home-border">
                    <div className="flex items-center space-x-1.5 text-xs text-home-text-muted">
                      <Heart className="w-3.5 h-3.5 text-home-accent" />
                      <span>{formatSolvedCount(i)} solved</span>
                    </div>
                    <Bookmark className="w-4 h-4 text-gray-300 hover:text-home-accent transition-colors" />
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* Mobile "View all" link */}
          <div className="sm:hidden mt-8 text-center">
            <Link
              to="/problems"
              className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-home-text border border-gray-200 rounded-xl hover:border-home-accent/30 hover:text-home-accent transition-all group"
            >
              View All Problems
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FINAL CTA SECTION
          ═══════════════════════════════════════ */}
      <section className="cta-section-bg py-16 lg:py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-home-accent mb-3">
                  Join a Thriving Community
                </p>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-home-text tracking-tight mb-4 leading-[1.15]">
                  Solve. Learn. Compete.{' '}
                  <span className="text-home-accent">Together.</span>
                </h2>
                <p className="text-base text-home-text-secondary mb-8 max-w-md">
                  Be part of thousands of developers building a better tomorrow.
                </p>

                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    to="/login"
                    className="inline-flex items-center px-7 py-3.5 text-base font-semibold text-white bg-home-accent hover:bg-home-accent-hover rounded-xl shadow-lg shadow-orange-300/30 transition-all hover:shadow-xl active:scale-[0.98] group"
                  >
                    Create Your Account
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    to="/problems"
                    className="inline-flex items-center px-7 py-3.5 text-base font-semibold text-home-text bg-white border-2 border-gray-200 hover:border-home-accent/30 rounded-xl transition-all hover:shadow-md active:scale-[0.98]"
                  >
                    Explore Community
                  </Link>
                </div>
              </div>

              {/* Decorative illustration area */}
              <div className="hidden lg:flex justify-center items-center">
                <div className="relative">
                  <div className="bg-white/60 rounded-3xl p-8 border border-home-accent-soft/30 shadow-sm">
                    <div className="text-center">
                      <p className="text-4xl mb-4">👨‍💻</p>
                      <div className="space-y-2 text-sm italic text-home-text-secondary">
                        <p><span className="text-home-accent font-medium">Good</span></p>
                        <p>Developers</p>
                        <p><span className="text-home-accent font-medium">Lift</span></p>
                        <p>Each Other Up</p>
                      </div>
                    </div>
                  </div>

                  {/* Small floating decorative elements */}
                  <div className="absolute -top-4 -right-4 w-16 h-16 bg-home-accent/10 rounded-2xl animate-float flex items-center justify-center">
                    <Code2 className="w-6 h-6 text-home-accent" />
                  </div>
                  <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-emerald-100 rounded-xl animate-float-reverse flex items-center justify-center">
                    <Heart className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════ */}
      <footer className="bg-home-bg border-t border-home-border py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-md bg-home-accent flex items-center justify-center text-white font-mono font-bold text-xs">
                &lt;/&gt;
              </div>
              <span className="text-sm font-bold text-home-text">
                Code<span className="text-home-accent">Arena</span>
              </span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-home-text-muted">
              <Link to="/problems" className="hover:text-home-accent transition-colors">Problems</Link>
              <a href="#" className="hover:text-home-accent transition-colors">Contests</a>
              <a href="#" className="hover:text-home-accent transition-colors">Community</a>
            </div>
            <p className="text-xs text-home-text-muted">
              © 2026 CodeArena. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Static Data ── */

const HERO_FEATURES = [
  { label: 'Real coding problems' },
  { label: 'Multiple languages' },
  { label: 'Secure execution' },
  { label: 'Track your progress' },
];

const STATS = [
  {
    icon: Users,
    value: '10,000+',
    label: 'Developers',
    iconBg: 'bg-orange-50',
    iconColor: 'text-home-accent',
  },
  {
    icon: FileCode,
    value: '500+',
    label: 'Coding Problems',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
  },
  {
    icon: Send,
    value: '50,000+',
    label: 'Submissions',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-500',
  },
  {
    icon: Heart,
    value: '95%',
    label: 'Would Solve Again',
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-500',
  },
];

const FEATURES = [
  {
    icon: Target,
    title: 'Curated Problems',
    description: 'Handpicked problems from fundamentals to advanced topics.',
    iconBg: 'bg-orange-50',
    iconColor: 'text-home-accent',
  },
  {
    icon: Shield,
    title: 'Secure Code Execution',
    description: 'Run your code in a safe, isolated environment with real-time feedback.',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
  },
  {
    icon: BarChart3,
    title: 'Track Your Progress',
    description: 'Detailed analytics to help you improve consistently.',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
  },
  {
    icon: Code2,
    title: 'Multiple Languages',
    description: 'Solve problems using C++, Python, JavaScript and more.',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-500',
  },
];

const FALLBACK_PROBLEMS = [
  {
    _id: 'fallback-1',
    title: 'Two Sum',
    difficulty: 'EASY',
    description: 'Find two numbers that add up to a target.',
    tags: ['Array', 'Hash Map'],
  },
  {
    _id: 'fallback-2',
    title: 'Valid Parentheses',
    difficulty: 'EASY',
    description: 'Check if the input string has valid parentheses.',
    tags: ['Stack', 'String'],
  },
  {
    _id: 'fallback-3',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'MEDIUM',
    description: 'Find the length of the longest substring without repeating characters.',
    tags: ['String', 'Hash Map', 'Two Pointers'],
  },
  {
    _id: 'fallback-4',
    title: 'Merge K Sorted Lists',
    difficulty: 'HARD',
    description: 'Merge k sorted linked lists and return it as one sorted list.',
    tags: ['Linked List', 'Divide & Conquer'],
  },
];

/* ── Helpers ── */

function getDifficultyClasses(difficulty) {
  switch (difficulty) {
    case 'EASY':
      return 'bg-emerald-50 text-emerald-600 border border-emerald-200/60';
    case 'MEDIUM':
      return 'bg-amber-50 text-amber-600 border border-amber-200/60';
    case 'HARD':
      return 'bg-rose-50 text-rose-600 border border-rose-200/60';
    default:
      return 'bg-gray-50 text-gray-600 border border-gray-200/60';
  }
}

function truncateDesc(desc) {
  // Strip markdown/HTML and truncate
  const clean = desc.replace(/[#*_`\[\]()]/g, '').replace(/<[^>]+>/g, '');
  return clean.length > 80 ? clean.slice(0, 80) + '...' : clean;
}

function formatSolvedCount(index) {
  const counts = ['12.4K', '10.1K', '8.7K', '6.2K'];
  return counts[index] || '5.0K';
}
