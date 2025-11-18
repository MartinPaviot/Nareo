# 📚 Documentation du Flux de Quiz LevelUp

## Vue d'ensemble

Le système de quiz LevelUp suit une machine d'état simple et pédagogique :
**Question → Réponse → Feedback → Question suivante**

### Principes clés

1. ✅ **Une seule tentative par question** - L'utilisateur ne peut répondre qu'une fois à chaque question
2. 📝 **Feedback pédagogique obligatoire** - Aristo explique pourquoi la réponse est correcte ou incorrecte
3. ⏭️ **Progression automatique** - Après le feedback, la question suivante se charge automatiquement (délai 2s)
4. 💾 **Mémoire persistante par chapitre** - L'historique du chat est sauvegardé dans Supabase (`chat_messages`) et la progression dans `chapter_progress`

---

## 🔄 Flux Détaillé

### 1. Nouvelle Session (Pas d'historique)

```
User arrive sur un chapitre
  ↓
Aristo affiche un message d'introduction unique qui :
  • Explique le fonctionnement (une tentative par question)
  • Indique le nombre de questions (5)
  • Précise la répartition des points
  • Dit "Commençons !"
  ↓
Après 1.5s → Aristo pose la Question 1
```

**Code:** [app/learn/[conceptId]/page.tsx](app/learn/[conceptId]/page.tsx:163-178)

### 2. Cycle Question-Réponse-Feedback

```
Aristo pose Question N
  ↓
User tape sa réponse
  ↓
handleSendMessage() vérifie :
  ✓ Question en cours existe ?
  ✓ Question déjà répondue ? (via chapter_progress.answers)
  ✗ Si déjà répondue → Bloquer + Message d'avertissement
  ↓
Envoi à /api/chat/evaluate
  ↓
API évalue la réponse :
  • MCQ : Comparaison exacte A/B/C/D
  • Ouverte : Évaluation IA (GPT-4o)
  ↓
API met à jour chapter_progress :
  • Ajoute la réponse à answers[]
  • Incrémente current_question
  • Met à jour le score
  ↓
Aristo affiche le feedback :
  ✅ "Correct ! Excellent travail ! +X points"
  ❌ "Pas tout à fait. La bonne réponse était X. [Explication IA]"
  ↓
Après 2s → Charger Question N+1
```

**Code clés:**
- Validation: [page.tsx:367-389](app/learn/[conceptId]/page.tsx:367-389)
- Évaluation: [api/chat/evaluate/route.ts:93-140](app/api/chat/evaluate/route.ts:93-140)
- Progression: [page.tsx:432-437](app/learn/[conceptId]/page.tsx:432-437)

### 3. Fin du Chapitre

```
Question 5 répondue
  ↓
Feedback affiché
  ↓
Après 2s → Message de félicitations :
  "🎉 Félicitations ! Vous avez terminé ce chapitre !
   📊 Votre score : X points
   ➡️ Passez au chapitre suivant..."
```

**Code:** [page.tsx:418-430](app/learn/[conceptId]/page.tsx:418-430)

---

## 🔄 Reprise de Session (Historique existant)

### Logique de Reprise Simplifiée

Quand l'utilisateur revient sur un chapitre :

```
1. Charger chat_messages depuis Supabase
   (via useChatMemory hook)
   ↓
2. Charger chapter_progress depuis /api/chapters/[id]/progress
   → current_question = dernière question en cours
   ↓
3. Analyser le dernier message dans l'historique :

   Si dernier message = USER :
     → Question répondue, attendre feedback (cas rare)

   Si dernier message = ASSISTANT :
     a) Message contient "Question N" ?
        → C'est une question en attente de réponse
        → Ne rien faire, attendre user

     b) Message est un feedback ?
        → Vérifier si Question N est déjà posée
        → Si non : Charger Question N après 500ms
        → Si oui : Attendre interaction user
```

**Code:** [page.tsx:180-228](app/learn/[conceptId]/page.tsx:180-228)

### Exemple Concret

**Scénario A - User a répondu Q3, feedback affiché:**
```
Messages:
  [Assistant] Question 3: ...
  [User] Réponse B
  [Assistant] ✅ Correct ! +10 points  ← DERNIER MESSAGE

Progression: current_question = 4

Reprise:
  ✓ Dernier message = assistant feedback
  ✓ Question 4 pas encore posée
  → Charger Question 4 après 500ms
```

**Scénario B - User a vu Q4 mais n'a pas encore répondu:**
```
Messages:
  [Assistant] Question 3: ...
  [User] Réponse B
  [Assistant] ✅ Correct ! +10 points
  [Assistant] Question 4: ...  ← DERNIER MESSAGE

Progression: current_question = 4

Reprise:
  ✓ Dernier message = assistant avec "Question 4"
  → Attendre réponse user (ne pas recharger Q4)
```

---

## 🛡️ Protection contre Réponses Multiples

### Mécanisme de Blocage

Avant d'accepter une réponse, `handleSendMessage` vérifie :

```typescript
const progress = chapterProgress.find(p => p.chapterId === chapterId);
const questionAlreadyAnswered = progress?.answers?.some(
  (a: any) => a.questionNumber === currentQuestion.questionNumber
);

if (questionAlreadyAnswered) {
  // BLOQUER + Afficher avertissement
  // + Charger question suivante
  return;
}
```

**Résultat :** Si l'utilisateur essaie de répondre deux fois à la même question, il voit :
```
⚠️ Vous avez déjà répondu à la Question N.
Une seule tentative est autorisée par question. Passons à la suite !
```

**Code:** [page.tsx:367-389](app/learn/[conceptId]/page.tsx:367-389)

---

## 💾 Stockage et Persistence

### Table: `chat_messages`

Stocke **tous les messages** du chat (utilisateur + assistant)

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | ID auto-généré Supabase |
| `message_id` | TEXT | ID custom depuis frontend |
| `user_id` | UUID | ID utilisateur (auth.uid()) |
| `chapter_id` | TEXT | ID du chapitre |
| `sender` | TEXT | 'user' ou 'assistant' |
| `content` | TEXT | Contenu du message |
| `created_at` | TIMESTAMPTZ | Date création |

**Utilisation :** Permet de reconstruire l'historique complet du chat lors de la reprise.

### Table: `chapter_progress`

Stocke la **progression** de l'utilisateur par chapitre

| Colonne | Type | Description |
|---------|------|-------------|
| `chapter_id` | TEXT | ID du chapitre |
| `user_id` | UUID | ID utilisateur |
| `current_question` | INTEGER | Numéro de la question en cours (1-5) |
| `questions_answered` | INTEGER | Nombre de questions répondues |
| `score` | INTEGER | Score total accumulé |
| `completed` | BOOLEAN | Chapitre terminé ? |
| `answers` | JSONB | Array des réponses: `[{questionId, questionNumber, answer, correct, score, feedback, timestamp}]` |

**Utilisation :**
- Détermine quelle question charger lors de la reprise
- Bloque les tentatives multiples sur une même question
- Affiche le score en temps réel

---

## 🔧 Fichiers Modifiés

### 1. `/app/api/translate/content/route.ts`
**Problème corrigé :** `ReferenceError: content is not defined`

**Solution :**
- Variables déclarées en dehors du `try-catch` pour accès dans le `catch`
- Ajout du champ `translatedText` dans la réponse (+ `translated` pour rétrocompat)
- Logging amélioré pour diagnostiquer erreurs OpenAI

**Code:** [route.ts:5-21](app/api/translate/content/route.ts:5-21)

### 2. `/app/learn/[conceptId]/page.tsx`
**Changements majeurs :**

a) **Message d'introduction simplifié** (ligne 168-172)
   - Un seul message qui explique tout
   - Mention explicite : "Une seule tentative par question"

b) **Logique de reprise simplifiée** (ligne 180-228)
   - Basée sur dernier message + `current_question`
   - Ne recharge pas les questions déjà posées

c) **Blocage réponses multiples** (ligne 367-389)
   - Vérifie `chapter_progress.answers[]`
   - Affiche avertissement + charge question suivante

### 3. `/app/api/chat/evaluate/route.ts`
**Pas de changements nécessaires** - La logique existante est correcte :
- Une seule évaluation par appel
- Mise à jour de `chapter_progress` avec la nouvelle réponse
- Incrémentation automatique de `current_question`

---

## 📊 Diagramme de Machine d'État

```
┌─────────────────────────────────────────────────────────────┐
│                     DÉBUT DE CHAPITRE                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │  Introduction  │  (Message unique)
              └────────┬───────┘
                       │ (1.5s delay)
                       ▼
       ╔═══════════════════════════════════╗
       ║       QUESTION EN ATTENTE         ║
       ║   Aristo pose Question N          ║
       ║   current_question = N            ║
       ╚═══════════════════════════════════╝
                       │
                       │ User répond
                       ▼
              ┌────────────────┐
              │  Validation    │
              │  - Question    │
              │    en cours ?  │
              │  - Déjà        │
              │    répondue ?  │
              └────┬───────────┘
                   │
          ┌────────┴────────┐
          │                 │
   ❌ Déjà répondue   ✅ Nouvelle réponse
          │                 │
          ▼                 ▼
    ┌──────────┐    ┌──────────────┐
    │ Bloquer  │    │  Évaluation  │
    │ Message  │    │  API call    │
    │ Warning  │    └──────┬───────┘
    └────┬─────┘           │
         │                 ▼
         │         ┌───────────────┐
         │         │  Feedback     │
         │         │  + Update DB  │
         │         └───────┬───────┘
         │                 │
         │                 │ (2s delay)
         └─────────────────┤
                           │
                           ▼
                    ┌──────────────┐
                    │ N < 5 ?      │
                    └──┬───────┬───┘
                       │       │
                  OUI  │       │  NON
                       ▼       ▼
              ┌─────────────┐  ┌─────────────┐
              │ Question    │  │ Félicit.    │
              │ N+1         │  │ Chapitre    │
              │             │  │ terminé     │
              └─────────────┘  └─────────────┘
                     │
                     └──────┐
                            │
       ╔════════════════════▼═══════════════════╗
       ║       QUESTION EN ATTENTE (N+1)        ║
       ╚════════════════════════════════════════╝
```

---

## ✅ Tests Recommandés

### Test 1: Nouvelle Session
1. Ouvrir un chapitre pour la première fois
2. ✓ Voir message d'intro unique
3. ✓ Question 1 apparaît après 1.5s
4. Répondre → ✓ Feedback → ✓ Question 2 après 2s

### Test 2: Réponse Multiple Bloquée
1. Répondre à Question 1
2. Essayer de taper une autre réponse avant Question 2
3. ✓ Voir message d'avertissement
4. ✓ Question 2 se charge quand même

### Test 3: Reprise Après Fermeture
1. Répondre aux Questions 1-3
2. Fermer l'onglet
3. Revenir sur le chapitre
4. ✓ Historique rechargé
5. ✓ Question 4 se charge automatiquement

### Test 4: Changement de Chapitre
1. Commencer Chapitre A (Q1-Q2)
2. Aller sur Chapitre B (Q1)
3. Revenir sur Chapitre A
4. ✓ Reprend à Q3 (pas Q1)

### Test 5: MCQ vs Ouverte
1. Questions 1-3 (MCQ) → ✓ Feedback instantané A/B/C/D
2. Questions 4-5 (Ouverte) → ✓ Feedback IA avec explication

---

## 🐛 Problèmes Résolus

### ✅ Problème 1: Erreur ReferenceError dans /api/translate/content
**Cause :** Variables destructurées dans try non accessibles dans catch
**Solution :** Déclaration en dehors du try-catch

### ✅ Problème 2: Réponses multiples à la même question
**Cause :** Pas de vérification avant évaluation
**Solution :** Vérifier `chapter_progress.answers[]` avant d'accepter réponse

### ✅ Problème 3: Reprise incorrecte après changement de page
**Cause :** Logique complexe basée sur recherche de texte dans messages
**Solution :** Logique simplifiée basée sur dernier message + current_question

### ✅ Problème 4: Messages d'intro multiples
**Cause :** Plusieurs conditions ajoutaient des messages
**Solution :** Un seul message d'intro qui explique tout

---

## 📝 Prochaines Améliorations Possibles

1. **Animation de transition** entre questions
2. **Récapitulatif de fin de chapitre** avec détails de chaque réponse
3. **Mode révision** permettant de revoir les questions (sans modifier le score)
4. **Explications enrichies** avec liens vers le contenu source
5. **Timer optionnel** par question pour challenges

---

**Dernière mise à jour :** 2025-11-18
**Auteur :** Claude Code Assistant
