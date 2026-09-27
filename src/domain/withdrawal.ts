/** Percentage in thousandths: 20.315% = 20315. */
export const DEFAULT_TAX_RATE = "20.315";
export function parseTaxRate(text: string): number {
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(text))
    throw new Error("가정 세율은 0~100%, 소수 셋째 자리까지 입력해 주세요.");
  const [whole, fraction = ""] = text.split(".");
  const rate = Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
  if (rate > 100000) throw new Error("가정 세율은 0~100%로 입력해 주세요.");
  return rate;
}
export interface WithdrawalEstimate {
  gross: number;
  nisaSale: number;
  taxableSale: number;
  taxableGain: number | null;
  tax: number | null;
  net: number | null;
}
const round = (n: bigint, d: bigint) => (n + d / 2n) / d;
/** A proportional sale of the same aggregate portfolio; not a sequence of monthly sales. */
export function estimateWithdrawal(
  gross: number,
  stocks: bigint,
  taxable: bigint,
  cost: bigint | null,
  rate: number,
): WithdrawalEstimate {
  const sale = stocks === 0n ? 0n : round(BigInt(gross) * taxable, stocks);
  const gain =
    sale === 0n
      ? 0n
      : cost === null
        ? null
        : round(sale * (taxable > cost ? taxable - cost : 0n), taxable);
  const tax = gain === null ? (rate === 0 ? 0 : null) : Number(round(gain * BigInt(rate), 100000n));
  return {
    gross,
    nisaSale: gross - Number(sale),
    taxableSale: Number(sale),
    taxableGain: gain === null ? null : Number(gain),
    tax,
    net: tax === null ? null : gross - tax,
  };
}
