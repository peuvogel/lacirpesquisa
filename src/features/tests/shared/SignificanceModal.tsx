import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import WheelPicker, { type WheelOption } from '@/components/ui/wheelPicker/WheelPicker';

export interface SignificanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string; // e.g. '0.05' or '0.5'
  onConfirm: (val: string) => void;
}

/**
 * Generates options from 0.1 to 10.0 in 0.1 steps.
 * Format label: '0,1', '0,2', ..., '0,5', ..., '10,0'
 */
export function generateSignificanceOptions(): WheelOption[] {
  const options: WheelOption[] = [];
  // 0.1 to 10.0 (1 to 100 in units of 0.1)
  for (let i = 1; i <= 100; i++) {
    const valNum = i / 10;
    const valStr = valNum.toFixed(1);
    const labelStr = valStr.replace('.', ',');
    options.push({
      value: valStr,
      label: labelStr,
      className: valStr === '0.5' ? 'text-teal-400 font-extrabold' : 'text-white font-bold',
    });
  }
  return options;
}

export function SignificanceModal({
  open,
  onOpenChange,
  value,
  onConfirm,
}: SignificanceModalProps) {
  const options = useMemo(() => generateSignificanceOptions(), []);

  // Normalize incoming value to '0.1' .. '10.0' or default to '0.5'
  const parseVal = (v: string): string => {
    if (!v) return '0.5';
    const num = parseFloat(v.replace(',', '.'));
    if (isNaN(num)) return '0.5';
    // If passed as raw alpha like 0.05, convert to percentage string '5.0' or '0.5'
    if (num < 0.1 && num > 0) {
      return (num * 100).toFixed(1);
    }
    return Math.max(0.1, Math.min(10.0, num)).toFixed(1);
  };

  const [selectedValue, setSelectedValue] = useState<string>('0.5');

  // Whenever modal opens, ensure state is initialized (defaulting to 0.5 if reset)
  useEffect(() => {
    if (open) {
      setSelectedValue(parseVal(value) || '0.5');
    }
  }, [open, value]);

  const handleSelect = () => {
    onConfirm(selectedValue);
    onOpenChange(false);
  };

  const alphaCalc = (parseFloat(selectedValue) / 100).toFixed(4);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs border-none bg-transparent p-0 shadow-none sm:max-w-sm focus:outline-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Selecionar Nível de Significância (α)</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 rounded-3xl bg-[#0c0c0e] p-8 text-white border border-white/10 shadow-2xl">
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold tracking-wide text-white">Nível de Significância</h3>
            <p className="text-xs text-white/60">Selecione o valor de α (0,1 a 10,0)</p>
          </div>

          {/* Roda de Seleção 3D estilo iOS */}
          <div className="flex items-center justify-center my-2">
            <WheelPicker
              ariaLabel="Nível de significância (α)"
              options={options}
              value={selectedValue}
              onChange={setSelectedValue}
              width={120}
            />
          </div>

          <p className="text-xs text-white/70 text-center font-mono">
            {selectedValue.replace('.', ',')}% <span className="text-white/40">·</span> (α = {alphaCalc})
          </p>

          <button
            type="button"
            onClick={handleSelect}
            className="w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-bold tracking-wider text-white hover:bg-teal-500 transition-colors active:scale-[0.98]"
          >
            CONFIRMAR
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
