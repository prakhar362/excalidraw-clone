import React from 'react';
import { EnhancementStyle } from '../types/enhancement.types';

interface StyleSelectorProps {
  selectedStyle: EnhancementStyle;
  onStyleChange: (style: EnhancementStyle) => void;
  disabled?: boolean;
}

const styles: Array<{
  value: EnhancementStyle;
  label: string;
  icon: string;
  description: string;
}> = [
  {
    value: 'professional',
    label: 'Professional',
    icon: '📐',
    description: 'Clean technical drawing',
  },
  {
    value: 'artistic',
    label: 'Artistic',
    icon: '🎨',
    description: 'Pencil sketch style',
  },
  {
    value: 'clean',
    label: 'Clean',
    icon: '✨',
    description: 'Minimal clean lines',
  },
  {
    value: 'minimal',
    label: 'Minimal',
    icon: '▫️',
    description: 'Ultra-simple',
  },
];

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  selectedStyle,
  onStyleChange,
  disabled = false,
}) => {
  return (
    <div className="mb-4">
      <label className="text-xs font-bold block mb-2 text-black uppercase tracking-wider">
        Enhancement Style:
      </label>
      
      <div className="grid grid-cols-2 gap-2">
        {styles.map((style) => (
          <button
            key={style.value}
            onClick={() => onStyleChange(style.value)}
            disabled={disabled}
            className={`p-3 rounded-md border text-left transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50
              ${selectedStyle === style.value
                ? 'border-blue-600 bg-blue-600 text-white shadow-sm ring-1 ring-blue-600'
                : 'border-slate-300 bg-white hover:border-blue-600 hover:bg-slate-50 text-black'
              }`}
          >
            <div className={`text-xs font-bold mb-0.5 uppercase tracking-wider ${selectedStyle === style.value ? 'text-white' : 'text-black'}`}>{style.label}</div>
            <div className={`text-[10px] leading-tight ${selectedStyle === style.value ? 'text-gray-300' : 'text-gray-500'}`}>{style.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
