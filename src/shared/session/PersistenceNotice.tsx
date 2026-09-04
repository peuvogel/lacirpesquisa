import type { StatisticsSessionState, PersistenceMode } from './StatisticsSessionProvider';

export interface PersistenceNoticeProps {
  mode: PersistenceMode;
  status: StatisticsSessionState['persistenceStatus'];
  message: string | null;
}

export function PersistenceNotice({ mode, status, message }: PersistenceNoticeProps) {
  const hasError = status === 'error' || message !== null;
  if (mode === 'persistent' && !hasError) return null;
  return (
    <p
      role={hasError ? 'alert' : 'status'}
      aria-live={hasError ? 'assertive' : 'polite'}
      className="lacir-persistence-notice"
    >
      {message ?? 'Modo temporário: os dados durarão somente nesta sessão.'}
    </p>
  );
}
