import React from 'react';
import { ThumbsUp, ThumbsDown, Minus } from 'lucide-react';

interface ConfidenceLevelSelectorProps {
  value: string | null;
  onChange: (level: string | null) => void;
  disabled?: boolean;
}

export default function ConfidenceLevelSelector({
  value,
  onChange,
  disabled = false,
}: ConfidenceLevelSelectorProps) {
  const levels = [
    { value: 'Low', label: 'Low', icon: ThumbsDown, color: 'rose' },
    { value: 'Medium', label: 'Medium', icon: Minus, color: 'amber' },
    { value: 'High', label: 'High', icon: ThumbsUp, color: 'emerald' },
  ];

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
        Confidence Level (Optional)
      </label>
      <div className="flex gap-2">
        {levels.map((level) => {
          const Icon = level.icon;
          const isSelected = value === level.value;

          return (
            <button
              key={level.value}
              type="button"
              onClick={() => onChange(isSelected ? null : level.value)}
              disabled={disabled}
              className={`flex-1 py-2 px-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 text-sm font-bold ${
                isSelected
                  ? `border-${level.color}-500 bg-${level.color}-50 text-${level.color}-700`
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Icon className="w-4 h-4" />
              {level.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">
        Rate your confidence to help track your knowledge gaps
      </p>
    </div>
  );
}
