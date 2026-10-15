import type { Loan } from "./types";

/** Monthly payment on a fully amortizing loan. */
export function amortPayment(principal: number, rate: number, years: number) {
  const r = rate / 12, n = years * 12;
  if (!principal) return 0;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/** Months of interest-only for a loan structure. Bridge and hard money are IO for the whole term. */
export function ioMonthsFor(l: Pick<Loan, "kind" | "ioMonths">, horizon: number) {
  if (l.kind === "io" || l.kind === "bridge" || l.kind === "hardmoney") return horizon;
  return Math.max(0, l.ioMonths);
}

/** Month-by-month schedule: interest, principal and closing balance. */
export function schedule(principal: number, rate: number, amortYears: number, ioMonths: number, months: number) {
  const r = rate / 12;
  const pmt = amortPayment(principal, rate, amortYears);
  const rows: { interest: number; principal: number; payment: number; balance: number }[] = [];
  let bal = principal;
  for (let m = 1; m <= months; m++) {
    const interest = bal * r;
    const payment = m <= ioMonths ? interest : pmt;
    const prin = Math.min(bal, payment - interest);
    bal -= prin;
    rows.push({ interest, principal: prin, payment, balance: bal });
  }
  return rows;
}

/** Up-front lender cost: origination points plus any extension fee, both on the total commitment. */
export function lenderFees(l: Loan, loanAmount: number) {
  return (l.points + l.extensionFee) * (loanAmount + l.futureFunding);
}

/** Largest loan whose amortizing payment keeps DSCR at the target. */
export function maxLoanByDscr(noi: number, rate: number, amortYears: number, dscr: number, io = false) {
  const annualPerDollar = io ? rate : amortPayment(1, rate, amortYears) * 12;
  return annualPerDollar > 0 ? noi / dscr / annualPerDollar : 0;
}
