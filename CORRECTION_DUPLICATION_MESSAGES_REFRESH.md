# ✅ Correction : Duplication de Messages au Refresh

**Date :** 2025-11-18
**Problème :** Au refresh de la page, l'intro et la Question 1 étaient rejouées même si le chapitre était déjà commencé

---

## 🎯 Problème Identifié

### Symptôme

Quand un utilisateur rafraîchit la page `/learn/[chapterId]` après avoir commencé un chapitre :

1. ✅ L'historique des messages est bien rechargé depuis Supabase
2. ❌ **MAIS** la logique de démarrage rejoue quand même :
   - Le message d'introduction du chapitre
   - Puis la Question 1
3. Résultat : L'utilisateur voit en bas du chat une nouvelle intro + Question 1, alors qu'il était rendu à Question 2
4. Pire : Quand il répond à cette "fausse" Question 1 affichée, le backend la traite comme Question 2 (décalage UI/logique)

---

### Exemple Concret

**Historique avant refresh (correct) :**
```
[Assistant] 👋 Bonjour ! Bienvenue...
[Assistant] Question 1 : Quelle est...
[User] Réponse B
[Assistant] ✅ Correct ! +10 points
```

**Après refresh (AVANT la correction) :**
```
[Assistant] 👋 Bonjour ! Bienvenue...          ← Historique rechargé
[Assistant] Question 1 : Quelle est...          ← Historique rechargé
[User] Réponse B                                ← Historique rechargé
[Assistant] ✅ Correct ! +10 points             ← Historique rechargé
[Assistant] 👋 Bonjour ! Bienvenue...          ❌ DUPLIQUÉ
[Assistant] Question 1 : Quelle est...          ❌ DUPLIQUÉ
```

L'utilisateur voit maintenant 2 intros et 2 fois la Question 1 !

---

## 🔍 Cause Racine

**Fichier :** [app/learn/[conceptId]/page.tsx:179-228](app/learn/[conceptId]/page.tsx:179-228) (ancienne version)

La logique de reprise avait ce problème :

```typescript
// ❌ ANCIENNE LOGIQUE (BUGGUÉE)
const lastMessage = messages[messages.length - 1];

if (lastMessage.role === 'assistant') {
  const isQuestion = lastMessage.content.includes(`Question ${startQuestionNumber}`);

  if (isQuestion) {
    console.log('Question déjà affichée');
  } else {
    // Vérifier si question déjà posée
    const nextQuestionAlreadyAsked = messages.some(msg =>
      msg.role === 'assistant' &&
      msg.content.includes(nextQuestionText || `Question ${nextQuestionNumber}`)
    );

    if (!nextQuestionAlreadyAsked && nextQuestionNumber <= 5) {
      loadQuestion(nextQuestionNumber, chapter); // ❌ Peut dupliquer !
    }
  }
}
```

**Problème :** Cette logique vérifie uniquement le **dernier message**, pas tout l'historique. Si le dernier message est un feedback (pas une question), elle peut décider de charger la question suivante **même si cette question est déjà présente plus haut dans l'historique**.

**Cas problématique :**
```
messages = [
  {role: 'assistant', content: 'Question 1: ...'},  ← Déjà dans l'historique
  {role: 'user', content: 'Réponse B'},
  {role: 'assistant', content: '✅ Correct !'}      ← Dernier message
]

startQuestionNumber = 2 (d'après chapter_progress)

Ancienne logique:
- lastMessage.content ne contient pas "Question 2"
- Donc charge Question 2
- Mais Question 2 peut DÉJÀ être dans l'historique !
```

---

## ✅ Solution Implémentée

**Fichier :** [app/learn/[conceptId]/page.tsx:179-231](app/learn/[conceptId]/page.tsx:179-231) (nouvelle version)

### Nouvelle Logique de Reprise

```typescript
} else {
  // 🔄 REPRISE DE SESSION: Historique de chat existant
  console.log('✅ Chat history exists, resuming session');

  // ✅ CORRECTION: Vérifier si la question courante est DÉJÀ dans l'historique
  // Chercher dans TOUT l'historique (pas juste le dernier message)
  const currentQuestionAlreadyInHistory = messages.some(msg =>
    msg.role === 'assistant' &&
    msg.content.includes(`Question ${startQuestionNumber}`)
  );

  if (currentQuestionAlreadyInHistory) {
    console.log(`✅ Question ${startQuestionNumber} déjà présente dans l'historique, pas de rechargement`);

    // Restaurer la question courante
    const question = chapter.questions.find((q: any) => q.questionNumber === startQuestionNumber);
    if (question) {
      setCurrentQuestion(question);
    }

    // Vérifier si l'utilisateur a déjà répondu à cette question
    const questionMessageIndex = messages.findIndex(msg =>
      msg.role === 'assistant' &&
      msg.content.includes(`Question ${startQuestionNumber}`)
    );

    const hasUserResponseAfterQuestion = messages.slice(questionMessageIndex + 1).some(
      msg => msg.role === 'user'
    );

    if (hasUserResponseAfterQuestion) {
      console.log(`✅ L'utilisateur a déjà répondu à Question ${startQuestionNumber}, en attente du feedback`);
    } else {
      console.log(`⏳ Question ${startQuestionNumber} affichée, en attente de la réponse de l'utilisateur`);
    }

  } else {
    // La question courante n'est PAS dans l'historique
    // C'est le seul cas où on doit la charger
    console.log(`📝 Question ${startQuestionNumber} non trouvée dans l'historique, chargement...`);

    const question = chapter.questions.find((q: any) => q.questionNumber === startQuestionNumber);
    if (question) {
      setCurrentQuestion(question);
      setTimeout(() => {
        loadQuestion(startQuestionNumber, chapter);
      }, 500);
    }
  }
}
```

---

## 🔑 Changements Clés

### 1. Recherche dans TOUT l'Historique

**AVANT :**
```typescript
const lastMessage = messages[messages.length - 1];
const isQuestion = lastMessage.content.includes(`Question ${startQuestionNumber}`);
```

**APRÈS :**
```typescript
const currentQuestionAlreadyInHistory = messages.some(msg =>
  msg.role === 'assistant' &&
  msg.content.includes(`Question ${startQuestionNumber}`)
);
```

✅ Vérifie **tous les messages** (pas juste le dernier)

---

### 2. Chargement Conditionnel

**Logique :**
- ✅ **SI** la question courante (`startQuestionNumber`) est déjà dans l'historique
  → **NE PAS** recharger la question
  → Juste restaurer `currentQuestion` dans le state

- ✅ **SINON** (question pas dans l'historique)
  → Charger la question avec `loadQuestion()`

---

### 3. Détection de l'État

Une fois qu'on sait que la question est déjà dans l'historique, on vérifie :

```typescript
const questionMessageIndex = messages.findIndex(msg =>
  msg.role === 'assistant' &&
  msg.content.includes(`Question ${startQuestionNumber}`)
);

const hasUserResponseAfterQuestion = messages.slice(questionMessageIndex + 1).some(
  msg => msg.role === 'user'
);
```

- ✅ **Si réponse utilisateur après la question** → L'utilisateur a déjà répondu, on attend le feedback/question suivante
- ✅ **Si pas de réponse** → La question est affichée, on attend que l'utilisateur réponde

---

## 📊 Flux Complet

### Scénario A : Nouveau Chapitre (Pas d'Historique)

```
1. User ouvre /learn/chapter-1
2. useChatMemory charge messages → []
3. hasHistory = false
4. Logique :
   ✅ Envoyer intro
   ✅ Charger Question 1 après 1.5s
5. Chat affiche :
   [Assistant] 👋 Bonjour ! Bienvenue...
   [Assistant] Question 1 : ...
```

---

### Scénario B : Reprise Chapitre (Historique Existe)

#### B1. Question Déjà dans l'Historique

```
1. User revient sur /learn/chapter-1
2. useChatMemory charge messages → [intro, Q1, réponse, feedback]
3. chapter_progress.currentQuestion = 2
4. Logique :
   ✅ Cherche "Question 2" dans messages → PAS TROUVÉE
   ✅ Charge Question 2
5. Chat affiche :
   [Assistant] 👋 Bonjour ! (historique)
   [Assistant] Question 1 : ... (historique)
   [User] Réponse B (historique)
   [Assistant] ✅ Correct ! (historique)
   [Assistant] Question 2 : ... (nouvellement chargée)
```

#### B2. Question Déjà Affichée (User Pas Encore Répondu)

```
1. User refresh pendant qu'il réfléchit à Question 2
2. useChatMemory charge messages → [intro, Q1, réponse, feedback, Q2]
3. chapter_progress.currentQuestion = 2
4. Logique :
   ✅ Cherche "Question 2" dans messages → TROUVÉE
   ❌ NE PAS recharger Question 2
   ✅ Juste restaurer currentQuestion = Q2
5. Chat affiche :
   [Assistant] 👋 Bonjour ! (historique)
   [Assistant] Question 1 : ... (historique)
   [User] Réponse B (historique)
   [Assistant] ✅ Correct ! (historique)
   [Assistant] Question 2 : ... (historique) ← PAS DE DUPLICATION
```

#### B3. Question Répondue mais Feedback Pas Encore Affiché

```
1. User répond à Question 2 puis refresh immédiatement
2. useChatMemory charge messages → [intro, Q1, réponse1, feedback1, Q2, réponse2]
3. chapter_progress.currentQuestion = 2 (ou 3 si déjà mis à jour)
4. Logique :
   ✅ Cherche "Question 2" dans messages → TROUVÉE
   ✅ Trouve réponse user après Question 2
   ✅ Log : "L'utilisateur a déjà répondu, en attente du feedback"
   ❌ NE PAS recharger Question 2
5. Chat affiche :
   [historique complet sans duplication]
```

---

## ✅ Tests de Validation

### Test 1 : Nouveau Chapitre
1. Ouvrir un chapitre jamais visité
2. ✅ Vérifier : Intro + Question 1 affichées
3. ✅ Vérifier : Pas de duplication

### Test 2 : Refresh Pendant Question 1
1. Ouvrir chapitre → Voir Question 1
2. **NE PAS répondre**
3. Rafraîchir la page (F5)
4. ✅ Vérifier : Intro + Question 1 affichées **UNE SEULE FOIS**
5. ✅ Vérifier : Pas de nouvelle intro ni Question 1 en bas

### Test 3 : Refresh Après Avoir Répondu à Question 1
1. Ouvrir chapitre → Répondre à Question 1
2. Voir le feedback + Question 2
3. Rafraîchir la page (F5)
4. ✅ Vérifier : Historique complet affiché (intro, Q1, réponse, feedback, Q2)
5. ✅ Vérifier : Pas de duplication de Q2

### Test 4 : Refresh Pendant Question 2 (Pas Répondu)
1. Avancer jusqu'à Question 2
2. **NE PAS répondre**
3. Rafraîchir la page (F5)
4. ✅ Vérifier : Question 2 affichée **UNE SEULE FOIS**
5. ✅ Vérifier : Historique complet correct

### Test 5 : Refresh Juste Après Réponse (Avant Feedback)
1. Répondre à une question
2. **Immédiatement** rafraîchir (F5)
3. ✅ Vérifier : Réponse présente dans l'historique
4. ✅ Vérifier : Feedback peut apparaître sans duplication de question

---

## 🔒 Garanties

Après cette correction :

- ✅ **Jamais de duplication** de l'intro au refresh
- ✅ **Jamais de duplication** de questions au refresh
- ✅ **Alignement UI/logique** : Ce qui est affiché = ce qui est dans la base
- ✅ **Reprise exacte** : L'utilisateur reprend exactement là où il s'était arrêté
- ✅ **State cohérent** : `currentQuestion` et `currentQuestionNumber` reflètent l'historique

---

## 📁 Fichiers Modifiés

| Fichier | Lignes | Changement |
|---------|--------|------------|
| **app/learn/[conceptId]/page.tsx** | 179-231 | Nouvelle logique de reprise sans duplication |

---

## 🎯 Résultat Final

**AVANT (avec bug) :**
```
[Refresh]
↓
Historique rechargé
+
Intro rejouée        ❌
+
Question 1 rejouée   ❌
```

**APRÈS (corrigé) :**
```
[Refresh]
↓
Historique rechargé
+
Rien de nouveau si question déjà dans l'historique  ✅
OU
Charger question suivante si pas dans l'historique  ✅
```

---

**Dernière mise à jour :** 2025-11-18
**Auteur :** Claude Code Assistant
