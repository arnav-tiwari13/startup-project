import config from "./data/config.json";

export const pct = (n: number) => `${n.toFixed(1)}%`;
export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 === 0 ? 0 : 2 });
export const usdCents = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export const priceLabel = `${usd(config.corePrice)}/month`;
export const coreOffer = `Start Core: ${priceLabel} early-development price, cancel anytime.`;
