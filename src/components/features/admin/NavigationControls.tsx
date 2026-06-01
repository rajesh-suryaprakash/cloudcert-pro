import React from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface NavigationControlsProps {
  currentIndex: number;
  total: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  isLoading?: boolean;
  showKeyboardHints?: boolean;
}

export default function NavigationControls({
  currentIndex,
  total,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  isLoading = false,
  showKeyboardHints = true,
}: NavigationControlsProps) {
  // Edge case: Empty context - hide navigation controls
  if (total === 0) {
    return (
      <div className="flex items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-sm text-slate-500 font-medium">No records available for navigation</p>
      </div>
    );
  }

  // Edge case: Single record context
  const isSingleRecord = total === 1;

  return (
    <nav
      className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200"
      role="navigation"
      aria-label="Record navigation"
    >
      {/* Previous Button */}
      <button
        onClick={onPrevious}
        disabled={!canGoPrevious || isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 rounded-lg font-bold hover:bg-slate-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        aria-label={`Navigate to previous record${!canGoPrevious ? ' (disabled, at first record)' : ''}`}
        aria-disabled={!canGoPrevious || isLoading}
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        <span>Previous</span>
      </button>

      {/* Position Indicator */}
      <div className="flex flex-col items-center gap-1">
        <div
          className="flex items-center gap-2"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {isLoading && (
            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" aria-hidden="true" />
          )}
          <span className="text-sm font-bold text-slate-900">
            Record {currentIndex + 1} of {total}
          </span>
        </div>
        {showKeyboardHints && !isSingleRecord && (
          <span
            className="text-xs text-slate-400 font-medium"
            aria-label="Use left and right arrow keys to navigate"
          >
            Keyboard: ← →
          </span>
        )}
        {isSingleRecord && (
          <span className="text-xs text-slate-400 font-medium">Single record</span>
        )}
      </div>

      {/* Next Button */}
      <button
        onClick={onNext}
        disabled={!canGoNext || isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 rounded-lg font-bold hover:bg-slate-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        aria-label={`Navigate to next record${!canGoNext ? ' (disabled, at last record)' : ''}`}
        aria-disabled={!canGoNext || isLoading}
      >
        <span>Next</span>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
