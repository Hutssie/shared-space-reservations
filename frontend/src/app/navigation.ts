import type { NavigateFunction } from 'react-router';

let navigateRef: NavigateFunction | null = null;

export function setAppNavigate(navigate: NavigateFunction | null): void {
  navigateRef = navigate;
}

export function appNavigate(...args: Parameters<NavigateFunction>): void {
  navigateRef?.(...args);
}
