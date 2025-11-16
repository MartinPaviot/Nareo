'use client';

import React from 'react';

interface UserMessageBubbleProps {
  content: string;
  timestamp: string;
  userName?: string;
}

/**
 * Extract initials from a full name
 * Examples:
 * - "Martin Paviot" -> "MP"
 * - "John" -> "J"
 * - "Jean-Pierre Dupont" -> "JD"
 */
function getInitials(name: string): string {
  if (!name || name.trim() === '') {
    return 'U'; // Default to 'U' for User
  }

  const words = name.trim().split(/\s+/);
  
  if (words.length === 1) {
    // Single word: return first letter
    return words[0][0].toUpperCase();
  }
  
  // Multiple words: return first letter of first and last word
  const firstInitial = words[0][0].toUpperCase();
  const lastInitial = words[words.length - 1][0].toUpperCase();
  
  return firstInitial + lastInitial;
}

export default function UserMessageBubble({ content, timestamp, userName }: UserMessageBubbleProps): React.ReactElement {
  const initials = getInitials(userName || '');
  
  return (
    <div className="flex justify-end items-start gap-3 mb-4 w-full">
      {/* Message Container */}
      <div className="flex flex-col items-end max-w-[70%]">
        {/* User Message Bubble */}
        <div className="user-message-bubble">
          <p className="user-message-text">
            {content}
          </p>
        </div>
        
        {/* Timestamp */}
        <span className="text-xs text-gray-500 mt-1 px-2">
          {timestamp}
        </span>
      </div>

      {/* User Avatar - Blue Capsule with Initials */}
      <div className="flex-shrink-0">
        <div className="inline-flex items-center justify-center min-w-[40px] h-10 px-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full text-white text-sm font-bold tracking-wide shadow-sm hover:scale-105 transition-transform duration-200 animate-in fade-in slide-in-from-bottom-2">
          {initials}
        </div>
      </div>
    </div>
  );
}
