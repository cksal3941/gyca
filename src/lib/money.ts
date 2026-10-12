import { CURRENCY_EXPONENT, type Money } from "@/contracts";

// Money is always an integer in the currency's minor unit (EUR/USD cents, KRW won). Formatting
// never converts between currencies; it only chooses the symbol and the decimal places.
export function formatMoney(money: Money, locale: "en" | "ko" = "en"): string {
  const exponent = CURRENCY_EXPONENT[money.currency];
  const major = money.amountMinor / 10 ** exponent;
  const whole = exponent === 0 || money.amountMinor % 10 ** exponent === 0;
  return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-GB", {
    style: "currency", currency: money.currency, currencyDisplay: "narrowSymbol",
    minimumFractionDigits: whole ? 0 : exponent, maximumFractionDigits: exponent,
  }).format(major);
}
