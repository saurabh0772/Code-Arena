import React, { useRef, useEffect } from 'react';
import { Code, RotateCcw, Copy, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { DEFAULT_CPP_TEMPLATE, STARTER_TEMPLATES } from '../../utils/constants';

export { DEFAULT_CPP_TEMPLATE };

export function CodeEditor({
  value,
  onChange,
  language = 'CPP',
  onLanguageChange,
  disabled = false
}) {
  const textareaRef = useRef(null);
  const [copied, setCopied] = React.useState(false);

  // Line count for line numbers
  const lines = (value || '').split('\n');

  // Handle Tab key inside editor for standard 4 spaces
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;

      const newValue = value.substring(0, start) + '    ' + value.substring(end);
      onChange(newValue);

      // Restore cursor position after 4 spaces
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    if (window.confirm(`Reset editor to default ${language} starter template?`)) {
      const template = STARTER_TEMPLATES[language] || DEFAULT_CPP_TEMPLATE;
      onChange(template);
    }
  };

  const getPlaceholder = () => {
    switch (language) {
      case 'PYTHON':
        return 'Write your Python 3 solution here...';
      case 'JAVASCRIPT':
        return 'Write your JavaScript (Node.js) solution here...';
      default:
        return 'Write your C++ solution here...';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d121f] border border-border rounded-xl overflow-hidden shadow-xl">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-border/80">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="font-semibold text-white">Language:</span>
            {onLanguageChange ? (
              <select
                value={language}
                onChange={(e) => onLanguageChange(e.target.value)}
                disabled={disabled}
                className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="CPP">C++ (C++17)</option>
                <option value="PYTHON">Python 3</option>
                <option value="JAVASCRIPT">JavaScript (Node.js)</option>
              </select>
            ) : (
              <span className="px-2 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded text-[11px] font-bold">
                {language === 'CPP' ? 'C++ (C++17)' : language === 'PYTHON' ? 'Python 3' : 'JavaScript (Node.js)'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1 p-1.5 hover:bg-slate-800 rounded transition-colors"
            title="Copy Code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1 p-1.5 hover:bg-slate-800 rounded transition-colors"
            title="Reset to Template"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Editor Body: Line numbers + Textarea */}
      <div className="flex flex-1 relative font-mono text-sm overflow-hidden min-h-[380px]">
        {/* Line Numbers */}
        <div
          aria-hidden="true"
          className="select-none bg-[#0a0e18] text-slate-600 px-3 py-4 text-right border-r border-border/40 font-mono text-xs leading-[21px] min-w-[42px]"
        >
          {lines.map((_, index) => (
            <div key={index}>{index + 1}</div>
          ))}
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          className="flex-1 w-full p-4 bg-transparent text-slate-100 placeholder-slate-600 resize-none focus:outline-none font-mono text-sm leading-[21px] whitespace-pre overflow-auto selection:bg-indigo-600/40"
          placeholder={getPlaceholder()}
        />
      </div>
    </div>
  );
}
