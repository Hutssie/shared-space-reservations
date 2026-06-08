export const CANCELLATION_POLICY_DESCRIPTIONS: Record<string, string> = {
  flexible: 'Cancel up to 24 hours before your booking for a full refund.',
  moderate: 'Cancel up to 48 hours before your booking for a full refund.',
  strict: 'Cancel up to 7 days before your booking for a full refund.',
};

export const CANCELLATION_POLICY_SUMMARY: Record<string, { title: string; subtitle: string }> = {
  flexible: {
    title: 'Free cancellation',
    subtitle: 'Cancel up to 24 hrs before for a full refund',
  },
  moderate: {
    title: 'Free cancellation',
    subtitle: 'Cancel up to 48 hrs before for a full refund',
  },
  strict: {
    title: 'Limited cancellation',
    subtitle: 'Cancel up to 7 days before for a full refund',
  },
};

export function cancellationPolicyKey(policy: string | null | undefined): string {
  const key = (policy ?? 'flexible').toLowerCase();
  return key in CANCELLATION_POLICY_DESCRIPTIONS ? key : 'flexible';
}
