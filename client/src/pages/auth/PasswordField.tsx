import { useState } from 'react';
import { Input } from '../../components/ui/Input';

/** Password input with a reveal toggle; `top-9` lines the button up with Input's 40px field. */
export function PasswordField({
  value,
  onChange,
  onBlur,
  autoComplete = 'current-password',
  error,
  label = 'Password',
}: {
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  autoComplete?: string;
  error?: string;
  label?: string;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <Input
        label={label}
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        error={error}
        className="pr-16"
      />
      <button
        type="button"
        onClick={() => setShown((current) => !current)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-[1.9rem] text-xs text-muted underline-offset-2 hover:text-primary hover:underline"
      >
        {shown ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
