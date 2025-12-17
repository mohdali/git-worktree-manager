import React, { useState } from 'react';
import { Text, useInput } from 'ink';

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  isActive?: boolean;
}

/**
 * Text input component with cursor position management
 * Features:
 * - Visible cursor (▋) at insertion point
 * - Character insertion at cursor position
 * - Backspace deletes character before cursor
 * - Left/Right arrows move cursor (bounded)
 * - Enter key calls onSubmit callback
 */
export function TextInput({
  value,
  onChange,
  placeholder = '',
  onSubmit,
  isActive = true
}: TextInputProps) {
  const [cursorPosition, setCursorPosition] = useState(value.length);

  useInput((input, key) => {
    if (!isActive) return;

    // Handle Enter key
    if (key.return && onSubmit) {
      onSubmit();
      return;
    }

    // Handle backspace
    if (key.backspace || key.delete) {
      if (cursorPosition > 0) {
        const newValue = value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
        onChange(newValue);
        setCursorPosition(prev => prev - 1);
      }
      return;
    }

    // Handle left arrow
    if (key.leftArrow) {
      setCursorPosition(prev => Math.max(0, prev - 1));
      return;
    }

    // Handle right arrow
    if (key.rightArrow) {
      setCursorPosition(prev => Math.min(value.length, prev + 1));
      return;
    }

    // Handle character input (ignore control keys)
    if (input && !key.ctrl && !key.meta && !key.shift) {
      const newValue = value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(prev => prev + 1);
    }
  });

  // Update cursor position when value changes externally
  React.useEffect(() => {
    if (cursorPosition > value.length) {
      setCursorPosition(value.length);
    }
  }, [value, cursorPosition]);

  // Render input with cursor
  const displayValue = value
    ? value.slice(0, cursorPosition) + '▋' + value.slice(cursorPosition)
    : placeholder
      ? `${placeholder}▋`
      : '▋';

  const color = !value && placeholder ? 'gray' : undefined;

  return <Text color={color}>{displayValue}</Text>;
}
