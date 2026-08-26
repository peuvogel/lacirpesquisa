import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export interface SoftResetAlertProps {
  className?: string;
}

export function SoftResetAlert({ className }: SoftResetAlertProps) {
  return (
    <Alert
      role="status"
      aria-live="polite"
      className={cn('border-l-4 border-l-[var(--color-accent)] bg-[var(--color-surface)]', className)}
    >
      <AlertTitle className="text-base font-bold text-foreground">Análise anterior invalidada.</AlertTitle>
      <AlertDescription className="text-base text-muted-foreground">
        Os dados ou a configuração foram alterados. Mantivemos a tabela, mas os resultados anteriores
        não são mais atuais. Revise as escolhas e clique em Analisar dados novamente.
      </AlertDescription>
    </Alert>
  );
}
