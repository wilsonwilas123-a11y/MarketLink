import { useId, type InputHTMLAttributes } from 'react';

export function Input({
  label,
  error,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm text-muted">
        {label}
      </label>
      <input
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`h-10 w-full rounded-xl border bg-elevated px-3 text-primary outline-none transition placeholder:text-muted/60 focus:border-accent ${
          error ? 'border-danger' : 'border-line'
        } ${className}`}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
