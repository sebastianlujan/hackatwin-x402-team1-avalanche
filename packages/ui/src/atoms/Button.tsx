import type { ReactNode } from 'react';

export interface ButtonProps {
  readonly children: ReactNode;
  readonly variant?: 'primary' | 'ghost';
  readonly type?: 'button' | 'submit';
  readonly disabled?: boolean;
  readonly onClick?: () => void;
}

export function Button({ children, variant = 'primary', type = 'button', disabled = false, onClick }: ButtonProps) {
  return (
    <button type={type} className={`hk-button hk-button--${variant}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
