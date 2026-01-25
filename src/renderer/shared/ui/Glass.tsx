import React from 'react';
import LiquidGlass from 'liquid-glass-react';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
  cornerRadius?: number;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ 
  children, 
  className = '', 
  padding = '16px',
  cornerRadius = 12
}) => (
  <LiquidGlass
    className={`glass-panel ${className}`}
    padding={padding}
    cornerRadius={cornerRadius}
    blurAmount={0.05}
    saturation={140}
    displacementScale={50}
  >
    {children}
  </LiquidGlass>
);

interface GlassButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export const GlassButton: React.FC<GlassButtonProps> = ({ 
  children, 
  onClick, 
  className = '',
  disabled = false,
  type = 'button'
}) => (
  <LiquidGlass
    className={`glass-button ${className} ${disabled ? 'disabled' : ''}`}
    padding="8px 16px"
    cornerRadius={8}
    blurAmount={0.04}
    saturation={130}
    displacementScale={40}
    elasticity={0.25}
    onClick={disabled ? undefined : onClick}
  >
    <button type={type} disabled={disabled} style={{ all: 'unset', cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {children}
    </button>
  </LiquidGlass>
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
  <LiquidGlass
    className={`glass-input ${className}`}
    padding="12px 16px"
    cornerRadius={8}
    blurAmount={0.03}
    saturation={120}
    displacementScale={30}
  >
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={{
        all: 'unset',
        width: '100%',
        color: 'inherit',
        fontSize: 'inherit'
      }}
    />
  </LiquidGlass>
);
