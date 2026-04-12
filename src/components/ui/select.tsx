import { type SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", label, error, id, options, placeholder, ...props }, ref) => {
    return (
      <div>
        {label && (
          <label htmlFor={id} className="mb-1 block text-sm font-medium">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${error ? "border-error" : "border-border"} ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="">{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
