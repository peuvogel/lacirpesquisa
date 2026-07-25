import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type AlphaValue = '0.01' | '0.05' | '0.10';

const ALPHA_OPTIONS: { value: AlphaValue; label: string }[] = [
  { value: '0.01', label: '1%' },
  { value: '0.05', label: '5%' },
  { value: '0.10', label: '10%' },
];

export interface AlphaSelectorProps {
  value: AlphaValue;
  onChange: (value: AlphaValue) => void;
  className?: string;
}

export function AlphaSelector({ value, onChange, className }: AlphaSelectorProps) {
  return (
    <div className={className}>
      <Label htmlFor="alpha-select" className="text-sm font-bold">
        Nível de significância (α)
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as AlphaValue)}>
        <SelectTrigger id="alpha-select" className="mt-2 w-full min-h-[44px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALPHA_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
