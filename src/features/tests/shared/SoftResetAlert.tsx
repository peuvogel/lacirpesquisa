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
      <AlertTitle className="text-base font-bold text-foreground">Modo alterado.</AlertTitle>
      <AlertDescription className="text-base text-muted-foreground">
        Mantivemos os dados colados, mas limpamos as configurações específicas deste modo. Revise
        Configurar e confirme a tabela antes de analisar.
      </AlertDescription>
    </Alert>
  );
}
