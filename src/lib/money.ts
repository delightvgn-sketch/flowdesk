/**
 * Money helpers. Amounts are stored as NUMERIC(14,2) in Postgres and handled as
 * integer cents during arithmetic so rounding is deterministic.
 */

export const DEFAULT_CURRENCY = "KES";

const SYMBOLS: Record<string, string> = { KES: "KSh", USD: "$", EUR: "€", GBP: "£", UGX: "USh", TZS: "TSh" };

export const SUPPORTED_CURRENCIES = Object.keys(SYMBOLS);

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

type FormatOptions = {
  currency?: string;
  /** Compact notation for charts and KPI tiles: KSh 1.2M */
  compact?: boolean;
  /** Always show two decimals (invoices). Defaults to hiding `.00`. */
  decimals?: boolean;
};

/** `formatMoney(85000)` → `KSh 85,000` */
export function formatMoney(amount: number | null | undefined, opts: FormatOptions = {}): string {
  const currency = opts.currency ?? DEFAULT_CURRENCY;
  const symbol = SYMBOLS[currency] ?? currency;
  const value = amount ?? 0;
  const hasFraction = Math.round(value * 100) % 100 !== 0;

  const formatter = new Intl.NumberFormat(
    "en-KE",
    opts.compact
      ? { notation: "compact", maximumFractionDigits: 1 }
      : {
          minimumFractionDigits: opts.decimals || hasFraction ? 2 : 0,
          maximumFractionDigits: 2,
        },
  );

  const sign = value < 0 ? "-" : "";
  return `${sign}${symbol} ${formatter.format(Math.abs(value))}`;
}

export function currencySymbol(currency = DEFAULT_CURRENCY): string {
  return SYMBOLS[currency] ?? currency;
}
