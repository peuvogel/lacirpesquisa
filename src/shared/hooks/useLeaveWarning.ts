import { useEffect } from 'react';

/**
 * Attaches the browser's native beforeunload prompt while `hasData` is true.
 * Re-attaches whenever `hasData` changes so the handler never closes over a
 * stale value (01-RESEARCH Pitfall 2). Only real page unload — not in-app nav.
 */
export function useLeaveWarning(hasData: boolean): void {
  useEffect(() => {
    if (!hasData) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasData]);
}
