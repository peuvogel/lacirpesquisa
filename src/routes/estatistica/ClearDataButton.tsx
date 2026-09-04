import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useStatisticsSession } from '@/shared/session/StatisticsSessionProvider';

const CONFIRM_BODY =
  'Limpar os dados desta análise? Essa ação apaga o que foi colado ou importado nesta sessão e não pode ser desfeita.';

export interface ClearDataButtonProps {
  onCleared?: () => void;
}

export function ClearDataButton({ onCleared }: ClearDataButtonProps) {
  const { clearSession } = useStatisticsSession();
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    clearSession();
    onCleared?.();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lacir-danger-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Limpar tabela
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Limpar dados</DialogTitle>
            <DialogDescription>{CONFIRM_BODY}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={handleConfirm}>
              Sim, limpar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
