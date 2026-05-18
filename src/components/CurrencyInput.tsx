import React, { useState, useEffect } from 'react';
import { parseBR, formatBR } from '../utils/currency';

interface CurrencyInputProps {
  value: number | null | undefined;
  onChange: (val: number | null) => void;
  placeholder?: string;
  className?: string;
  decimals?: number;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value, onChange, placeholder, className, decimals = 2,
}) => {
  const [localValue, setLocalValue] = useState<string>(value == null ? '' : formatBR(value, decimals));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setLocalValue(value == null ? '' : formatBR(value, decimals));
    }
  }, [value, focused, decimals]);

  const handleBlur = () => {
    setFocused(false);
    const parsed = parseBR(localValue);
    onChange(parsed);
    setLocalValue(parsed == null ? '' : formatBR(parsed, decimals));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={localValue}
      onFocus={() => setFocused(true)}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder ?? '0,00'}
      className={className ?? 'w-full border border-gray-300 rounded px-3 py-2'}
    />
  );
};
