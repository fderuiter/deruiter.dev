/** Dollars as thousands, e.g. 184000 -> "$184K". */
export const money = (n: number): string =>
  `$${Math.round(n / 1000).toLocaleString("en-US")}K`;
