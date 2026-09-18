import React from 'react';

/**
 * Decorative floating elements positioned around the hero code editor.
 * Pure CSS animations — no JS interaction needed.
 */
export function FloatingElements() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Top-right motivational text */}
      <div className="absolute top-4 right-0 animate-float-slow hidden lg:block">
        <div className="bg-white/80 rounded-xl px-4 py-3 shadow-sm border border-home-border">
          <p className="text-xs font-medium text-home-text italic leading-relaxed">
            <span className="text-home-accent">Small Steps</span><br />
            <span className="text-home-text-secondary">Big</span><br />
            <span className="text-home-accent font-semibold">Progress</span>
          </p>
        </div>
      </div>

      {/* Right-side motivational text block */}
      <div className="absolute bottom-20 -right-2 animate-float hidden lg:block">
        <div className="bg-white/80 rounded-xl px-4 py-3 shadow-sm border border-home-border">
          <p className="text-xs font-medium text-home-text italic leading-relaxed">
            <span className="text-home-accent">Solve</span><br />
            <span className="text-home-text-secondary">Learn</span><br />
            <span className="text-home-accent">Improve</span><br />
            <span className="text-home-text-secondary">Repeat</span>
          </p>
        </div>
      </div>

      {/* Right side - "Better Code Brighter Futures" */}
      <div className="absolute top-1/4 -right-4 animate-float-reverse hidden xl:block">
        <div className="bg-white/80 rounded-xl px-4 py-3 shadow-sm border border-home-border">
          <p className="text-xs font-medium text-home-text italic leading-relaxed">
            <span className="text-home-accent">Better</span><br />
            <span className="text-home-text-secondary">Code</span><br />
            <span className="text-home-accent">Brighter</span><br />
            <span className="text-home-text-secondary">Futures</span>
          </p>
        </div>
      </div>

      {/* Floating code bracket - top left area */}
      <div className="absolute top-8 left-[35%] animate-float">
        <div className="w-12 h-12 rounded-xl bg-home-accent/10 border border-home-accent/20 flex items-center justify-center shadow-sm">
          <span className="text-home-accent text-lg font-mono font-bold">&lt;/&gt;</span>
        </div>
      </div>

      {/* Python floating badge */}
      <div className="absolute top-20 left-[20%] animate-float-slow hidden md:block">
        <div className="w-10 h-10 rounded-xl bg-[#3776AB]/10 border border-[#3776AB]/20 flex items-center justify-center shadow-sm">
          <span className="text-[#3776AB] text-sm font-bold font-mono">Py</span>
        </div>
      </div>

      {/* JS floating badge */}
      <div className="absolute bottom-28 left-[40%] animate-float-reverse hidden md:block">
        <div className="w-10 h-10 rounded-xl bg-[#F7DF1E]/15 border border-[#F7DF1E]/25 flex items-center justify-center shadow-sm">
          <span className="text-[#B7950B] text-sm font-bold font-mono">JS</span>
        </div>
      </div>

      {/* Curly brackets floating */}
      <div className="absolute top-1/3 left-[15%] animate-float hidden lg:block">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center justify-center">
          <span className="text-emerald-500 text-base font-mono font-bold">&#123;&#125;</span>
        </div>
      </div>

      {/* Decorative dots / circles */}
      <div className="absolute top-12 left-[55%] w-3 h-3 rounded-full bg-home-accent/20 animate-pulse-glow"></div>
      <div className="absolute bottom-32 right-8 w-4 h-4 rounded-full bg-home-accent-soft animate-pulse-glow" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-[10%] w-2 h-2 rounded-full bg-home-accent/30 animate-pulse-glow" style={{ animationDelay: '2s' }}></div>
    </div>
  );
}
