"use client";

import { type InputHTMLAttributes, forwardRef } from "react";
import { Minus, Plus } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, helperText, id, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label htmlFor={id} className="mb-1 block text-sm font-medium text-text">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${
            error ? "border-error" : "border-border"
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
        {!error && helperText && (
          <p className="mt-1 text-xs text-text-secondary">{helperText}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

// ── Variante numérica con botones +/- ─────────────────────────────────────────

interface NumberInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  id?: string;
}

export function NumberInput({
  label,
  error,
  helperText,
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  disabled = false,
  id,
}: NumberInputProps) {
  const decrease = () => onChange(Math.max(min, value - step));
  const increase = () => onChange(Math.min(max, value + step));

  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-text">
          {label}
        </label>
      )}
      <div className={`flex items-center rounded-lg border bg-surface ${error ? "border-error" : "border-border"}`}>
        <button
          type="button"
          onClick={decrease}
          disabled={disabled || value <= min}
          className="flex h-9 w-9 items-center justify-center rounded-l-lg text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-40"
          aria-label="Disminuir"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          id={id}
          type="number"
          value={value}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          disabled={disabled}
          min={min}
          max={max}
          className="h-9 w-16 bg-transparent text-center text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={increase}
          disabled={disabled || value >= max}
          className="flex h-9 w-9 items-center justify-center rounded-r-lg text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-40"
          aria-label="Aumentar"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
      {!error && helperText && (
        <p className="mt-1 text-xs text-text-secondary">{helperText}</p>
      )}
    </div>
  );
}
