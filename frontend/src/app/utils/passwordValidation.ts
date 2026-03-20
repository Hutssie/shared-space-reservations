/**
 * Shared password validation rules:
 * - 8 characters or more
 * - At least one uppercase character
 */
export const PASSWORD_MIN_LENGTH = 8;

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  return { valid: true };
}
