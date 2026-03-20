import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredUser } from './auth';

describe('Auth helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('C3: getStoredUser() returns null when nothing in localStorage', () => {
    expect(getStoredUser()).toBeNull();
  });

  it('C4: getStoredUser() returns parsed user when valid JSON stored', () => {
    const user = { id: '1', email: 'a@b.com', name: 'Alice', avatarUrl: null };
    localStorage.setItem('user', JSON.stringify(user));
    expect(getStoredUser()).toEqual(user);
  });
});
