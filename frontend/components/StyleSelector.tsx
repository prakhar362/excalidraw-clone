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
      <label className="text-xs font-bold block mb-2 text-slate-700">
        Enhancement Style:
      </label>
      
      <div className="grid grid-cols-2 gap-2">
        {styles.map((style) => (
          <button
            key={style.value}
            onClick={() => onStyleChange(style.value)}
            disabled={disabled}
            className={`p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50
              ${selectedStyle === style.value
                ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-600/20'
                : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/50'
              }`}
          >
            <div className="text-xl mb-1">{style.icon}</div>
            <div className="text-xs font-bold text-slate-800 mb-0.5">{style.label}</div>
            <div className="text-[10px] text-slate-500 leading-tight">{style.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
