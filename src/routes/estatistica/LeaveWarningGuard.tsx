import { useStatisticsSession } from '@/shared/session/StatisticsSessionProvider';
import { useLeaveWarning } from '@/shared/hooks/useLeaveWarning';

/** Invisible guard mounted only on Estatística (D-18). Renders nothing. */
export function LeaveWarningGuard(): null {
  const { hasUnsavedChanges } = useStatisticsSession();
  useLeaveWarning(hasUnsavedChanges);
  return null;
}
