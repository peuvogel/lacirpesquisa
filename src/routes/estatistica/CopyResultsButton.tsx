import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { copyTextToClipboard, formatResultReport } from './resultReport';
import type { ResultMetric } from './ResultMetricCard';

const COPY_SUCCESS_TIMEOUT_MS = 2000;

export interface CopyResultsButtonProps {
  title: string;
  metrics: readonly ResultMetric[];
  interpretation: readonly string[];
}

export function CopyResultsButton({
  title,
  metrics,
  interpretation,
}: CopyResultsButtonProps) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimerRef.current != null) {
      window.clearTimeout(resetTimerRef.current);
    }
  }, []);

  const clearResetTimer = () => {
    if (resetTimerRef.current != null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  const handleCopy = async () => {
    clearResetTimer();
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await copyTextToClipboard(formatResultReport(title, metrics, interpretation));
      setSuccessMessage('Copiado');
      resetTimerRef.current = window.setTimeout(() => {
        setSuccessMessage(null);
        resetTimerRef.current = null;
      }, COPY_SUCCESS_TIMEOUT_MS);
    } catch {
      setErrorMessage('Não foi possível copiar. Tente novamente.');
    }
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => void handleCopy()}>
        Copiar tudo
      </Button>
      {successMessage ? (
        <p role="status" className="text-sm text-muted-foreground">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </>
  );
}
