import React, { useState } from 'react';

/**
 * Browser-frame code editor mockup for the hero section.
 * Matches the reference image's visual design closely.
 */
export function CodeEditorMockup() {
  const [activeTab, setActiveTab] = useState('C++');
  const tabs = ['C++', 'Python', 'JavaScript', 'Java'];

  return (
    <div className="w-full max-w-[540px]">
      {/* Browser frame */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200/80 overflow-hidden">
        {/* Browser top bar */}
        <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-200/80">
          <div className="flex items-center space-x-2 mr-4">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-8 py-1 bg-white rounded-md text-xs text-gray-400 border border-gray-200/60 flex items-center space-x-2">
              <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>codearena.dev/editor</span>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 ml-4">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
          </div>
        </div>

        {/* Language tabs */}
        <div className="flex items-center px-4 py-0 bg-white border-b border-gray-200/80">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-xs font-medium transition-all border-b-2 ${
                activeTab === tab
                  ? 'text-home-accent border-home-accent bg-home-accent-light/30'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Code area */}
        <div className="bg-[#FAFBFC] px-0 py-4 font-mono text-[13px] leading-[1.7] min-h-[200px]">
          {activeTab === 'C++' && <CppCode />}
          {activeTab === 'Python' && <PythonCode />}
          {activeTab === 'JavaScript' && <JsCode />}
          {activeTab === 'Java' && <JavaCode />}
        </div>

        {/* Action buttons bar */}
        <div className="flex items-center justify-end px-4 py-3 bg-white border-t border-gray-200/80 space-x-3">
          <button className="flex items-center space-x-2 px-5 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Run</span>
          </button>
          <button className="flex items-center space-x-2 px-5 py-2 bg-home-accent text-white rounded-lg text-sm font-medium hover:bg-home-accent-hover transition-colors shadow-sm shadow-orange-200">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Submit</span>
          </button>
        </div>

        {/* Output section */}
        <div className="border-t border-gray-200/80 bg-white">
          {/* Output tabs */}
          <div className="flex items-center px-4 border-b border-gray-100">
            <span className="px-3 py-2 text-xs font-medium text-home-accent border-b-2 border-home-accent">Output</span>
            <span className="px-3 py-2 text-xs font-medium text-gray-400">Test Cases</span>
            <span className="px-3 py-2 text-xs font-medium text-gray-400">Result</span>
          </div>
          {/* Result display */}
          <div className="px-4 py-3">
            <div className="flex items-center space-x-2 mb-1.5">
              <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-emerald-600">Accepted</span>
            </div>
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span>Runtime: <span className="font-medium text-gray-700">12 ms</span></span>
              <span>Memory: <span className="font-medium text-gray-700">8.4 MB</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Language Code Snippets ── */

function CodeLine({ num, children }) {
  return (
    <div className="flex hover:bg-blue-50/40 transition-colors">
      <span className="w-10 shrink-0 text-right pr-4 text-gray-400 text-xs select-none leading-[1.7]">{num}</span>
      <span className="flex-1 pr-4">{children}</span>
    </div>
  );
}

function CppCode() {
  return (
    <>
      <CodeLine num={1}>
        <span className="code-directive">#include</span>{' '}
        <span className="code-string">&lt;bits/stdc++.h&gt;</span>
      </CodeLine>
      <CodeLine num={2}>
        <span className="code-keyword">using</span>{' '}
        <span className="code-keyword">namespace</span>{' '}
        <span className="code-namespace">std</span><span className="code-plain">;</span>
      </CodeLine>
      <CodeLine num={3}>&nbsp;</CodeLine>
      <CodeLine num={4}>
        <span className="code-type">int</span>{' '}
        <span className="code-function">main</span><span className="code-bracket">()</span>{' '}
        <span className="code-bracket">{'{'}</span>
      </CodeLine>
      <CodeLine num={5}>
        <span className="pl-6">
          <span className="code-namespace">cout</span>{' '}
          <span className="code-operator">&lt;&lt;</span>{' '}
          <span className="code-string">"Hello, CodeArena!"</span>{' '}
          <span className="code-operator">&lt;&lt;</span>{' '}
          <span className="code-namespace">endl</span><span className="code-plain">;</span>
        </span>
      </CodeLine>
      <CodeLine num={6}>
        <span className="pl-6">
          <span className="code-keyword">return</span>{' '}
          <span className="code-number">0</span><span className="code-plain">;</span>
        </span>
      </CodeLine>
      <CodeLine num={7}>
        <span className="code-bracket">{'}'}</span>
        <span className="editor-cursor inline-block w-[2px] h-[15px] bg-home-accent ml-0.5 align-middle"></span>
      </CodeLine>
    </>
  );
}

function PythonCode() {
  return (
    <>
      <CodeLine num={1}>
        <span className="code-keyword">def</span>{' '}
        <span className="code-function">solve</span><span className="code-bracket">(</span><span className="code-plain">n</span><span className="code-bracket">)</span><span className="code-plain">:</span>
      </CodeLine>
      <CodeLine num={2}>
        <span className="pl-6">
          <span className="code-keyword">if</span>{' '}
          <span className="code-plain">n</span>{' '}
          <span className="code-operator">&lt;=</span>{' '}
          <span className="code-number">0</span><span className="code-plain">:</span>
        </span>
      </CodeLine>
      <CodeLine num={3}>
        <span className="pl-12">
          <span className="code-keyword">return</span>{' '}
          <span className="code-number">0</span>
        </span>
      </CodeLine>
      <CodeLine num={4}>
        <span className="pl-6">
          <span className="code-keyword">return</span>{' '}
          <span className="code-function">sum</span><span className="code-bracket">(</span>
          <span className="code-function">range</span><span className="code-bracket">(</span>
          <span className="code-number">1</span><span className="code-plain">, </span>
          <span className="code-plain">n </span>
          <span className="code-operator">+</span>{' '}
          <span className="code-number">1</span>
          <span className="code-bracket">))</span>
        </span>
      </CodeLine>
      <CodeLine num={5}>&nbsp;</CodeLine>
      <CodeLine num={6}>
        <span className="code-function">print</span><span className="code-bracket">(</span>
        <span className="code-function">solve</span><span className="code-bracket">(</span>
        <span className="code-number">10</span>
        <span className="code-bracket">))</span>
        <span className="editor-cursor inline-block w-[2px] h-[15px] bg-home-accent ml-0.5 align-middle"></span>
      </CodeLine>
    </>
  );
}

function JsCode() {
  return (
    <>
      <CodeLine num={1}>
        <span className="code-keyword">function</span>{' '}
        <span className="code-function">twoSum</span><span className="code-bracket">(</span>
        <span className="code-plain">nums, target</span>
        <span className="code-bracket">)</span>{' '}
        <span className="code-bracket">{'{'}</span>
      </CodeLine>
      <CodeLine num={2}>
        <span className="pl-6">
          <span className="code-keyword">const</span>{' '}
          <span className="code-plain">map</span>{' '}
          <span className="code-operator">=</span>{' '}
          <span className="code-keyword">new</span>{' '}
          <span className="code-function">Map</span><span className="code-bracket">()</span><span className="code-plain">;</span>
        </span>
      </CodeLine>
      <CodeLine num={3}>
        <span className="pl-6">
          <span className="code-keyword">for</span>{' '}
          <span className="code-bracket">(</span>
          <span className="code-keyword">let</span>{' '}
          <span className="code-plain">i</span>{' '}
          <span className="code-operator">=</span>{' '}
          <span className="code-number">0</span><span className="code-plain">;</span>{' '}
          <span className="code-plain">i</span>{' '}
          <span className="code-operator">&lt;</span>{' '}
          <span className="code-plain">nums.length</span><span className="code-plain">;</span>{' '}
          <span className="code-plain">i++</span>
          <span className="code-bracket">)</span>{' '}
          <span className="code-bracket">{'{'}</span>
        </span>
      </CodeLine>
      <CodeLine num={4}>
        <span className="pl-12">
          <span className="code-keyword">if</span>{' '}
          <span className="code-bracket">(</span>
          <span className="code-plain">map.has</span><span className="code-bracket">(</span>
          <span className="code-plain">target - nums[i]</span>
          <span className="code-bracket">))</span>
        </span>
      </CodeLine>
      <CodeLine num={5}>
        <span className="pl-16">
          <span className="code-keyword">return</span>{' '}
          <span className="code-bracket">[</span>
          <span className="code-plain">map.get</span><span className="code-bracket">(</span>
          <span className="code-plain">target - nums[i]</span>
          <span className="code-bracket">)</span><span className="code-plain">, i</span>
          <span className="code-bracket">]</span><span className="code-plain">;</span>
        </span>
      </CodeLine>
      <CodeLine num={6}>
        <span className="pl-12">
          <span className="code-plain">map.set</span><span className="code-bracket">(</span>
          <span className="code-plain">nums[i], i</span>
          <span className="code-bracket">)</span><span className="code-plain">;</span>
        </span>
      </CodeLine>
      <CodeLine num={7}>
        <span className="pl-6">
          <span className="code-bracket">{'}'}</span>
        </span>
      </CodeLine>
      <CodeLine num={8}>
        <span className="code-bracket">{'}'}</span>
        <span className="editor-cursor inline-block w-[2px] h-[15px] bg-home-accent ml-0.5 align-middle"></span>
      </CodeLine>
    </>
  );
}

function JavaCode() {
  return (
    <>
      <CodeLine num={1}>
        <span className="code-keyword">import</span>{' '}
        <span className="code-namespace">java.util.*</span><span className="code-plain">;</span>
      </CodeLine>
      <CodeLine num={2}>&nbsp;</CodeLine>
      <CodeLine num={3}>
        <span className="code-keyword">public class</span>{' '}
        <span className="code-type">Solution</span>{' '}
        <span className="code-bracket">{'{'}</span>
      </CodeLine>
      <CodeLine num={4}>
        <span className="pl-6">
          <span className="code-keyword">public static</span>{' '}
          <span className="code-type">void</span>{' '}
          <span className="code-function">main</span><span className="code-bracket">(</span>
          <span className="code-type">String</span><span className="code-bracket">[]</span>{' '}
          <span className="code-plain">args</span>
          <span className="code-bracket">)</span>{' '}
          <span className="code-bracket">{'{'}</span>
        </span>
      </CodeLine>
      <CodeLine num={5}>
        <span className="pl-12">
          <span className="code-namespace">System</span><span className="code-plain">.out.</span>
          <span className="code-function">println</span><span className="code-bracket">(</span>
          <span className="code-string">"Hello, CodeArena!"</span>
          <span className="code-bracket">)</span><span className="code-plain">;</span>
        </span>
      </CodeLine>
      <CodeLine num={6}>
        <span className="pl-6">
          <span className="code-bracket">{'}'}</span>
        </span>
      </CodeLine>
      <CodeLine num={7}>
        <span className="code-bracket">{'}'}</span>
        <span className="editor-cursor inline-block w-[2px] h-[15px] bg-home-accent ml-0.5 align-middle"></span>
      </CodeLine>
    </>
  );
}
