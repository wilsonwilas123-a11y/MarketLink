export const MARKET_COUNTRIES = [
  { name: 'Nigeria', currency: 'NGN' },
  { name: 'Ghana', currency: 'GHS' },
  { name: 'Kenya', currency: 'KES' },
  { name: 'South Africa', currency: 'ZAR' },
  { name: 'Senegal', currency: 'XOF' },
  { name: "Côte d'Ivoire", currency: 'XOF' },
  { name: 'Cameroon', currency: 'XAF' },
  { name: 'Uganda', currency: 'UGX' },
  { name: 'Tanzania', currency: 'TZS' },
  { name: 'Rwanda', currency: 'RWF' },
  { name: 'Egypt', currency: 'EGP' },
  { name: 'Morocco', currency: 'MAD' },
  { name: 'Ethiopia', currency: 'ETB' },
  { name: 'Botswana', currency: 'BWP' },
  { name: 'Zambia', currency: 'ZMW' },
  { name: 'Mozambique', currency: 'MZN' },
] as const;

export type MarketCountry = (typeof MARKET_COUNTRIES)[number]['name'];

const countryLocales: Record<string, string> = {
  Nigeria: 'en-NG', Ghana: 'en-GH', Kenya: 'en-KE', 'South Africa': 'en-ZA',
  Senegal: 'fr-SN', "Côte d'Ivoire": 'fr-CI', Cameroon: 'fr-CM', Uganda: 'en-UG',
  Tanzania: 'sw-TZ', Rwanda: 'rw-RW', Egypt: 'ar-EG', Morocco: 'ar-MA',
  Ethiopia: 'am-ET', Botswana: 'en-BW', Zambia: 'en-ZM', Mozambique: 'pt-MZ',
};

export function currencyForCountry(country?: string | null): string {
  return MARKET_COUNTRIES.find((entry) => entry.name === country)?.currency ?? 'NGN';
}

export function localeForCountry(country?: string | null): string {
  return country ? countryLocales[country] ?? 'en' : 'en-NG';
}
