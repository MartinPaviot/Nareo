'use client';

import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface QuickActionButtonsProps {
  onAction: (actionId: string) => void;
  disabled?: boolean;
}

export default function QuickActionButtons({ 
  onAction, 
  disabled = false 
}: QuickActionButtonsProps) {
  const { translate } = useLanguage();
  
  const QUICK_ACTIONS = [
    { id: 'clarify', label: translate('quick_clarify'), icon: '❓' },
    { id: 'simplify', label: translate('quick_simplify'), icon: '💡' },
    { id: 'example', label: translate('quick_example'), icon: '📝' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.id}
          onClick={() => onAction(action.id)}
          disabled={disabled}
          className={cn(
            'px-3 py-2 rounded-xl text-sm font-medium transition-all',
            'bg-white border border-gray-200 hover:border-orange-300 hover:bg-orange-50',
            'flex items-center gap-2',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span>{action.icon}</span>
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
