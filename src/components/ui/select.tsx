import React from "react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
  labelClassName?: string;
  options?: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", error, label, labelClassName = "", options = [], children, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className={`${labelClassName || "text-sm font-semibold text-gray-700"} block`}>
            {label}
          </label>
        )}
        <div className="relative">
          <select
            className={`flex h-10 w-full rounded-xl border border-orange-200 bg-white px-3 py-2 ${
              /* allow overriding text size via className */ "text-sm"
            } text-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 appearance-none pr-8 ${
              error ? "border-red-500 focus:ring-red-400" : ""
            } ${className}`}
            ref={ref}
            {...props}
          >
            {children
              ? children
              : options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-orange-600">
            <svg
              className="fill-current h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
            </svg>
          </div>
        </div>
        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
