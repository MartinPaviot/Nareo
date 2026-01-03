'use client';

import { Search, X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchInput({ value, onChange, placeholder = 'Rechercher...' }: SearchInputProps) {
  const { isDark } = useTheme();

  return (
    <div className="relative">
      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
        isDark ? 'text-neutral-500' : 'text-gray-400'
      }`} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full pl-9 pr-8 py-2 text-sm rounded-lg border transition-colors ${
          isDark
            ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-orange-500'
            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-orange-500'
        } focus:outline-none focus:ring-1 focus:ring-orange-500/30`}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors ${
            isDark
              ? 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
