/** Must match PLATFORM_SERVICE_FEE_BPS in backend/src/lib/bookingRules.js */
export const PLATFORM_SERVICE_FEE_PERCENT = 12;

/** Service fee applies to hourly subtotal only; cleaning/equipment go to the host. */
export function calculateServiceFee(subtotal: number): number {
  return Math.round(subtotal * PLATFORM_SERVICE_FEE_PERCENT) / 100;
}
