import React, { useRef, useEffect } from 'react';
import { FocusedInputProps } from '../../types';

export const FocusedInput: React.FC<FocusedInputProps> = ({ 
  id, 
  type = 'text', 
  value, 
  onChange, 
  placeholder, 
  disabled, 
  required, 
  className, 
  style, 
  min, 
  max 
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Only focus if this input is already focused (maintains focus during re-renders)
  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.focus();
    }
  });

  return (
    <input
      id={id}
      ref={inputRef}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={className}
      style={style}
      min={min}
      max={max}
    />
  );
};
