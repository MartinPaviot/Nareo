'use client';

import React from 'react';
import { ChatMessage } from '@/types/chat.types';
import { formatTime } from '@/lib/utils';
import NareoAvatar from './NareoAvatar';
import UserMessageBubble from './UserMessageBubble';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface ChatBubbleProps {
  message: ChatMessage;
}

/**
 * Permanent text cleaning function for all chat messages.
 * Rules:
 * 1. Remove all instances of **
 * 2. Replace - with , except in code blocks, paths, or URLs
 * 3. Preserve all spacing and line breaks
 */
function cleanMessageText(content: string): string {
  // Rule 1: Remove all ** instances
  let cleaned = content.replace(/\*\*/g, '');
  
  // Rule 2: Replace - with , except in protected contexts
  // First, identify and protect code blocks, paths, and URLs
  const protectedRanges: Array<{ start: number; end: number }> = [];
  
  // Protect code blocks (triple backticks)
  const codeBlockRegex = /```[\s\S]*?```/g;
  let match;
  while ((match = codeBlockRegex.exec(cleaned)) !== null) {
    protectedRanges.push({ start: match.index, end: match.index + match[0].length });
  }
  
  // Protect inline code (single backticks)
  const inlineCodeRegex = /`[^`]+`/g;
  while ((match = inlineCodeRegex.exec(cleaned)) !== null) {
    protectedRanges.push({ start: match.index, end: match.index + match[0].length });
  }
  
  // Protect URLs (http://, https://, www., ftp://)
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(ftp:\/\/[^\s]+)/g;
  while ((match = urlRegex.exec(cleaned)) !== null) {
    protectedRanges.push({ start: match.index, end: match.index + match[0].length });
  }
  
  // Protect file paths (containing / or \ with extensions or multiple segments)
  const pathRegex = /[a-zA-Z0-9_\-\.]+[\/\\][a-zA-Z0-9_\-\.\/\\]+/g;
  while ((match = pathRegex.exec(cleaned)) !== null) {
    protectedRanges.push({ start: match.index, end: match.index + match[0].length });
  }
  
  // Sort and merge overlapping ranges
  protectedRanges.sort((a, b) => a.start - b.start);
  const mergedRanges: Array<{ start: number; end: number }> = [];
  for (const range of protectedRanges) {
    if (mergedRanges.length === 0 || mergedRanges[mergedRanges.length - 1].end < range.start) {
      mergedRanges.push(range);
    } else {
      mergedRanges[mergedRanges.length - 1].end = Math.max(
        mergedRanges[mergedRanges.length - 1].end,
        range.end
      );
    }
  }
  
  // Replace - with , outside protected ranges
  let result = '';
  let lastIndex = 0;
  
  for (const range of mergedRanges) {
    // Process text before this protected range
    const beforeRange = cleaned.substring(lastIndex, range.start);
    result += beforeRange.replace(/-/g, ',');
    
    // Add the protected range as-is
    result += cleaned.substring(range.start, range.end);
    lastIndex = range.end;
  }
  
  // Process remaining text after last protected range
  result += cleaned.substring(lastIndex).replace(/-/g, ',');
  
  return result;
}

export default function ChatBubble({ message }: ChatBubbleProps): React.ReactElement {
  const isUser = message.role === 'user';
  const { user } = useAuth();
  const { isDark } = useTheme();
  
  // Apply permanent text cleaning to all messages
  const cleanedContent = cleanMessageText(message.content);

  // Use new UserMessageBubble component for user messages
  if (isUser) {
    // Extract user name from user metadata or email
    const userName = user?.user_metadata?.full_name || 
                     user?.user_metadata?.name || 
                     user?.email?.split('@')[0] || 
                     '';
    
    return (
      <UserMessageBubble 
        content={cleanedContent} 
        timestamp={formatTime(message.timestamp)}
        userName={userName}
      />
    );
  }

  // Parse message content to detect MCQ format
  const formatMessageContent = (content: string): React.ReactElement => {
    // Check if message contains MCQ options (A), B), C), D))
    const hasMCQOptions = /[A-D]\)/.test(content);
    
    if (!isUser && hasMCQOptions) {
      // Split content into parts
      const parts = content.split('\n');
      const questionParts: string[] = [];
      const options: string[] = [];
      let hint = '';
      
      parts.forEach(part => {
        const trimmed = part.trim();
        if (trimmed.match(/^[A-D]\)/)) {
          options.push(trimmed);
        } else if (trimmed.toLowerCase().includes('tapez votre réponse') || trimmed.toLowerCase().includes('type your answer')) {
          hint = trimmed;
        } else if (trimmed) {
          questionParts.push(trimmed);
        }
      });
      
      return (
        <div className="space-y-3">
          {/* Question text */}
          <div className="text-sm leading-relaxed">
            {questionParts.map((part, idx) => (
              <p key={idx} className={cn(
                part.startsWith('Question')
                  ? cn('font-semibold mb-2', isDark ? 'text-gray-100' : 'text-gray-900')
                  : isDark ? 'text-gray-300' : 'text-gray-700'
              )}>
                {part}
              </p>
            ))}
          </div>
          
          {/* MCQ Options */}
          {options.length > 0 && (
            <div className="space-y-2 pl-2">
              {options.map((option, idx) => {
                // Extract the letter label (e.g., "A)")
                const letter = option.substring(0, 2);
                // Get the text after "A)" and clean it thoroughly
                let optionText = option.substring(2).trim();
                
                // Remove ALL possible letter prefixes:
                // - "A: " format (with colon)
                // - "A. " format (with period)
                // - "A) " format (in case it appears again)
                // - "A " format (just letter and space)
                optionText = optionText.replace(/^[A-D][:\.)\]]\s*/, '');
                optionText = optionText.replace(/^[A-D]\s+/, '');
                
                return (
                  <div 
                    key={idx}
                    className="flex items-start gap-2"
                  >
                    <span className="font-semibold text-orange-600 min-w-[24px]">
                      {letter}
                    </span>
                    <span className={cn('text-sm flex-1', isDark ? 'text-gray-300' : 'text-gray-700')}>
                      {optionText}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Hint */}
          {hint && (
            <p className={cn('text-xs italic mt-2', isDark ? 'text-gray-400' : 'text-gray-500')}>
              {hint}
            </p>
          )}
        </div>
      );
    }
    
    // Regular message formatting
    return (
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {content}
      </p>
    );
  };

  // Assistant message rendering
  return (
    <div className="flex gap-3 mb-4 justify-start">
      {/* Nareo Avatar */}
      <div className="flex-shrink-0">
        <NareoAvatar
          state={message.aristoState || 'listening'}
          size="md"
        />
      </div>

      {/* Message Content */}
      <div className="flex flex-col items-start">
        <div className="chat-bubble chat-bubble-assistant">
          {formatMessageContent(cleanedContent)}
        </div>
        
        {/* Timestamp */}
        <span className={cn('text-xs mt-1 px-2', isDark ? 'text-gray-400' : 'text-gray-500')}>
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
