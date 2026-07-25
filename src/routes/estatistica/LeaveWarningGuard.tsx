import { useSession } from '@/shared/session/SessionProvider';
import { useLeaveWarning } from '@/shared/hooks/useLeaveWarning';

/** Invisible guard mounted only on Estatística (D-18). Renders nothing. */
export function LeaveWarningGuard(): null {
  const { hasData } = useSession();
  useLeaveWarning(hasData);
  return null;
}
