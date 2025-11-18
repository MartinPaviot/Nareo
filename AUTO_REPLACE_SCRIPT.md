# Script de remplacement automatique pour `setMessages`

Pour accélérer, voici les remplacements à faire dans `handleSendMessage` et `handleQuickAction`.

## handle

SendMessage - User Message

```typescript
// AVANT (ligne ~405)
const userMessage: ChatMessage = {
  id: generateId(),
  role: 'user',
  content: inputValue,
  timestamp: new Date(),
};

setMessages(prev => [...prev, userMessage]);
const userAnswer = inputValue;
setInputValue('');

// APRÈS
const userAnswer = inputValue;
setInputValue('');

await addMessage({
  role: 'user',
  content: userAnswer,
});
```

## handleSendMessage - Feedback Message

```typescript
// AVANT (ligne ~444)
const feedbackMessage: ChatMessage = {
  id: generateId(),
  role: 'assistant',
  content: data.feedback,
  timestamp: new Date(),
  aristoState: data.correct ? 'happy' : 'confused',
};

setMessages(prev => [...prev, feedbackMessage]);

// APRÈS
await addMessage({
  role: 'assistant',
  content: data.feedback,
  aristoState: data.correct ? 'happy' : 'confused',
});
```

## handleSendMessage - Complete Message

```typescript
// AVANT (ligne ~475)
const completeMessage: ChatMessage = {
  id: generateId(),
  role: 'assistant',
  content: `${translate('chat_complete')}...`,
  timestamp: new Date(),
  aristoState: 'success',
};
setMessages(prev => [...prev, completeMessage]);

// APRÈS
await addMessage({
  role: 'assistant',
  content: `${translate('chat_complete')}...`,
  aristoState: 'success',
});
```

## handleSendMessage - Error Message

```typescript
// AVANT (ligne ~487)
const errorMessage: ChatMessage = {
  id: generateId(),
  role: 'assistant',
  content: translate('chat_error'),
  timestamp: new Date(),
  aristoState: 'confused',
};
setMessages(prev => [...prev, errorMessage]);

// APRÈS
await addMessage({
  role: 'assistant',
  content: translate('chat_error'),
  aristoState: 'confused',
});
```

## handleQuickAction - User Message

```typescript
// AVANT (ligne ~510)
const userMessage: ChatMessage = {
  id: generateId(),
  role: 'user',
  content: message,
  timestamp: new Date(),
};

setMessages(prev => [...prev, userMessage]);

// APRÈS
await addMessage({
  role: 'user',
  content: message,
});
```

## handleQuickAction - Help Message

```typescript
// AVANT (ligne ~535)
const helpMessage: ChatMessage = {
  id: generateId(),
  role: 'assistant',
  content: data.help,
  timestamp: new Date(),
  aristoState: 'happy',
};
setMessages(prev => [...prev, helpMessage]);

// APRÈS
await addMessage({
  role: 'assistant',
  content: data.help,
  aristoState: 'happy',
});
```

## handleQuickAction - Error Message

```typescript
// AVANT (ligne ~548)
const errorMessage: ChatMessage = {
  id: generateId(),
  role: 'assistant',
  content: translate('chat_help'),
  timestamp: new Date(),
  aristoState: 'happy',
};
setMessages(prev => [...prev, errorMessage]);

// APRÈS
await addMessage({
  role: 'assistant',
  content: translate('chat_help'),
  aristoState: 'happy',
});
```

## Suppression des fonctions obsolètes

```typescript
// ❌ SUPPRIMER complètement ces sections:

// 1. Auto-save session periodically (lignes ~142-150)
useEffect(() => {
  if (!chapterId) return;

  const interval = setInterval(() => {
    saveSession();
  }, 30000);

  return () => clearInterval(interval);
}, [user, chapterId]);

// 2. Save session on unmount (lignes ~152-157)
useEffect(() => {
  return () => {
    saveSession();
  };
}, []);

// 3. saveSession function (lignes ~559-588)
const saveSession = async () => {
  ...
};

// 4. handleChapterClick - saveSession call (ligne ~606)
const handleChapterClick = (newChapterId: string) => {
  if (newChapterId !== chapterId) {
    // ❌ SUPPRIMER cette ligne
    saveSession();
    router.push(`/learn/${newChapterId}`);
  }
};
```
