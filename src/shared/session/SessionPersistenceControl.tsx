import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { useSession } from './SessionProvider';

function statusCopy(
  enabled: boolean,
  status: ReturnType<typeof useSession>['persistenceStatus'],
  error: string | null,
): string {
  if (status === 'restoring') return 'Verificando dados salvos neste dispositivo…';
  if (status === 'saving') {
    return enabled ? 'Salvando neste dispositivo…' : 'Removendo dados salvos deste dispositivo…';
  }
  if (status === 'saved') return 'Salvo neste dispositivo';
  if (status === 'error') return error ?? 'O armazenamento deste navegador não está disponível.';
  return 'Os dados ficam somente nesta sessão.';
}

export function SessionPersistenceControl() {
  const {
    persistenceEnabled,
    persistenceError,
    persistenceReady,
    persistenceStatus,
    setPersistenceEnabled,
  } = useSession();
  const isError = persistenceStatus === 'error';

  return (
    <section aria-label="Persistência da sessão" className="w-full max-w-md rounded-xl border border-border bg-card p-3 shadow-sm">
      <label className="flex cursor-pointer items-start gap-3 text-sm font-semibold text-foreground">
        <Checkbox
          checked={persistenceEnabled}
          disabled={!persistenceReady}
          onCheckedChange={(checked) => setPersistenceEnabled(checked === true)}
          aria-label="Lembrar neste dispositivo"
          className="mt-0.5"
        />
        <span>
          Lembrar neste dispositivo
          <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">
            Os dados não são enviados para um servidor, mas outra pessoa que use este navegador poderá acessá-los.
          </span>
        </span>
      </label>
      <Alert
        variant={isError ? 'destructive' : 'default'}
        className="mt-3 px-3 py-2"
        aria-live="polite"
      >
        <AlertDescription className="text-xs">
          {statusCopy(persistenceEnabled, persistenceStatus, persistenceError)}
        </AlertDescription>
      </Alert>
    </section>
  );
}
