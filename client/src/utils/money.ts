const localeForCurrency: Record<string, string> = {
  DZD: 'fr-DZ', EGP: 'ar-EG', MAD: 'fr-MA', TND: 'fr-TN',
  XOF: 'fr-SN', XAF: 'fr-CM', NGN: 'en-NG', GHS: 'en-GH',
  GMD: 'en-GM', GNF: 'fr-GN', LRD: 'en-LR', SLL: 'en-SL',
  CVE: 'pt-CV', STN: 'pt-ST',
  ETB: 'en-ET', KES: 'en-KE', RWF: 'en-RW', BIF: 'fr-BI',
  UGX: 'en-UG', TZS: 'sw-TZ', SOS: 'en-SO', SSP: 'en-SS',
  ZAR: 'en-ZA', BWP: 'en-BW', LSL: 'en-LS', SZL: 'en-SZ',
  NAD: 'en-NA', ZMW: 'en-ZM', MWK: 'en-MW', MZN: 'pt-MZ',
  AOA: 'pt-AO', ZWL: 'en-ZW', MUR: 'en-MU', SCR: 'en-SC',
  KMF: 'fr-KM', MGA: 'fr-MG', MRU: 'ar-MR', LYD: 'ar-LY',
  SDG: 'ar-SD', ERN: 'en-ER',
};

/** Format a database amount stored in the currency's smallest unit. */
export function formatMinor(amount: number, currency: string): string {
  const code = currency.toUpperCase();
  return formatMajor(amount / 10 ** minorUnitDigits(code), code);
}

/** Format a major-unit amount (for example 12.34 NGN) as the given currency. */
export function formatMajor(amount: number, currency: string): string {
  const code = currency.toUpperCase();
  return new Intl.NumberFormat(localeForCurrency[code] ?? 'en', {
    style: 'currency',
    currency: code,
  }).format(amount);
}

export function minorUnitDigits(currency: string): number {
  return new Intl.NumberFormat(localeForCurrency[currency.toUpperCase()] ?? 'en', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).resolvedOptions().maximumFractionDigits ?? 2;
}
