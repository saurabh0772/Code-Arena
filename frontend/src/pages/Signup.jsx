import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, AlertCircle, Mail, Lock, Eye, EyeOff,
  Code2, Users, BarChart3, Globe, User, AtSign, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { HomeNavbar } from '../components/layout/HomeNavbar';

export function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  /* ── Password validation rules ── */
  const passwordChecks = useMemo(() => ({
    length: password.length >= 8,
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  }), [password]);

  const allPasswordChecksPassed = passwordChecks.length && passwordChecks.number && passwordChecks.special;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Full name is required');
      return;
    }
    if (!email.trim()) {
      setError('Email address is required');
      return;
    }
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (!allPasswordChecksPassed) {
      setError('Password does not meet all requirements');
      return;
    }

    setIsLoading(true);

    try {
      await register(name, email, password);
      navigate('/problems', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="home-page min-h-screen bg-home-bg text-home-text font-sans">
      <HomeNavbar />

      {/* Main content */}
      <section className="relative overflow-hidden min-h-[calc(100vh-4rem)]">
        {/* Background decorative elements */}
        <SignupBackground />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 relative z-10">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">

            {/* ═══════ LEFT SIDE — Hero ═══════ */}
            <div className="hidden lg:block pt-4">
              {/* Community pill */}
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-home-accent-light border border-home-accent-soft rounded-full mb-8 opacity-0 animate-fade-in home-stagger-1">
                <span className="text-base">🚀</span>
                <span className="text-sm font-medium text-home-accent">
                  Join thousands of developers
                </span>
              </div>

              {/* Hero headline */}
              <h1 className="text-4xl xl:text-5xl font-extrabold leading-[1.12] tracking-tight mb-5">
                <span className="block opacity-0 animate-fade-in-up home-stagger-2">Start Your</span>
                <span className="block opacity-0 animate-fade-in-up home-stagger-3">
                  <span className="text-home-accent">Coding Journey</span>
                </span>
                <span className="block opacity-0 animate-fade-in-up home-stagger-4">Today!</span>
              </h1>

              <p className="text-lg text-home-text-secondary leading-relaxed mb-10 max-w-md opacity-0 animate-fade-in-up home-stagger-4">
                Create your account and be part of CodeArena —
                where practice meets progress.
              </p>

              {/* Benefit items */}
              <div className="space-y-6 mb-12">
                {BENEFITS.map((benefit, i) => (
                  <div
                    key={benefit.title}
                    className={`flex items-start space-x-4 opacity-0 animate-fade-in-up home-stagger-${i + 4}`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${benefit.iconBg}`}>
                      <benefit.icon className={`w-5 h-5 ${benefit.iconColor}`} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-home-text">{benefit.title}</h3>
                      <p className="text-sm text-home-text-secondary">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Developer illustration */}
              <div className="relative opacity-0 animate-fade-in-up home-stagger-8">
                <img
                  src="/images/developer-illustration.jpg"
                  alt="Developer coding at desk"
                  className="w-full max-w-md rounded-2xl"
                  loading="lazy"
                />

                {/* Floating motivational cards */}
                <div className="absolute -top-6 right-12 animate-float-slow">
                  <div className="bg-white/90 rounded-xl px-3 py-2 shadow-sm border border-home-border">
                    <p className="text-xs font-medium text-home-text-secondary italic leading-relaxed">
                      <span className="text-home-accent">Small</span> Steps<br />
                      <span className="text-home-accent">Big</span> Progress
                    </p>
                  </div>
                </div>

                <div className="absolute bottom-20 -right-2 animate-float-reverse">
                  <div className="bg-white/90 rounded-xl px-3 py-2 shadow-sm border border-home-border">
                    <p className="text-xs font-medium text-home-text-secondary italic leading-relaxed">
                      <span className="text-home-accent">Better</span> Developers<br />
                      <span className="text-home-accent">Brighter</span> Futures
                    </p>
                  </div>
                </div>

                <div className="absolute -bottom-2 left-4 animate-float">
                  <div className="bg-[#1e1e2e] rounded-xl px-4 py-3 shadow-lg">
                    <p className="text-xs font-mono text-emerald-400">
                      <span className="text-orange-400">Code</span> Solve<br />
                      <span className="text-orange-400">Learn</span> Grow<br />
                      <span className="text-home-accent">Repeat_</span>
                    </p>
                  </div>
                </div>

                {/* Topic cards */}
                <div className="absolute -bottom-4 right-16 animate-float-slow">
                  <div className="bg-white/90 rounded-xl px-3 py-2 shadow-sm border border-home-border">
                    <div className="space-y-1">
                      {['Data Structures', 'Algorithms', 'System Design', 'A Better You'].map((item) => (
                        <div key={item} className="flex items-center space-x-2">
                          <span className="w-1 h-1 rounded-full bg-home-accent"></span>
                          <span className="text-[10px] text-home-text-secondary font-medium">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══════ RIGHT SIDE — Signup Card ═══════ */}
            <div className="w-full max-w-md mx-auto lg:max-w-none lg:pt-4 opacity-0 animate-fade-in-up home-stagger-2">
              <div className="bg-white rounded-2xl border border-home-border shadow-xl shadow-gray-200/30 p-8 sm:p-10">
                {/* Card header */}
                <h2 className="text-2xl sm:text-3xl font-extrabold text-home-text mb-2">
                  Create Your <span className="text-home-accent">Account</span>
                </h2>
                <p className="text-sm text-home-text-secondary mb-8">
                  Join CodeArena and start your journey towards becoming a better developer.
                </p>

                {/* Social login buttons */}
                <div className="space-y-3 mb-6">
                  <button
                    type="button"
                    className="w-full flex items-center justify-center space-x-3 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-home-text hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.99]"
                  >
                    <GoogleIcon />
                    <span>Continue with Google</span>
                  </button>
                  <button
                    type="button"
                    className="w-full flex items-center justify-center space-x-3 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-home-text hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.99]"
                  >
                    <GithubIcon />
                    <span>Continue with GitHub</span>
                  </button>
                </div>

                {/* OR Divider */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <span className="text-xs font-medium text-home-text-muted uppercase tracking-wider">OR</span>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>

                {/* Error message */}
                {error && (
                  <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-2.5 text-red-600 text-sm animate-fade-in">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Signup form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Full Name */}
                  <div>
                    <label htmlFor="signup-name" className="block text-sm font-semibold text-home-text mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4.5 h-4.5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        id="signup-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your full name"
                        required
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-home-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-home-accent/30 focus:border-home-accent/50 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div>
                    <label htmlFor="signup-email" className="block text-sm font-semibold text-home-text mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4.5 h-4.5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email address"
                        required
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-home-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-home-accent/30 focus:border-home-accent/50 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div>
                    <label htmlFor="signup-username" className="block text-sm font-semibold text-home-text mb-2">
                      Username
                    </label>
                    <div className="relative">
                      <AtSign className="w-4.5 h-4.5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        id="signup-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Choose a unique username"
                        required
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-home-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-home-accent/30 focus:border-home-accent/50 focus:bg-white transition-all"
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-home-text-muted">
                      This will be your public identity on CodeArena.
                    </p>
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="signup-password" className="block text-sm font-semibold text-home-text mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4.5 h-4.5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a strong password"
                        required
                        className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-home-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-home-accent/30 focus:border-home-accent/50 focus:bg-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-home-text transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password strength indicators */}
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2.5">
                      <PasswordCheck passed={passwordChecks.length} label="At least 8 characters" />
                      <PasswordCheck passed={passwordChecks.number} label="1 number" />
                      <PasswordCheck passed={passwordChecks.special} label="1 special character" />
                    </div>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center px-6 py-3.5 text-base font-semibold text-white bg-home-accent hover:bg-home-accent-hover rounded-xl shadow-lg shadow-orange-200/40 transition-all hover:shadow-xl hover:shadow-orange-200/50 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed group"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Account</span>
                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>

                {/* Login link */}
                <div className="text-center mt-6 text-sm text-home-text-secondary">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="font-semibold text-home-accent hover:text-home-accent-hover transition-colors"
                  >
                    Login
                  </Link>
                </div>

                {/* Terms and Privacy */}
                <p className="mt-6 text-xs text-home-text-muted leading-relaxed text-center">
                  By creating an account, you agree to our{' '}
                  <a href="#" className="text-home-accent hover:text-home-accent-hover font-medium transition-colors">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#" className="text-home-accent hover:text-home-accent-hover font-medium transition-colors">
                    Privacy Policy
                  </a>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="bg-home-bg border-t border-home-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-base font-bold text-home-text">
                  Code<span className="text-home-accent">Arena</span>
                </span>
              </div>
              <p className="text-xs text-home-text-muted">Build a better you, one problem at a time.</p>
            </div>
            <div className="flex items-center space-x-6 text-sm text-home-text-muted">
              <a href="#" className="hover:text-home-accent transition-colors">About</a>
              <a href="#" className="hover:text-home-accent transition-colors">Contact</a>
              <a href="#" className="hover:text-home-accent transition-colors">Privacy</a>
              <a href="#" className="hover:text-home-accent transition-colors">Terms</a>
            </div>
            <div className="flex items-center space-x-3">
              <SocialIcon label="GitHub">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </SocialIcon>
              <SocialIcon label="Twitter">
                <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
              </SocialIcon>
              <SocialIcon label="LinkedIn">
                <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
                <circle cx="4" cy="4" r="2" />
              </SocialIcon>
              <SocialIcon label="Discord">
                <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </SocialIcon>
              <SocialIcon label="YouTube">
                <path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19.13C5.12 19.56 12 19.56 12 19.56s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33z" />
                <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
              </SocialIcon>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Static Data ── */

const BENEFITS = [
  {
    icon: Code2,
    title: 'Solve Real Problems',
    description: 'From fundamentals to advanced topics',
    iconBg: 'bg-orange-50',
    iconColor: 'text-home-accent',
  },
  {
    icon: Users,
    title: 'Compete & Grow',
    description: 'Participate in contests and climb the ranks',
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-500',
  },
  {
    icon: BarChart3,
    title: 'Track Your Progress',
    description: 'Detailed analytics and performance insights',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
  },
  {
    icon: Globe,
    title: 'Join a Global Community',
    description: 'Connect, learn and grow together',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
  },
];

/* ── Sub-components ── */

function PasswordCheck({ passed, label }) {
  return (
    <div className="flex items-center space-x-1.5">
      <CheckCircle2
        className={`w-3.5 h-3.5 transition-colors duration-200 ${
          passed ? 'text-emerald-500' : 'text-gray-300'
        }`}
      />
      <span
        className={`text-xs transition-colors duration-200 ${
          passed ? 'text-emerald-600' : 'text-home-text-muted'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

/* ── Inline SVG Icons ── */

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function SocialIcon({ children, label }) {
  return (
    <a
      href="#"
      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-home-accent transition-colors"
      aria-label={label}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        {children}
      </svg>
    </a>
  );
}

/* ── Background Decorations ── */

function SignupBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Large soft blobs */}
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-home-accent/[0.04] blur-[80px]" />
      <div className="absolute top-1/3 -left-20 w-[300px] h-[300px] rounded-full bg-home-accent-soft/20 blur-[60px]" />
      <div className="absolute bottom-20 right-1/4 w-[200px] h-[200px] rounded-full bg-home-accent/[0.03] blur-[50px]" />

      {/* Floating code elements */}
      <div className="absolute top-20 right-16 animate-float-slow hidden xl:block">
        <div className="bg-white/80 rounded-xl px-4 py-3 shadow-sm border border-home-border">
          <p className="text-xs font-medium text-home-text italic leading-relaxed">
            <span className="text-home-accent">Code</span><br />
            Learn<br />
            <span className="text-home-accent">Build</span><br />
            Grow
          </p>
        </div>
      </div>

      {/* Floating 3D cubes */}
      <div className="absolute top-28 left-[45%] animate-float hidden xl:block">
        <div className="w-6 h-6 rounded bg-gray-300/40 rotate-45 shadow-sm" />
      </div>
      <div className="absolute top-16 right-[30%] animate-float-reverse hidden xl:block">
        <div className="w-4 h-4 rounded bg-gray-300/30 rotate-12 shadow-sm" />
      </div>
      <div className="absolute bottom-32 right-[15%] animate-float-slow hidden xl:block">
        <div className="w-5 h-5 rounded bg-gray-300/35 -rotate-12 shadow-sm" />
      </div>

      {/* Pendant light decoration */}
      <div className="absolute top-0 left-[55%] hidden xl:block">
        <div className="w-px h-16 bg-gray-300/50 mx-auto" />
        <div className="w-4 h-6 bg-gradient-to-b from-amber-100 to-amber-50 rounded-b-full mx-auto shadow-sm border border-amber-200/30" />
      </div>

      {/* Small geometric shapes */}
      <div className="absolute top-32 left-1/3 w-3 h-3 rounded-full bg-home-accent/15 animate-pulse-glow" />
      <div className="absolute bottom-48 left-1/4 w-4 h-4 rounded bg-home-accent-soft/40 rotate-45 animate-float-slow" />
      <div className="absolute top-1/4 right-1/3 w-2 h-2 rounded-full bg-home-accent/20 animate-pulse-glow" style={{ animationDelay: '1.5s' }} />

      {/* Plant decoration on right edge */}
      <div className="absolute bottom-0 right-0 hidden xl:block opacity-30">
        <svg width="80" height="160" viewBox="0 0 80 160" fill="none">
          <ellipse cx="40" cy="145" rx="25" ry="15" fill="#8B6914" opacity="0.3" />
          <path d="M40 140 C30 120 15 100 25 70 C30 55 35 60 40 80" fill="#2D6A2E" opacity="0.6" />
          <path d="M40 140 C50 115 65 95 55 65 C50 50 45 55 40 75" fill="#3A8A3C" opacity="0.5" />
          <path d="M40 130 C35 110 20 90 30 65 C35 52 38 58 40 72" fill="#4CAF50" opacity="0.4" />
          <path d="M40 130 C45 108 58 88 50 62 C47 50 43 56 40 70" fill="#66BB6A" opacity="0.35" />
        </svg>
      </div>

      {/* Subtle grid lines */}
      <div className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: 'linear-gradient(rgba(242,101,34,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(242,101,34,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}
