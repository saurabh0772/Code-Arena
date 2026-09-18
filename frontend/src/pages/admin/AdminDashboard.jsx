import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Calendar,
  ChevronDown,
  TrendingUp,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Crown,
  Sparkles,
  Rocket
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { problemService } from '../../services/api/problem.service';
import HomeNavbar from '../../components/layout/HomeNavbar';

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [activityTimeframe, setActivityTimeframe] = useState('Last 30 Days');
  const [roleTimeframe, setRoleTimeframe] = useState('All Time');

  const [realProblemCount, setRealProblemCount] = useState(null);

  useEffect(() => {
    async function loadProblems() {
      try {
        const problems = await problemService.getProblems();
        if (Array.isArray(problems) && problems.length > 0) {
          setRealProblemCount(problems.length);
        }
      } catch (err) {
        // Fallback to mock design data
      }
    }
    loadProblems();
  }, []);

  // 4 Top Metric Cards
  const metrics = [
    {
      label: 'Total Users',
      value: '12,482',
      trend: '↑ 12%',
      subtext: '+1,324 this month',
      icon: Users,
      bgColor: 'bg-[#FFF0E6]',
      textColor: 'text-home-accent'
    },
    {
      label: 'Total Problems',
      value: '532',
      trend: '↑ 8%',
      subtext: '+40 this month',
      icon: FileCode,
      bgColor: 'bg-[#FFF4EB]',
      textColor: 'text-orange-500'
    },
    {
      label: 'Total Submissions',
      value: '1.2M',
      trend: '↑ 18%',
      subtext: '+182K this month',
      icon: FileText,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-500'
    },
    {
      label: 'Total Contests',
      value: '86',
      trend: '↑ 25%',
      subtext: '+17 this month',
      icon: Trophy,
      bgColor: 'bg-[#FFF7E8]',
      textColor: 'text-amber-500'
    }
  ];

  // Recent Submissions data
  const recentSubmissions = [
    {
      id: 1,
      username: 'rahulcodes',
      avatar: '/images/avatars/rahulcodes.png',
      problem: 'Two Sum',
      language: 'C++',
      result: 'Accepted',
      time: '12 ms'
    },
    {
      id: 2,
      username: 'priya_dev',
      avatar: '/images/avatars/priya_dev.png',
      problem: 'Merge Sort',
      language: 'Python',
      result: 'Accepted',
      time: '36 ms'
    },
    {
      id: 3,
      username: 'code_ninja',
      avatar: '/images/avatars/code_ninja.png',
      problem: 'Dijkstra',
      language: 'Java',
      result: 'Wrong Answer',
      time: '0 ms'
    },
    {
      id: 4,
      username: 'developer_01',
      avatar: '/images/avatars/developer_01.png',
      problem: 'Valid Parentheses',
      language: 'C++',
      result: 'Accepted',
      time: '8 ms'
    },
    {
      id: 5,
      username: 'ankit.exe',
      avatar: '/images/avatars/ankit.png',
      problem: 'Graph Coloring',
      language: 'Python',
      result: 'TLE',
      time: '2.1 s'
    }
  ];

  // Recent Users data
  const recentUsers = [
    {
      id: 1,
      name: 'Saurabh Kumar',
      username: 'saurabhdev',
      avatar: '/images/avatars/saurabh.png',
      joined: '16 Sep 2026',
      role: 'Admin'
    },
    {
      id: 2,
      name: 'Priya Sharma',
      username: 'priya_21',
      avatar: '/images/avatars/priya_sharma.png',
      joined: '15 Sep 2026',
      role: 'User'
    },
    {
      id: 3,
      name: 'Rohan Mehta',
      username: 'rohan_codes',
      avatar: '/images/avatars/rohan_mehta.png',
      joined: '15 Sep 2026',
      role: 'User'
    },
    {
      id: 4,
      name: 'Ananya Verma',
      username: 'ananya_v',
      avatar: '/images/avatars/ananya_verma.png',
      joined: '14 Sep 2026',
      role: 'User'
    },
    {
      id: 5,
      name: 'Karan Singh',
      username: 'karan_cs',
      avatar: '/images/avatars/karan_singh.png',
      joined: '14 Sep 2026',
      role: 'Moderator'
    }
  ];

  // System Health nodes
  const healthNodes = [
    { name: 'Judges', status: '4 / 4 Online', state: 'healthy' },
    { name: 'Database', status: 'Healthy', state: 'healthy' },
    { name: 'Queue', status: 'Processing', state: 'healthy' },
    { name: 'Storage', status: '72% Used', state: 'healthy' }
  ];

  // Announcements
  const announcements = [
    {
      id: 1,
      icon: Rocket,
      text: 'Scheduled maintenance on 20 Sep 2026 (2:00 AM – 4:00 AM IST)',
      date: '15 Sep'
    },
    {
      id: 2,
      icon: Trophy,
      text: 'September Long Contest is live!',
      date: '12 Sep'
    },
    {
      id: 3,
      icon: Sparkles,
      text: 'New problem set on Graph Algorithms added.',
      date: '10 Sep'
    }
  ];

  // Role Breakdown
  const roleBreakdown = [
    { role: 'Regular Users', count: '11,206', pct: '89.8%', color: '#FF6F59' },
    { role: 'Admins', count: '42', pct: '0.3%', color: '#3B82F6' },
    { role: 'Moderators', count: '86', pct: '0.7%', color: '#EAB308' },
    { role: 'Contest Organizers', count: '148', pct: '1.2%', color: '#A855F7' },
    { role: 'Others', count: '1,000', pct: '8.0%', color: '#94A3B8' }
  ];

  return (
    <div className="min-h-screen bg-[#FFFBF7] text-home-text font-sans antialiased flex flex-col">
      {/* Top Navbar */}
      <HomeNavbar />

      {/* Main Layout Container */}
      <div className="max-w-[1580px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-7 items-start">

          {/* ══════════════ LEFT ADMIN SIDEBAR ══════════════ */}
          <aside className="w-full lg:w-60 flex-shrink-0 flex flex-col space-y-6">
            
            {/* Sidebar Admin Panel Title */}
            <div className="flex items-center space-x-2 px-3 pt-1">
              <Crown className="w-4 h-4 text-home-accent fill-home-accent/20" />
              <span className="font-bold text-gray-900 text-sm tracking-tight">Admin Panel</span>
            </div>

            {/* Navigation items */}
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-[#FFF0E6] text-home-accent font-semibold shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <LayoutGrid className="w-4 h-4 mr-3 opacity-90" />
                <span>Dashboard</span>
              </button>

              <Link
                to="/admin/problems"
                className="w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/60 transition-colors"
              >
                <FileCode className="w-4 h-4 mr-3 text-gray-400" />
                <span>Manage Problems</span>
              </Link>

              <button
                onClick={() => setActiveTab('contests')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === 'contests'
                    ? 'bg-[#FFF0E6] text-home-accent font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <Trophy className="w-4 h-4 mr-3 text-gray-400" />
                <span>Manage Contests</span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === 'users'
                    ? 'bg-[#FFF0E6] text-home-accent font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <Users className="w-4 h-4 mr-3 text-gray-400" />
                <span>Users</span>
              </button>

              <button
                onClick={() => setActiveTab('submissions')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === 'submissions'
                    ? 'bg-[#FFF0E6] text-home-accent font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <Repeat className="w-4 h-4 mr-3 text-gray-400" />
                <span>Submissions</span>
              </button>

              <button
                onClick={() => setActiveTab('servers')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === 'servers'
                    ? 'bg-[#FFF0E6] text-home-accent font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <Server className="w-4 h-4 mr-3 text-gray-400" />
                <span>Judge Servers</span>
              </button>

              <button
                onClick={() => setActiveTab('announcements')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === 'announcements'
                    ? 'bg-[#FFF0E6] text-home-accent font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <Megaphone className="w-4 h-4 mr-3 text-gray-400" />
                <span>Announcements</span>
              </button>

              <button
                onClick={() => setActiveTab('reports')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === 'reports'
                    ? 'bg-[#FFF0E6] text-home-accent font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <BarChart2 className="w-4 h-4 mr-3 text-gray-400" />
                <span>Reports</span>
              </button>

              <button
                onClick={() => setActiveTab('health')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === 'health'
                    ? 'bg-[#FFF0E6] text-home-accent font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <ShieldCheck className="w-4 h-4 mr-3 text-gray-400" />
                <span>System Health</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-[#FFF0E6] text-home-accent font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <Settings className="w-4 h-4 mr-3 text-gray-400" />
                <span>Settings</span>
              </button>
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

            {/* Sidebar Brand Footer */}
            <div className="px-3 pt-1 text-xs">
              <p className="font-semibold text-gray-800">CodeArena Admin</p>
              <p className="text-gray-400 font-mono text-[11px] mt-0.5">v1.0.0</p>
            </div>
          </aside>

          {/* ══════════════ MAIN CONTENT AREA ══════════════ */}
          <main className="flex-1 w-full min-w-0 space-y-6">

            {/* Top Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-home-accent mb-1">
                  <Crown className="w-3.5 h-3.5 fill-home-accent/30" />
                  <span>Admin</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                  Admin <span className="text-home-accent">Dashboard</span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Overview of your platform, users, problems, and system health.
                </p>
              </div>

              <div className="flex items-center space-x-4 self-start sm:self-auto">
                {/* Slanted Motivational Quote */}
                <div className="hidden xl:block text-right -rotate-2 transform">
                  <p className="text-xs sm:text-[13px] font-serif italic text-gray-700 font-medium leading-snug">
                    “A better platform builds<br />a brighter developer community.”
                  </p>
                </div>

                {/* Date Dropdown Pill */}
                <div className="flex items-center space-x-2 px-3.5 py-2 bg-white rounded-xl border border-gray-200/90 shadow-xs hover:border-gray-300 transition-all cursor-pointer text-xs font-semibold text-gray-700">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span>Tue, 16 Sep 2026</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
                </div>
              </div>
            </div>

            {/* ══════════════ ROW 1: 4 KPI METRIC CARDS ══════════════ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
              {metrics.map((m, idx) => {
                const IconComponent = m.icon;
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between">
                      <div className={`w-11 h-11 rounded-xl ${m.bgColor} flex items-center justify-center ${m.textColor}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        {m.trend}
                      </span>
                    </div>

                    <div className="mt-4">
                      <div className="text-2xl sm:text-[28px] font-bold text-gray-900 tracking-tight leading-none">
                        {m.value}
                      </div>
                      <div className="text-xs font-medium text-gray-500 mt-1.5">
                        {m.label}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-2 font-medium">
                        {m.subtext}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ══════════════ ROW 2: ACTIVITY CHART + USERS BY ROLE ══════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* Platform Activity Area Chart (8 Cols) */}
              <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 text-base">Platform Activity</h2>
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
                    <span>{activityTimeframe}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                </div>

                {/* SVG Area Line Chart */}
                <div className="w-full relative h-[220px] sm:h-[240px]">
                  <svg
                    viewBox="0 0 650 200"
                    className="w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="submissionsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F26522" stopOpacity="0.30" />
                        <stop offset="100%" stopColor="#F26522" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="activeUsersGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Y-Axis Grid Lines & Labels */}
                    <g className="text-[10px] fill-gray-400 font-sans" textAnchor="end">
                      <line x1="35" y1="20" x2="650" y2="20" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                      <text x="28" y="24">40K</text>

                      <line x1="35" y1="60" x2="650" y2="60" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                      <text x="28" y="64">30K</text>

                      <line x1="35" y1="100" x2="650" y2="100" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                      <text x="28" y="104">20K</text>

                      <line x1="35" y1="140" x2="650" y2="140" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                      <text x="28" y="144">10K</text>

                      <line x1="35" y1="180" x2="650" y2="180" stroke="#F1F5F9" strokeWidth="1" />
                      <text x="28" y="184">0</text>
                    </g>

                    {/* Area 1: Submissions (Orange) */}
                    <path
                      d="M 35 150
                         C 80 130, 110 145, 145 135
                         C 180 125, 210 140, 250 128
                         C 285 115, 320 130, 360 125
                         C 400 120, 435 130, 470 120
                         C 505 110, 540 85, 575 80
                         C 610 75, 630 45, 650 35
                         L 650 180 L 35 180 Z"
                      fill="url(#submissionsGrad)"
                    />

                    {/* Curve 1: Submissions Stroke */}
                    <path
                      d="M 35 150
                         C 80 130, 110 145, 145 135
                         C 180 125, 210 140, 250 128
                         C 285 115, 320 130, 360 125
                         C 400 120, 435 130, 470 120
                         C 505 110, 540 85, 575 80
                         C 610 75, 630 45, 650 35"
                      fill="none"
                      stroke="#F26522"
                      strokeWidth="2.5"
                    />

                    {/* Area 2: Active Users (Blue) */}
                    <path
                      d="M 35 170
                         C 80 162, 110 165, 145 158
                         C 180 152, 210 160, 250 150
                         C 285 142, 320 148, 360 140
                         C 400 138, 435 145, 470 140
                         C 505 135, 540 120, 575 120
                         C 610 120, 630 110, 650 105
                         L 650 180 L 35 180 Z"
                      fill="url(#activeUsersGrad)"
                    />

                    {/* Curve 2: Active Users Stroke */}
                    <path
                      d="M 35 170
                         C 80 162, 110 165, 145 158
                         C 180 152, 210 160, 250 150
                         C 285 142, 320 148, 360 140
                         C 400 138, 435 145, 470 140
                         C 505 135, 540 120, 575 120
                         C 610 120, 630 110, 650 105"
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="2.5"
                    />

                    {/* Curve 3: New Users (Amber Line) */}
                    <path
                      d="M 35 178
                         C 80 176, 110 177, 145 174
                         C 180 172, 210 175, 250 170
                         C 285 168, 320 172, 360 168
                         C 400 166, 435 170, 470 168
                         C 505 165, 540 155, 575 155
                         C 610 152, 630 146, 650 142"
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="1.75"
                      strokeDasharray="4 2"
                    />

                    {/* X-Axis Date Labels */}
                    <g className="text-[10px] fill-gray-400 font-sans" textAnchor="middle">
                      <text x="35" y="196">Aug 17</text>
                      <text x="110" y="196">Aug 21</text>
                      <text x="185" y="196">Aug 25</text>
                      <text x="260" y="196">Aug 29</text>
                      <text x="340" y="196">Sep 2</text>
                      <text x="415" y="196">Sep 6</text>
                      <text x="495" y="196">Sep 10</text>
                      <text x="575" y="196">Sep 14</text>
                      <text x="640" y="196">Sep 16</text>
                    </g>
                  </svg>
                </div>

                {/* Chart Legend */}
                <div className="flex items-center justify-center space-x-6 mt-3 pt-3 border-t border-gray-100 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-home-accent"></span>
                    <span className="text-gray-600 font-medium">Submissions</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span className="text-gray-600 font-medium">Active Users</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span className="text-gray-600 font-medium">New Users</span>
                  </div>
                </div>
              </div>

              {/* Users by Role Donut Chart (4 Cols) */}
              <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-gray-900 text-base">Users by Role</h2>
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
                    <span>{roleTimeframe}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                </div>

                <div className="flex items-center justify-between my-auto py-2">
                  {/* SVG Donut Chart */}
                  <div className="relative w-36 h-36 flex-shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                      {/* Base Circle */}
                      <circle cx="50" cy="50" r="38" fill="none" stroke="#F1F5F9" strokeWidth="13" />

                      {/* Regular Users: 89.8% -> strokeDasharray="214.5 24" */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="#FF6F59"
                        strokeWidth="13"
                        strokeDasharray="214 238"
                        strokeDashoffset="0"
                        strokeLinecap="round"
                      />

                      {/* Others: 8% -> strokeDasharray="19 238" */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="#94A3B8"
                        strokeWidth="13"
                        strokeDasharray="19 238"
                        strokeDashoffset="-215"
                      />

                      {/* Contest Organizers: 1.2% -> strokeDasharray="3 238" */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="#A855F7"
                        strokeWidth="13"
                        strokeDasharray="3 238"
                        strokeDashoffset="-234"
                      />

                      {/* Moderators: 0.7% -> strokeDasharray="2 238" */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="none"
                        stroke="#EAB308"
                        strokeWidth="13"
                        strokeDasharray="2 238"
                        strokeDashoffset="-237"
                      />
                    </svg>

                    {/* Donut Center Label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-base font-bold text-gray-900 leading-tight">12,482</span>
                      <span className="text-[10px] text-gray-400 font-medium">Users</span>
                    </div>
                  </div>

                  {/* Role Legend List */}
                  <div className="flex-1 pl-4 space-y-2 text-xs">
                    {roleBreakdown.map((r, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }}></span>
                          <span className="text-gray-700 font-medium text-[11px] truncate max-w-[95px]">{r.role}</span>
                        </div>
                        <div className="flex items-center space-x-3 text-right">
                          <span className="font-semibold text-gray-800 text-[11px]">{r.count}</span>
                          <span className="text-gray-400 text-[11px] w-8">{r.pct}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2"></div>
              </div>
            </div>

            {/* ══════════════ ROW 3: RECENT SUBMISSIONS + RECENT USERS ══════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              
              {/* Recent Submissions Table */}
              <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 text-base">Recent Submissions</h2>
                  <Link to="/submissions" className="text-xs font-semibold text-home-accent hover:underline flex items-center gap-1">
                    View All →
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-400 font-medium border-b border-gray-100 pb-2">
                        <th className="py-2.5 font-normal w-7">#</th>
                        <th className="py-2.5 font-normal">User</th>
                        <th className="py-2.5 font-normal">Problem</th>
                        <th className="py-2.5 font-normal">Language</th>
                        <th className="py-2.5 font-normal">Result</th>
                        <th className="py-2.5 font-normal text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentSubmissions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-2.5 text-gray-400 font-mono">{sub.id}</td>
                          <td className="py-2.5 font-medium text-gray-800">
                            <div className="flex items-center space-x-2">
                              <img
                                src={sub.avatar}
                                alt={sub.username}
                                className="w-5 h-5 rounded-full object-cover border border-gray-200"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                              <span>{sub.username}</span>
                            </div>
                          </td>
                          <td className="py-2.5 text-gray-700 font-medium">{sub.problem}</td>
                          <td className="py-2.5 text-gray-500 font-mono text-[11px]">{sub.language}</td>
                          <td className="py-2.5">
                            {sub.result === 'Accepted' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                Accepted
                              </span>
                            )}
                            {sub.result === 'Wrong Answer' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-600 border border-rose-100">
                                Wrong Answer
                              </span>
                            )}
                            {sub.result === 'TLE' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-100">
                                TLE
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-right font-mono text-gray-500 text-[11px]">{sub.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Users Table */}
              <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 text-base">Recent Users</h2>
                  <button onClick={() => setActiveTab('users')} className="text-xs font-semibold text-home-accent hover:underline flex items-center gap-1">
                    View All →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-400 font-medium border-b border-gray-100 pb-2">
                        <th className="py-2.5 font-normal w-7">#</th>
                        <th className="py-2.5 font-normal">Name</th>
                        <th className="py-2.5 font-normal">Username</th>
                        <th className="py-2.5 font-normal">Joined At</th>
                        <th className="py-2.5 font-normal text-right">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-2.5 text-gray-400 font-mono">{u.id}</td>
                          <td className="py-2.5 font-semibold text-gray-900">
                            <div className="flex items-center space-x-2">
                              <img
                                src={u.avatar}
                                alt={u.name}
                                className="w-5 h-5 rounded-full object-cover border border-gray-200"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                              <span>{u.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 text-gray-500 font-mono text-[11px]">{u.username}</td>
                          <td className="py-2.5 text-gray-500">{u.joined}</td>
                          <td className="py-2.5 text-right">
                            {u.role === 'Admin' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF0E6] text-home-accent border border-orange-200">
                                Admin
                              </span>
                            )}
                            {u.role === 'User' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                                User
                              </span>
                            )}
                            {u.role === 'Moderator' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-600 border border-purple-100">
                                Moderator
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ══════════════ ROW 4: SYSTEM HEALTH + RECENT ANNOUNCEMENTS ══════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              
              {/* System Health Section */}
              <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 text-base">System Health</h2>
                  <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>All Systems Operational</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {healthNodes.map((node, i) => (
                    <div key={i} className="p-3 rounded-xl bg-gray-50/70 border border-gray-200/70 flex flex-col justify-between">
                      <div className="flex items-center space-x-1.5 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-xs font-semibold text-gray-800">{node.name}</span>
                      </div>
                      <div className="text-xs font-medium text-gray-500">
                        {node.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Announcements */}
              <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 text-base">Recent Announcements</h2>
                  <button onClick={() => setActiveTab('announcements')} className="text-xs font-semibold text-home-accent hover:underline flex items-center gap-1">
                    View All →
                  </button>
                </div>

                <div className="space-y-3">
                  {announcements.map((a) => {
                    const IconComp = a.icon;
                    return (
                      <div key={a.id} className="flex items-center justify-between text-xs py-1 hover:bg-gray-50/60 rounded-lg px-1 transition-colors">
                        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                          <IconComp className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          <span className="text-gray-700 font-medium truncate">{a.text}</span>
                        </div>
                        <span className="text-gray-400 font-mono text-[11px] flex-shrink-0">{a.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
