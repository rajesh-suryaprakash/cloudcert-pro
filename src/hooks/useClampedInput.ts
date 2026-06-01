/**
 * useClampedInput
 *
 * Solves the "can't type multi-digit numbers" problem that occurs when
 * Math.min/Math.max clamping is applied on every onChange keystroke.
 *
 * Strategy:
 *   - onChange: store the raw string as-is (no clamping) so the user can type freely
 *   - onBlur:   parse, clamp to [min, max], commit to external state, reset display
 *
 * Usage:
 *   const qInput = useClampedInput(numQuestions, (v) => setNumQuestions(v), 5, 60);
 *   <input {...qInput.inputProps} />
 *
 *   // Float support:
 *   const wInput = useClampedInput(weight, (v) => setWeight(v), 0, 100, 0, true);
 *   <input {...wInput.inputProps} step="0.1" />
 */
import { useState, useCallback, useEffect } from 'react';

interface ClampedInputResult {
  /** Bind directly to the <input> element */
  inputProps: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur: () => void;
  };
}

/**
 * @param committedValue  The current "committed" numeric value from parent state
 * @param onCommit        Callback to update parent state with the clamped value
 * @param min             Minimum allowed value (inclusive)
 * @param max             Maximum allowed value (inclusive, use Infinity for no upper bound)
 * @param fallback        Value to use when input is empty/invalid (defaults to min)
 * @param isFloat         Whether to parse as float instead of integer (default: false)
 */
export function useClampedInput(
  committedValue: number,
  onCommit: (value: number) => void,
  min: number,
  max: number,
  fallback?: number,
  isFloat = false,
): ClampedInputResult {
  const resolvedFallback = fallback ?? min;

  // Raw display string — allows free typing without clamping mid-keystroke
  const [raw, setRaw] = useState<string>(String(committedValue));

  // Keep display in sync when the committed value changes externally
  // (e.g. when the modal resets or a different exam is selected)
  useEffect(() => {
    setRaw(String(committedValue));
  }, [committedValue]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow empty string and any numeric characters — no clamping here
    setRaw(e.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    const parsed = isFloat ? parseFloat(raw) : parseInt(raw, 10);
    const clamped = isNaN(parsed)
      ? resolvedFallback
      : Math.min(max, Math.max(min, parsed));
    onCommit(clamped);
    setRaw(String(clamped));
  }, [raw, min, max, resolvedFallback, onCommit, isFloat]);

  return {
    inputProps: {
      value: raw,
      onChange: handleChange,
      onBlur: handleBlur,
    },
  };
}
