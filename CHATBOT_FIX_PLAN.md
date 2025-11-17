# Plan de correction du chatbot sur la page Learn

## Problèmes identifiés

### 1. Problème de chargement des questions
- **Localisation**: `loadQuestion()` lignes 195-260
- **Problème**: La fonction retourne prématurément si `chapter` ou `chapter.questions` n'est pas défini
- **Impact**: Le chatbot ne charge aucune question

### 2. Problème de timing lors de la reprise
- **Localisation**: `loadChapterData()` lignes 182-189
- **Problème**: Pas de délai lors de la reprise d'une session (question > 1)
- **Impact**: Problèmes de synchronisation avec l'état React

### 3. Système de prévention de duplication trop strict
- **Localisation**: `loadQuestion()` lignes 207-211
- **Problème**: `questionLoadedRef` ne se réinitialise jamais
- **Impact**: Empêche le rechargement légitime des questions

### 4. Problème d'initialisation
- **Localisation**: `useEffect` lignes 52-57
- **Problème**: `isInitializedRef` reste true même quand `chapterId` change
- **Impact**: Les données ne se rechargent pas lors du changement de chapitre

### 5. Gestion d'erreurs insuffisante
- **Localisation**: Plusieurs endroits
- **Problème**: Les erreurs échouent silencieusement
- **Impact**: L'utilisateur ne sait pas ce qui ne va pas

## Plan de correction

### Étape 1: Corriger l'initialisation et le rechargement
- Réinitialiser `isInitializedRef` et `questionLoadedRef` quand `chapterId` change
- Ajouter un cleanup dans le useEffect

### Étape 2: Améliorer la gestion du chargement des questions
- Ajouter des vérifications plus robustes
- Ajouter des messages d'erreur utilisateur
- Garantir que les données sont prêtes avant de charger une question

### Étape 3: Ajouter des délais de synchronisation
- Ajouter un délai lors de la reprise de session
- S'assurer que l'état React est synchronisé

### Étape 4: Améliorer la prévention de duplication
- Réinitialiser `questionLoadedRef` au bon moment
- Permettre le rechargement quand nécessaire

### Étape 5: Ajouter une meilleure gestion d'erreurs
- Afficher des messages d'erreur clairs à l'utilisateur
- Logger les erreurs pour le débogage
- Ajouter un état de chargement visible

## Fichiers à modifier

1. `app/learn/[conceptId]/page.tsx` - Corrections principales
