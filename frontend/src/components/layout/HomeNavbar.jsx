import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Menu, X, ChevronDown, Bell, Sun, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * Light-themed Navbar for the Home/Landing page.
 * Separate from the existing dark Navbar to avoid modifying other pages.
 */
export function HomeNavbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const dropdownTimeout = useRef(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleDropdownEnter = (name) => {
    clearTimeout(dropdownTimeout.current);
    setOpenDropdown(name);
  };

  const handleDropdownLeave = () => {
    dropdownTimeout.current = setTimeout(() => setOpenDropdown(null), 200);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-home-border'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-home-accent flex items-center justify-center text-white font-mono font-bold text-sm shadow-sm group-hover:shadow-md transition-shadow">
              &lt;/&gt;
            </div>
            <span className="text-lg font-bold tracking-tight text-home-text">
              Code<span className="text-home-accent">Arena</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center space-x-1 ml-8">
            <Link
              to="/"
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                location.pathname === '/'
                  ? 'home-nav-link active text-home-accent font-semibold'
                  : 'home-nav-link text-home-text-secondary hover:text-home-text'
              }`}
            >
              Home
            </Link>

            {/* Problems dropdown */}
            <div
              className="relative"
              onMouseEnter={() => handleDropdownEnter('problems')}
              onMouseLeave={handleDropdownLeave}
            >
              <button
                className={`flex items-center px-3.5 py-1.5 text-sm font-medium rounded-xl transition-all ${
                  location.pathname.startsWith('/problems')
                    ? 'bg-[#FFF0E6] text-home-accent font-semibold shadow-xs'
                    : 'home-nav-link text-home-text-secondary hover:text-home-text'
                }`}
                onClick={(e) => { e.stopPropagation(); navigate('/problems'); }}
              >
                Problems
                <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
              </button>
              {openDropdown === 'problems' && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-home-border py-2 mobile-menu-enter">
                  <Link to="/problems" className="block px-4 py-2 text-sm text-home-text-secondary hover:text-home-accent hover:bg-home-accent-light/40 transition-colors">
                    All Problems
                  </Link>
                  <Link to="/problems" className="block px-4 py-2 text-sm text-home-text-secondary hover:text-home-accent hover:bg-home-accent-light/40 transition-colors">
                    Easy
                  </Link>
                  <Link to="/problems" className="block px-4 py-2 text-sm text-home-text-secondary hover:text-home-accent hover:bg-home-accent-light/40 transition-colors">
                    Medium
                  </Link>
                  <Link to="/problems" className="block px-4 py-2 text-sm text-home-text-secondary hover:text-home-accent hover:bg-home-accent-light/40 transition-colors">
                    Hard
                  </Link>
                </div>
              )}
            </div>

            {/* Contests */}
            <div className="flex items-center">
              <span className="home-nav-link px-3 py-2 text-sm font-medium text-home-text-secondary hover:text-home-text transition-colors cursor-default flex items-center">
                Contests
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold bg-home-accent text-white rounded-full leading-none">
                  New
                </span>
              </span>
            </div>

            {/* Learn dropdown */}
            <div
              className="relative"
              onMouseEnter={() => handleDropdownEnter('learn')}
              onMouseLeave={handleDropdownLeave}
            >
              <button className="home-nav-link flex items-center px-3 py-2 text-sm font-medium text-home-text-secondary hover:text-home-text transition-colors">
                Learn
                <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-60" />
              </button>
              {openDropdown === 'learn' && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-home-border py-2 mobile-menu-enter">
                  <span className="block px-4 py-2 text-sm text-home-text-muted">Coming soon</span>
                </div>
              )}
            </div>

            {/* Community dropdown */}
            <div
              className="relative"
              onMouseEnter={() => handleDropdownEnter('community')}
              onMouseLeave={handleDropdownLeave}
            >
              <button className="home-nav-link flex items-center px-3 py-2 text-sm font-medium text-home-text-secondary hover:text-home-text transition-colors">
                Community
                <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-60" />
              </button>
              {openDropdown === 'community' && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-home-border py-2 mobile-menu-enter">
                  <span className="block px-4 py-2 text-sm text-home-text-muted">Coming soon</span>
                </div>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="hidden lg:flex items-center space-x-3">
            {/* Search bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={location.pathname.startsWith('/admin') ? "Search users, problems, contests..." : "Search problems, tags, or keywords..."}
                className="w-56 xl:w-64 pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-home-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-home-accent/30 focus:border-home-accent/40 transition-all"
                onFocus={() => navigate('/problems')}
                readOnly
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">⌘K</span>
            </div>

            {/* Theme toggle */}
            <button className="p-2 text-home-text-secondary hover:text-home-text hover:bg-gray-100 rounded-lg transition-colors" aria-label="Theme toggle">
              <Sun className="w-[18px] h-[18px]" />
            </button>

            {/* Notifications */}
            <button className="relative p-2 text-home-text-secondary hover:text-home-text hover:bg-gray-100 rounded-lg transition-colors" aria-label="Notifications">
              <Bell className="w-[18px] h-[18px]" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-home-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                1
              </span>
            </button>

            {/* Auth / Avatar */}
            {(isAuthenticated && user) || location.pathname === '/profile' || location.pathname.startsWith('/admin') ? (
              <div className="flex items-center space-x-2.5 ml-1">
                {isAuthenticated && user && !location.pathname.startsWith('/admin') && (
                  <button
                    onClick={handleLogout}
                    className="hidden sm:inline-flex px-3 py-1.5 text-xs font-medium text-home-text-secondary hover:text-home-accent border border-gray-200 rounded-lg hover:border-home-accent/30 transition-all"
                  >
                    Logout
                  </button>
                )}
                <div className="flex items-center space-x-1.5 cursor-pointer group">
                  <Link
                    to="/profile"
                    className="w-9 h-9 rounded-full border-2 border-orange-400 shadow-xs flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-home-accent/40 transition-all"
                    title={user?.name || "Admin"}
                  >
                    <img src="/images/avatar.png" alt={user?.name || "Profile"} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                  </Link>
                  {location.pathname.startsWith('/admin') && (
                    <div className="flex items-center space-x-1 pl-1">
                      <span className="text-sm font-semibold text-gray-800">Admin</span>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2.5">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm font-medium text-home-text-secondary hover:text-home-text transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-1.5 text-sm font-semibold text-white bg-home-accent hover:bg-home-accent-hover rounded-xl shadow-xs shadow-orange-200 transition-all hover:shadow-md active:scale-[0.98]"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 text-home-text-secondary hover:text-home-text rounded-lg"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-home-border shadow-lg mobile-menu-enter">
          <div className="px-4 py-4 space-y-1">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-home-accent bg-home-accent-light/30 rounded-lg">
              Home
            </Link>
            <Link to="/problems" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-home-text-secondary hover:text-home-accent hover:bg-home-accent-light/30 rounded-lg transition-colors">
              Problems
            </Link>
            <span className="flex items-center px-4 py-2.5 text-sm font-medium text-home-text-secondary">
              Contests
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold bg-home-accent text-white rounded-full leading-none">New</span>
            </span>
            <span className="block px-4 py-2.5 text-sm font-medium text-home-text-muted">
              Learn (Coming soon)
            </span>
            <span className="block px-4 py-2.5 text-sm font-medium text-home-text-muted">
              Community (Coming soon)
            </span>

            {isAuthenticated && user && (
              <Link to="/submissions" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-home-text-secondary hover:text-home-accent hover:bg-home-accent-light/30 rounded-lg transition-colors">
                My Submissions
              </Link>
            )}

            {user?.role === 'ADMIN' && (
              <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-home-text-secondary hover:text-home-accent hover:bg-home-accent-light/30 rounded-lg transition-colors">
                Admin Dashboard
              </Link>
            )}
          </div>
          <div className="px-4 py-4 border-t border-home-border space-y-2">
            {isAuthenticated && user ? (
              <>
                <p className="px-4 text-sm text-home-text font-medium">{user.name}</p>
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="w-full px-4 py-2.5 text-sm font-medium text-home-accent border border-home-accent/30 rounded-lg hover:bg-home-accent-light/30 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center px-4 py-2.5 text-sm font-medium text-home-text-secondary border border-gray-200 rounded-lg hover:border-home-accent/30 transition-colors">
                  Login
                </Link>
                <Link to="/signup" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center px-4 py-2.5 text-sm font-semibold text-white bg-home-accent rounded-lg hover:bg-home-accent-hover transition-colors">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

export default HomeNavbar;
