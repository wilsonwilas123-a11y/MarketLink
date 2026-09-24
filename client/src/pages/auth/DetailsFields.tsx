import { useCallback, useMemo, useState } from 'react';
import { Input } from '../../components/ui/Input';
import type { RequestableRole } from '../../lib/types';

export interface Details {
  full_name: string;
  phone: string;
  address: string;
  role: RequestableRole;
}

export type DetailsErrors = Partial<Record<keyof Details, string>>;

export const emptyDetails: Details = { full_name: '', phone: '', address: '', role: 'customer' };

/**
 * The same bounds as `BootstrapSchema` on the server, copied rather than imported because the
 * browser cannot reach that module. The server still decides; this only saves a round trip.
 */
export function validateDetails(values: Details): DetailsErrors {
  const errors: DetailsErrors = {};
  const name = values.full_name.trim();
  const phone = values.phone.trim();

  if (!name) errors.full_name = 'Tell the market who to call.';
  else if (name.length > 120) errors.full_name = 'That name is longer than 120 characters.';

  if (phone.length < 7) errors.phone = 'Enter a number we can call, like 08031112222.';
  else if (phone.length > 20) errors.phone = 'That number is longer than 20 digits.';

  if (values.address.trim().length > 240)
    errors.address = 'A market, ward or LGA is enough here.';

  return errors;
}

export interface DetailsForm {
  values: Details;
  /** Errors only after a field has been left or the form submitted, so typing is not graded. */
  errors: DetailsErrors;
  setField: <K extends keyof Details>(field: K, value: Details[K]) => void;
  touch: (field: keyof Details) => void;
  valid: boolean;
  /** Reveals every remaining error at once, which is what a failed submit should do. */
  showAllErrors: () => void;
}

export function useDetails(initial: Details = emptyDetails): DetailsForm {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof Details, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const allErrors = useMemo(() => validateDetails(values), [values]);

  const setField = useCallback(
    <K extends keyof Details>(field: K, value: Details[K]) =>
      setValues((current) => ({ ...current, [field]: value })),
    [],
  );

  const touch = useCallback(
    (field: keyof Details) => setTouched((current) => ({ ...current, [field]: true })),
    [],
  );

  const errors = useMemo<DetailsErrors>(() => {
    if (submitAttempted) return allErrors;
    const shown: DetailsErrors = {};
    for (const key of Object.keys(allErrors) as (keyof Details)[]) {
      if (touched[key]) shown[key] = allErrors[key];
    }
    return shown;
  }, [allErrors, submitAttempted, touched]);

  return {
    values,
    errors,
    setField,
    touch,
    valid: Object.keys(allErrors).length === 0,
    showAllErrors: () => {
      setSubmitAttempted(true);
      setTouched({});
    },
  };
}

const roleChoices: { value: RequestableRole; label: string; note: string }[] = [
  {
    value: 'customer',
    label: 'Buy produce',
    note: 'You see every stall, check what is in stock this week, and reserve for pickup at the market.',
  },
  {
    value: 'farmer',
    label: 'Sell from my stall',
    note: 'You get a stall page of your own. The market admin looks at it before shoppers can find it.',
  },
];

export function DetailsFields({
  values,
  errors,
  setField,
  touch,
}: Pick<DetailsForm, 'values' | 'errors' | 'setField' | 'touch'>) {
  const choice = roleChoices.find((c) => c.value === values.role) ?? roleChoices[0]!;

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-sm text-muted">What brings you to MarketLink?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {roleChoices.map((c) => {
            const selected = c.value === values.role;
            return (
              <label
                key={c.value}
                className={`cursor-pointer rounded-full border px-4 py-2.5 text-sm transition ${
                  selected
                    ? 'border-accent/60 bg-accent-soft text-primary'
                    : 'border-line bg-elevated text-muted hover:text-primary'
                } has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent`}
              >
                <input
                  type="radio"
                  name="role"
                  value={c.value}
                  checked={selected}
                  onChange={() => setField('role', c.value)}
                  className="sr-only"
                />
                {c.label}
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">{choice.note}</p>
      </fieldset>

      <Input
        label="Full name"
        value={values.full_name}
        autoComplete="name"
        onChange={(e) => setField('full_name', e.target.value)}
        onBlur={() => touch('full_name')}
        error={errors.full_name}
      />

      <Input
        label="Phone number"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="08031112222"
        value={values.phone}
        onChange={(e) => setField('phone', e.target.value)}
        onBlur={() => touch('phone')}
        error={errors.phone}
      />

      <Input
        label="Where you are (optional)"
        value={values.address}
        placeholder="Bodija, Ibadan"
        onChange={(e) => setField('address', e.target.value)}
        onBlur={() => touch('address')}
        error={errors.address}
      />
    </div>
  );
}
