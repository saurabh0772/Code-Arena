import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowRight, AlertCircle, Mail, Lock, Eye, EyeOff,
  Brain, BarChart3, Trophy, Users, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { HomeNavbar } from '../components/layout/HomeNavbar';

export function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/problems';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) {
          throw new Error('Name is required');
        }
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError(null);
  };

  return (
    <div className="home-page min-h-screen bg-home-bg text-home-text font-sans">
      <HomeNavbar />

      {/* Main content */}
      <section className="relative overflow-hidden min-h-[calc(100vh-4rem)]">
        {/* Background decorative elements */}
        <LoginBackground />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 relative z-10">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">

            {/* ═══════ LEFT SIDE ═══════ */}
            <div className="hidden lg:block pt-4">
              {/* Community pill */}
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-home-accent-light border border-home-accent-soft rounded-full mb-8 opacity-0 animate-fade-in home-stagger-1">
                <Users className="w-4 h-4 text-home-accent" />
                <span className="text-sm font-medium text-home-accent">
                  Join a growing community
                </span>
              </div>

              {/* Hero headline */}
              <h1 className="text-4xl xl:text-5xl font-extrabold leading-[1.12] tracking-tight mb-5">
                <span className="block opacity-0 animate-fade-in-up home-stagger-2">Welcome</span>
                <span className="block opacity-0 animate-fade-in-up home-stagger-3">
                  Back, <span className="text-home-accent">Developer!</span>
                </span>
              </h1>

              <p className="text-lg text-home-text-secondary leading-relaxed mb-10 max-w-md opacity-0 animate-fade-in-up home-stagger-4">
                Log in to continue your coding journey with CodeArena.
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

                {/* Floating elements around illustration */}
                <div className="absolute -top-4 right-16 animate-float-slow">
                  <div className="bg-white/90 rounded-xl px-3 py-2 shadow-sm border border-home-border">
                    <p className="text-xs font-medium text-home-text-secondary italic leading-relaxed">
                      <span className="text-home-accent">Good</span> Developers<br />
                      Build <span className="text-home-accent">Better</span><br />
                      Tomorrows.
                    </p>
                  </div>
                </div>

                <div className="absolute -bottom-2 left-4 animate-float">
                  <div className="bg-[#1e1e2e] rounded-xl px-4 py-3 shadow-lg">
                    <p className="text-xs font-mono text-emerald-400">
                      <span className="text-orange-400">Keep</span> Solving<br />
                      <span className="text-orange-400">Keep</span> Growing
                    </p>
                    <div className="mt-1 text-home-accent font-mono text-sm font-bold">&lt;/&gt;</div>
                  </div>
                </div>

                <div className="absolute bottom-16 -right-2 animate-float-reverse">
                  <div className="bg-white/90 rounded-xl px-3 py-2 shadow-sm border border-home-border">
                    <p className="text-xs font-medium text-home-text-secondary italic">
                      <span className="text-home-accent">Better</span> Code<br />
                      <span className="text-home-accent">Brighter</span> Futures.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══════ RIGHT SIDE — Login Card ═══════ */}
            <div className="w-full max-w-md mx-auto lg:max-w-none lg:pt-4 opacity-0 animate-fade-in-up home-stagger-2">
              <div className="bg-white rounded-2xl border border-home-border shadow-xl shadow-gray-200/30 p-8 sm:p-10">
                {/* Card header */}
                <h2 className="text-2xl sm:text-3xl font-extrabold text-home-text mb-2">
                  {isRegister ? 'Create Account ✨' : 'Welcome Back 👋'}
                </h2>
                <p className="text-sm text-home-text-secondary mb-8">
                  {isRegister
                    ? 'Sign up to start your coding journey with CodeArena.'
                    : 'Log in to your account and continue your journey with CodeArena.'
                  }
                </p>

                {/* Social login buttons (cosmetic — no backend OAuth) */}
                {!isRegister && (
                  <>
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
                  </>
                )}

                {/* Error message */}
                {error && (
                  <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-2.5 text-red-600 text-sm animate-fade-in">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Login/Register form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Name field (register only) */}
                  {isRegister && (
                    <div>
                      <label className="block text-sm font-semibold text-home-text mb-2">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="w-4.5 h-4.5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Enter your full name"
                          required
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-home-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-home-accent/30 focus:border-home-accent/50 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* Email field */}
                  <div>
                    <label className="block text-sm font-semibold text-home-text mb-2">
                      Email or Username
                    </label>
                    <div className="relative">
                      <Mail className="w-4.5 h-4.5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email or username"
                        required
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-home-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-home-accent/30 focus:border-home-accent/50 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Password field */}
                  <div>
                    <label className="block text-sm font-semibold text-home-text mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4.5 h-4.5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
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
                    {!isRegister && (
                      <div className="flex justify-end mt-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-home-accent hover:text-home-accent-hover transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}
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
                        <span>{isRegister ? 'Creating Account...' : 'Logging In...'}</span>
                      </>
                    ) : (
                      <>
                        <span>{isRegister ? 'Create Account' : 'Log In'}</span>
                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>

                {/* Toggle login/register */}
                <div className="text-center mt-6 text-sm text-home-text-secondary">
                  {isRegister ? (
                    <>
                      Already have an account?{' '}
                      <button
                        onClick={toggleMode}
                        className="font-semibold text-home-accent hover:text-home-accent-hover transition-colors"
                      >
                        Log In
                      </button>
                    </>
                  ) : (
                    <>
                      Don't have an account?{' '}
                      <Link
                        to="/signup"
                        className="font-semibold text-home-accent hover:text-home-accent-hover transition-colors"
                      >
                        Sign Up
                      </Link>
                    </>
                  )}
                </div>

                {/* Motivational quote */}
                <div className="mt-8 p-5 bg-home-accent-light/40 rounded-xl border border-home-accent-soft/40">
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl text-home-accent/60 font-serif leading-none mt-0.5">"</span>
                    <p className="text-sm italic text-home-text-secondary leading-relaxed">
                      "Discipline today,<br />
                      <span className="ml-1">better developers tomorrow."</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom learning cards (decorative) */}
              <div className="hidden lg:flex items-center gap-4 mt-6 opacity-0 animate-fade-in-up home-stagger-7">
                <div className="bg-white rounded-xl border border-home-border p-3 shadow-sm flex-1">
                  <div className="space-y-1.5">
                    {['DSA', 'System Design', 'Development', 'A Better You'].map((item) => (
                      <div key={item} className="flex items-center space-x-2">
                        <span className="w-1 h-1 rounded-full bg-home-accent"></span>
                        <span className="text-xs text-home-text-secondary">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
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
              {/* Social icons */}
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
    icon: Brain,
    title: 'Solve challenging problems',
    description: 'From basics to advanced',
    iconBg: 'bg-orange-50',
    iconColor: 'text-home-accent',
  },
  {
    icon: BarChart3,
    title: 'Track your progress',
    description: 'See how you improve over time',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
  },
  {
    icon: Trophy,
    title: 'Compete with others',
    description: 'Participate in contests and climb the leaderboard',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
  },
  {
    icon: Users,
    title: 'Be part of a global community',
    description: 'Learn, discuss and grow together',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
  },
];

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

function LoginBackground() {
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
            <span className="text-home-accent">Solve</span><br />
            Learn<br />
            <span className="text-home-accent">Compete</span><br />
            Grow
          </p>
        </div>
      </div>

      {/* Floating code bracket */}
      <div className="absolute bottom-40 right-12 animate-float hidden xl:block">
        <div className="w-12 h-12 rounded-xl bg-home-accent/10 border border-home-accent/20 flex items-center justify-center shadow-sm">
          <span className="text-home-accent text-lg font-mono font-bold">&lt;/&gt;</span>
        </div>
      </div>

      {/* Python badge */}
      <div className="absolute top-1/2 right-24 animate-float-reverse hidden xl:block">
        <div className="w-10 h-10 rounded-xl bg-[#FFD43B]/15 border border-[#FFD43B]/25 flex items-center justify-center shadow-sm">
          <span className="text-[#B7950B] text-sm font-bold font-mono">Py</span>
        </div>
      </div>

      {/* JS badge */}
      <div className="absolute bottom-60 right-40 animate-float-slow hidden xl:block">
        <div className="w-10 h-10 rounded-xl bg-[#F7DF1E]/15 border border-[#F7DF1E]/25 flex items-center justify-center shadow-sm">
          <span className="text-[#B7950B] text-sm font-bold font-mono">JS</span>
        </div>
      </div>

      {/* Small geometric shapes */}
      <div className="absolute top-32 left-1/3 w-3 h-3 rounded-full bg-home-accent/15 animate-pulse-glow" />
      <div className="absolute bottom-48 left-1/4 w-4 h-4 rounded bg-home-accent-soft/40 rotate-45 animate-float-slow" />
      <div className="absolute top-1/4 right-1/3 w-2 h-2 rounded-full bg-home-accent/20 animate-pulse-glow" style={{ animationDelay: '1.5s' }} />

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
