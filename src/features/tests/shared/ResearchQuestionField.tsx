import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface ResearchQuestionFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

export function ResearchQuestionField({
  value,
  onChange,
  placeholder,
  className,
}: ResearchQuestionFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor="research-question" className="text-sm font-bold">
        Pergunta de pesquisa
      </Label>
      <textarea
        id="research-question"
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border border-border bg-[var(--color-bg)] px-3 py-2 text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30"
      />
    </div>
  );
}
