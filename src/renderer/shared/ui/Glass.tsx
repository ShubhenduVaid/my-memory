import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '', padding = '16px' }) => (
  <div className={`glass-panel ${className}`} style={{ padding }}>
    {children}
  </div>
);

interface GlassButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export const GlassButton: React.FC<GlassButtonProps> = ({ children, onClick, className = '', disabled = false }) => (
  <button 
    className={`glass-button ${className}`} 
    onClick={onClick} 
    disabled={disabled}
  >
    {children}
  </button>
);

interface GlassInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  autoFocus?: boolean;
}

export const GlassInput: React.FC<GlassInputProps> = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
  autoFocus = false
}) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    autoFocus={autoFocus}
    className={`glass-input ${className}`}
  />
);
