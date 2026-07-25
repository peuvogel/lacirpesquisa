import { Button } from '@/components/ui/button';

export interface UseExampleButtonProps {
  onClick: () => void;
  className?: string;
}

export function UseExampleButton({ onClick, className }: UseExampleButtonProps) {
  return (
    <Button type="button" variant="outline" onClick={onClick} className={className}>
      Usar exemplo
    </Button>
  );
}
