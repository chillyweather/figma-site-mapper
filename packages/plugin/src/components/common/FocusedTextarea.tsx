import React, { useRef, useEffect } from "react";
import { FocusedTextareaProps } from "../../types/index";

export const FocusedTextarea: React.FC<FocusedTextareaProps> = ({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  style,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Only focus if this textarea is already focused (maintains focus during re-renders)
  useEffect(() => {
    if (textareaRef.current && document.activeElement === textareaRef.current) {
      textareaRef.current.focus();
    }
  });

  return (
    <textarea
      id={id}
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      style={style}
    />
  );
};
