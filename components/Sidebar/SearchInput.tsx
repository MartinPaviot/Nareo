'use client';

import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchInput({ value, onChange, placeholder = 'Rechercher...' }: SearchInputProps) {
  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
        style={{ color: 'var(--sidebar-text-muted)' }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border-0 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--color-nareo)]/20"
        style={{
          backgroundColor: 'var(--sidebar-hover)',
          color: 'var(--sidebar-text)',
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors duration-150"
          style={{ color: 'var(--sidebar-text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--sidebar-text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--sidebar-text-muted)'}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
