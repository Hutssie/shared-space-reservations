import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { setAppNavigate } from '../navigation';
import { useAuth } from '../context/AuthContext';

export function NavigationBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pendingLogout, finalizeLogout } = useAuth();

  setAppNavigate(navigate);

  useEffect(() => {
    setAppNavigate(navigate);
    return () => setAppNavigate(null);
  }, [navigate]);

  useEffect(() => {
    if (pendingLogout && location.pathname === '/') {
      finalizeLogout();
    }
  }, [pendingLogout, location.pathname, finalizeLogout]);

  return null;
}
