import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TEST_REGISTRY, isTestAvailable } from '@/features/tests/registry';

export interface TestPickerSelectProps {
  value: string;
  onValueChange: (testId: string) => void;
}

export function TestPickerSelect({ value, onValueChange }: TestPickerSelectProps) {
  const availableTests = TEST_REGISTRY.filter((entry) => isTestAvailable(entry.id));

  return (
    <div className="space-y-2">
      <Label htmlFor="handoff-test-picker" className="font-sans text-label font-bold text-text">
        Usar outro teste
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id="handoff-test-picker" className="w-full">
          <SelectValue placeholder="Escolha um teste" />
        </SelectTrigger>
        <SelectContent>
          {availableTests.map((entry) => (
            <SelectItem key={entry.id} value={entry.id}>
              {entry.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
