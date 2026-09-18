import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, LayoutDashboard, FileText, Bookmark, Trophy, BarChart2, Award, Settings,
  MapPin, Github, Link2, Edit3, Code2, Flame, TrendingUp, Calendar, CheckCircle2,
  Circle, ChevronRight, ExternalLink, Sparkles, Star, Zap, Check, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { HomeNavbar } from '../components/layout/HomeNavbar';

export function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Sidebar navigation state
  const [activeSidebar, setActiveSidebar] = useState('profile');

  // Edit profile modal state
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || 'Saurabh Kumar',
    username: user?.username || 'saurabhdev',
    bio: 'Code. Learn. Improve. Repeat. 🚀\nFinal year CSE | Competitive Programmer | Building cool things',
    location: 'New Delhi, India',
    github: 'github.com/saurabhkumar',
    website: 'saurabh.dev',
    tags: ['Problem Solver', 'Aspiring SDE', 'Open to Opportunities']
  });

  // Heatmap generation matching the design
  const heatmapData = generateHeatmap();

  return (
    <div className="home-page min-h-screen bg-home-bg text-home-text font-sans flex flex-col selection:bg-orange-100 selection:text-home-accent">
      {/* Top Light Navbar */}
      <HomeNavbar />

      {/* Main Container */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* ══════════════ LEFT SIDEBAR ══════════════ */}
          <aside className="w-full lg:w-60 xl:w-64 shrink-0">
            {/* Sidebar Navigation Items */}
            <nav className="space-y-1">
              {[
                { id: 'profile', label: 'Profile', icon: User, active: true },
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'submissions', label: 'My Submissions', icon: FileText, href: '/submissions' },
                { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
                { id: 'contests', label: 'My Contests', icon: Trophy },
                { id: 'stats', label: 'Stats & Analytics', icon: BarChart2 },
                { id: 'achievements', label: 'Achievements', icon: Award },
                { id: 'settings', label: 'Settings', icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeSidebar === item.id;
                if (item.href) {
                  return (
                    <Link
                      key={item.id}
                      to={item.href}
                      className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-home-text-secondary hover:text-home-text hover:bg-orange-50/50"
                    >
                      <Icon className="w-4 h-4 text-gray-400" />
                      <span>{item.label}</span>
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSidebar(item.id)}
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

            {/* Consistency / Discipline Motivational Card */}
            <div className="mt-8 bg-gradient-to-b from-[#FFF5ED] via-[#FFF0E6] to-[#FDDCBF]/35 rounded-2xl p-5 border border-orange-100 shadow-xs relative overflow-hidden">
              <p className="text-sm text-gray-700 italic font-serif leading-relaxed">
                “Discipline today,<br />
                better developers<br />
                tomorrow.”
              </p>
              <svg className="w-24 h-2 text-home-accent mt-2 stroke-current" viewBox="0 0 100 8" fill="none">
                <path d="M5 4 Q 50 1, 95 5" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>

            {/* Keep Solving / Keep Growing Tag */}
            <div className="mt-12 px-3">
              <p className="text-sm font-extrabold text-[#1A1A2E] leading-snug">
                Keep Solving<br />
                Keep Growing 🚀
              </p>
            </div>
          </aside>

          {/* ══════════════ MAIN PROFILE CONTENT ══════════════ */}
          <main className="flex-1 w-full min-w-0 space-y-6">

            {/* ── CARD 1: USER PROFILE HEADER CARD ── */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-6 sm:p-8 relative shadow-xs overflow-hidden">
              {/* Soft decorative background shape */}
              <div className="absolute top-0 right-0 w-80 h-64 bg-gradient-to-bl from-orange-100/35 via-amber-50/25 to-transparent rounded-bl-full pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-6">
                {/* Left Column: Avatar & Edit Profile */}
                <div className="flex flex-col items-center sm:items-start shrink-0">
                  <div className="relative">
                    <img
                      src="/images/avatar.png"
                      alt={profileData.name}
                      className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-md bg-gray-100"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250&auto=format&fit=crop&q=80';
                      }}
                    />
                    {/* Active Online Indicator */}
                    <span className="absolute bottom-1 right-2 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full shadow-xs"></span>
                  </div>

                  <button
                    onClick={() => setIsEditing(true)}
                    className="mt-3.5 w-full flex items-center justify-center space-x-1.5 px-4 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-xs active:scale-95"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-gray-500" />
                    <span>Edit Profile</span>
                  </button>
                </div>

                {/* Middle Column: Details, Bio, Links & Tags */}
                <div className="flex-1 space-y-3">
                  <div>
                    <h1 className="text-3xl font-black text-[#1A1A2E] tracking-tight">
                      {profileData.name}
                    </h1>
                    <p className="text-sm font-medium text-gray-500 mt-0.5">
                      @{profileData.username}
                    </p>
                  </div>

                  {/* Bio */}
                  <div className="text-sm text-[#24292E] leading-relaxed whitespace-pre-line">
                    {profileData.bio}
                  </div>

                  {/* Links & Location */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-gray-600 pt-1">
                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span>{profileData.location}</span>
                    </div>

                    <a
                      href={`https://${profileData.github}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center space-x-1.5 text-home-accent hover:underline"
                    >
                      <Github className="w-3.5 h-3.5 text-gray-700" />
                      <span>{profileData.github}</span>
                    </a>

                    <a
                      href={`https://${profileData.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center space-x-1.5 text-home-accent hover:underline"
                    >
                      <Link2 className="w-3.5 h-3.5 text-gray-700" />
                      <span>{profileData.website}</span>
                    </a>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {profileData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-orange-50/70 border border-orange-200/60 rounded-xl text-xs font-semibold text-gray-700 shadow-2xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right Column: Motivational Stamp & Followers Stats */}
                <div className="flex md:flex-col justify-between items-end shrink-0 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-gray-100">
                  {/* Good Code Brighter Futures Stamp */}
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-gray-800 font-serif leading-tight">
                      Good<br />
                      Code<br />
                      Brighter<br />
                      Futures
                    </p>
                    <div className="w-12 h-1 bg-home-accent rounded-full ml-auto mt-1 rotate-[-2deg]"></div>
                  </div>

                  {/* Follower stats */}
                  <div className="flex items-center space-x-6 mt-auto">
                    <div className="text-center">
                      <div className="text-xl font-extrabold text-[#1A1A2E]">124</div>
                      <div className="text-xs text-gray-500 font-medium">Followers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-extrabold text-[#1A1A2E]">86</div>
                      <div className="text-xs text-gray-500 font-medium">Following</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── CARD 2: 4 TOP METRIC CARDS ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Problems Solved */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs flex items-center space-x-3.5 hover:border-emerald-200 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold text-lg font-mono shrink-0">
                  &lt;/&gt;
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-[#1A1A2E]">780</div>
                  <div className="text-xs text-gray-500 font-medium">Problems Solved</div>
                </div>
              </div>

              {/* Global Rank */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs flex items-center space-x-3.5 hover:border-orange-200 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-orange-50 text-home-accent border border-orange-100 flex items-center justify-center shrink-0">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-extrabold text-[#1A1A2E]">1,234</span>
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md inline-flex items-center">
                      ↑ 12%
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 font-medium">Global Rank</div>
                </div>
              </div>

              {/* Contests Participated */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs flex items-center space-x-3.5 hover:border-rose-200 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 border border-rose-100 flex items-center justify-center shrink-0">
                  <BarChart2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-[#1A1A2E]">156</div>
                  <div className="text-xs text-gray-500 font-medium">Contests Participated</div>
                </div>
              </div>

              {/* Day Streak */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs flex items-center space-x-3.5 hover:border-amber-200 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 border border-amber-100 flex items-center justify-center shrink-0">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-[#1A1A2E]">365</div>
                  <div className="text-xs text-gray-500 font-medium">Day Streak</div>
                </div>
              </div>
            </div>

            {/* ── ROW 3: SOLVING ACTIVITY & SKILLS / LANGUAGES ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Solving Activity (Heatmap) */}
              <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                    <h2 className="text-base font-bold text-[#1A1A2E]">Solving Activity</h2>
                    <span className="text-xs font-semibold text-gray-500">Total 780 problems</span>
                  </div>

                  {/* Heatmap Grid */}
                  <div className="overflow-x-auto pb-2">
                    {/* Months header */}
                    <div className="flex text-[11px] font-medium text-gray-400 pl-8 mb-2 space-x-9 min-w-[500px]">
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].map((m) => (
                        <span key={m}>{m}</span>
                      ))}
                    </div>

                    <div className="flex items-start min-w-[500px]">
                      {/* Weekday labels */}
                      <div className="flex flex-col justify-between text-[10px] font-medium text-gray-400 pr-2 h-[88px] pt-1">
                        <span>Mon</span>
                        <span>Wed</span>
                        <span>Fri</span>
                      </div>

                      {/* 52-week activity grid */}
                      <div className="grid grid-flow-col grid-rows-7 gap-1.5 flex-1">
                        {heatmapData.map((cell, idx) => (
                          <div
                            key={idx}
                            className={`w-3 h-3 rounded-xs transition-colors cursor-pointer ${cell.bg}`}
                            title={`${cell.count} submissions on ${cell.date}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Heatmap Legend */}
                <div className="flex items-center justify-end space-x-1.5 pt-4 text-[11px] text-gray-400 font-medium border-t border-gray-50 mt-4">
                  <span>Less</span>
                  <div className="w-2.5 h-2.5 rounded-xs bg-[#F3F4F6]"></div>
                  <div className="w-2.5 h-2.5 rounded-xs bg-[#FED7AA]"></div>
                  <div className="w-2.5 h-2.5 rounded-xs bg-[#FB923C]"></div>
                  <div className="w-2.5 h-2.5 rounded-xs bg-[#F26522]"></div>
                  <span>More</span>
                </div>
              </div>

              {/* Skills / Languages Card */}
              <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
                    <h2 className="text-base font-bold text-[#1A1A2E]">Skills / Languages</h2>
                    <button className="text-xs font-semibold text-gray-500 hover:text-home-accent transition-colors">
                      View All
                    </button>
                  </div>

                  {/* Language Progress Bars */}
                  <div className="space-y-4">
                    {/* C++ */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 font-mono font-bold text-[10px] flex items-center justify-center">
                            C++
                          </span>
                          <span className="text-gray-800">C++</span>
                        </div>
                        <span className="text-gray-500 font-medium">450+ solved</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-home-accent rounded-full" style={{ width: '85%' }}></div>
                      </div>
                    </div>

                    {/* Python */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-md bg-yellow-50 text-amber-600 font-mono font-bold text-[10px] flex items-center justify-center">
                            Py
                          </span>
                          <span className="text-gray-800">Python</span>
                        </div>
                        <span className="text-gray-500 font-medium">180+ solved</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: '60%' }}></div>
                      </div>
                    </div>

                    {/* JavaScript */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-md bg-rose-50 text-rose-500 font-mono font-bold text-[10px] flex items-center justify-center">
                            JS
                          </span>
                          <span className="text-gray-800">JavaScript</span>
                        </div>
                        <span className="text-gray-500 font-medium">120+ solved</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-rose-400 rounded-full" style={{ width: '45%' }}></div>
                      </div>
                    </div>

                    {/* Java */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-600 font-mono font-bold text-[10px] flex items-center justify-center">
                            ☕
                          </span>
                          <span className="text-gray-800">Java</span>
                        </div>
                        <span className="text-gray-500 font-medium">80+ solved</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-indigo-400 rounded-full" style={{ width: '30%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── ROW 4: RECENT SUBMISSIONS & ACHIEVEMENTS ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Recent Submissions */}
              <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-2">
                    <h2 className="text-base font-bold text-[#1A1A2E]">Recent Submissions</h2>
                    <Link
                      to="/submissions"
                      className="text-xs font-semibold text-home-accent hover:underline inline-flex items-center space-x-1"
                    >
                      <span>View All</span>
                      <span>→</span>
                    </Link>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-400 font-semibold">
                          <th className="py-2.5 px-2 w-8">#</th>
                          <th className="py-2.5 px-3">Problem</th>
                          <th className="py-2.5 px-3">Language</th>
                          <th className="py-2.5 px-3">Result</th>
                          <th className="py-2.5 px-3 text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {[
                          { id: 1, title: 'Two Sum', lang: 'C++', result: 'Accepted', time: '12 ms', isOk: true },
                          { id: 2, title: 'Valid Parentheses', lang: 'Python', result: 'Accepted', time: '24 ms', isOk: true },
                          { id: 3, title: 'Merge K Sorted Lists', lang: 'C++', result: 'Wrong Answer', time: '0 ms', isOk: false },
                          { id: 4, title: 'Longest Substring...', lang: 'JavaScript', result: 'Accepted', time: '36 ms', isOk: true },
                          { id: 5, title: 'Climbing Stairs', lang: 'Python', result: 'Accepted', time: '20 ms', isOk: true },
                        ].map((row) => (
                          <tr key={row.id} className="hover:bg-orange-50/30 transition-colors">
                            <td className="py-2.5 px-2 text-gray-400 font-mono">{row.id}</td>
                            <td className="py-2.5 px-3 font-semibold text-gray-800 hover:text-home-accent transition-colors cursor-pointer">
                              {row.title}
                            </td>
                            <td className="py-2.5 px-3 text-gray-600 font-medium">
                              <span className="inline-flex items-center space-x-1">
                                <span>{row.lang}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                                  row.isOk
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                                    : 'bg-rose-50 text-rose-600 border border-rose-200/60'
                                }`}
                              >
                                {row.result}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-gray-500 font-mono">
                              {row.time}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Achievements Card */}
              <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                    <h2 className="text-base font-bold text-[#1A1A2E]">Achievements</h2>
                    <button className="text-xs font-semibold text-gray-500 hover:text-home-accent transition-colors">
                      View All
                    </button>
                  </div>

                  {/* 3x2 Badges Grid */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { icon: Code2, title: 'Problem Solver', subtitle: '100 problems', bg: 'bg-orange-50', color: 'text-home-accent' },
                      { icon: Trophy, title: 'Contest Participant', subtitle: '10 contests', bg: 'bg-amber-50', color: 'text-amber-500' },
                      { icon: Flame, title: 'Streak Master', subtitle: '100 days', bg: 'bg-rose-50', color: 'text-rose-500' },
                      { icon: Star, title: 'Explorer', subtitle: 'Solve in 5 languages', bg: 'bg-yellow-50', color: 'text-yellow-500' },
                      { icon: BarChart2, title: 'Top 5%', subtitle: 'Global Rank', bg: 'bg-red-50', color: 'text-red-500' },
                      { icon: Calendar, title: 'Consistent', subtitle: 'Solve 50 problems in a month', bg: 'bg-purple-50', color: 'text-purple-500' },
                    ].map((badge, idx) => {
                      const Icon = badge.icon;
                      return (
                        <div
                          key={idx}
                          className="flex flex-col items-center p-2 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                          <div className={`w-11 h-11 rounded-2xl ${badge.bg} flex items-center justify-center mb-1.5 shadow-2xs`}>
                            <Icon className={`w-5 h-5 ${badge.color}`} />
                          </div>
                          <span className="text-[11px] font-bold text-gray-800 leading-tight">
                            {badge.title}
                          </span>
                          <span className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                            {badge.subtitle}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── ROW 5: YOUR GOALS & BETTER CODER BANNER ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Your Goals */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200/80 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                    <h2 className="text-base font-bold text-[#1A1A2E]">Your Goals</h2>
                    <button className="text-xs font-semibold px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      Edit
                    </button>
                  </div>

                  <div className="space-y-4 text-xs font-medium">
                    {/* Goal 1 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="text-gray-800 font-semibold">Solve 1000 problems</span>
                        </div>
                        <span className="text-gray-500 font-mono">780 / 1000</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden pl-6">
                        <div className="h-full bg-home-accent rounded-full" style={{ width: '78%' }}></div>
                      </div>
                    </div>

                    {/* Goal 2 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Circle className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="text-gray-800 font-semibold">Participate in 5 more contests</span>
                        </div>
                        <span className="text-gray-500 font-mono">1 / 5</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden pl-6">
                        <div className="h-full bg-home-accent rounded-full" style={{ width: '20%' }}></div>
                      </div>
                    </div>

                    {/* Goal 3 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Circle className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="text-gray-800 font-semibold">Improve global rank to top 500</span>
                        </div>
                        <span className="text-gray-500 font-mono">1234 / 500</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden pl-6">
                        <div className="h-full bg-home-accent rounded-full" style={{ width: '40%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Motivational Banner ("Same You. But a Better Coder.") */}
              <div className="lg:col-span-7 rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden relative min-h-[160px] bg-[#FDF7F2] flex items-stretch">
                <img
                  src="/images/better-coder-banner.png"
                  alt="Same You. But a Better Coder."
                  className="w-full h-full object-fill"
                  onError={(e) => {
                    // Fallback visual
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            </div>

          </main>
        </div>
      </div>

      {/* ══════════════ EDIT PROFILE MODAL ══════════════ */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900">Edit Profile</h3>
              <button onClick={() => setIsEditing(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-home-accent/30"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Bio / Tagline</label>
                <textarea
                  rows={2}
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-home-accent/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Location</label>
                  <input
                    type="text"
                    value={profileData.location}
                    onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-home-accent/30"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Website</label>
                  <input
                    type="text"
                    value={profileData.website}
                    onChange={(e) => setProfileData({ ...profileData, website: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-home-accent/30"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-home-accent hover:bg-home-accent-hover text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Generates activity grid matching the screenshot layout and color levels
function generateHeatmap() {
  const cells = [];
  const activePatterns = [
    // Column index with day indices: [day, count]
    [2, 1, 3], [3, 3, 2], [6, 0, 4], [7, 2, 2], [8, 4, 3],
    [11, 1, 4], [12, 5, 2], [14, 2, 3], [15, 0, 4],
    [17, 3, 2], [19, 1, 4], [20, 4, 3], [22, 2, 4],
    [24, 0, 3], [25, 3, 2], [27, 5, 4], [29, 2, 3],
    [31, 1, 4], [33, 4, 3], [35, 2, 2], [37, 0, 4],
    [39, 3, 3], [41, 1, 4], [43, 5, 2], [45, 2, 3],
    [47, 0, 4], [48, 3, 3], [50, 1, 4], [51, 4, 3]
  ];

  const activeMap = new Map();
  activePatterns.forEach(([col, row, level]) => {
    activeMap.set(`${col}-${row}`, level);
  });

  for (let c = 0; c < 36; c++) {
    for (let r = 0; r < 7; r++) {
      const level = activeMap.get(`${c}-${r}`) || 0;
      let bg = 'bg-[#F3F4F6]'; // default empty
      let count = 0;

      if (level === 2) {
        bg = 'bg-[#FED7AA]'; // light orange
        count = 2;
      } else if (level === 3) {
        bg = 'bg-[#FB923C]'; // medium orange
        count = 4;
      } else if (level === 4) {
        bg = 'bg-[#F26522]'; // strong orange
        count = 7;
      }

      cells.push({
        col: c,
        row: r,
        bg,
        count,
        date: `2026-${String((c % 9) + 1).padStart(2, '0')}-${String((r * 4) + 2).padStart(2, '0')}`
      });
    }
  }

  return cells;
}
