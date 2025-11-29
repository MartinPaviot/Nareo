# Configuration Supabase Realtime pour Aristo'Chat

## ✅ Modifications effectuées

### 1. Hook `useCourseChapters` mis à jour
- **Fichier**: [hooks/useCourseChapters.ts](hooks/useCourseChapters.ts)
- **Changements**:
  - Ajout de Supabase Realtime pour écouter les changements sur la table `chapters`
  - Fallback automatique vers polling si Realtime échoue
  - Nettoyage correct des abonnements lors du démontage du composant

### 2. Page cours mise à jour
- **Fichier**: [app/courses/[courseId]/learn/page.tsx](app/courses/[courseId]/learn/page.tsx)
- **Changements**:
  - Utilisation du nouveau paramètre `isListening` pour afficher l'état de connexion Realtime
  - Affichage "Listening for updates..." quand Realtime est actif
  - Affichage "Checking for updates..." quand le fallback polling est actif

## 🔧 Configuration Supabase requise

Pour que Realtime fonctionne, vous devez activer les publications Realtime sur la table `chapters` dans Supabase.

### Étapes dans le Dashboard Supabase :

1. Allez dans **Database** → **Replication**
2. Trouvez la table `chapters` dans la liste
3. Activez **Realtime** pour cette table
4. Les événements à activer :
   - ✅ INSERT
   - ✅ UPDATE
   - ✅ DELETE

### Ou via SQL :

```sql
-- Activer Realtime sur la table chapters
ALTER PUBLICATION supabase_realtime ADD TABLE chapters;
```

### Vérifier que Realtime est activé :

```sql
-- Voir toutes les tables avec Realtime activé
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

## 🧪 Comment tester

### Test 1 : Vérifier l'abonnement Realtime
1. Uploadez un PDF pour créer un nouveau cours
2. Allez sur la page du cours
3. Ouvrez la console du navigateur (F12)
4. Vous devriez voir :
   ```
   Realtime subscription status: SUBSCRIBED
   ```

### Test 2 : Vérifier le chargement automatique
1. Uploadez un PDF
2. Restez sur la page du cours (ne rafraîchissez pas !)
3. Attendez que le job backend génère les chapitres
4. Les chapitres devraient apparaître **automatiquement** dès qu'ils sont créés en base
5. Dans la console, vous devriez voir :
   ```
   Chapter change detected: {eventType: "INSERT", ...}
   ```

### Test 3 : Vérifier le fallback polling
Si Realtime échoue, le système bascule automatiquement en mode polling :
- Le message affiche "Checking for updates..." au lieu de "Listening for updates..."
- Les chapitres se chargent toutes les 3 secondes au lieu d'instantanément

## 🎯 Avantages de cette solution

### ✅ Supabase Realtime (mode par défaut)
- **Instantané** : Les chapitres apparaissent immédiatement (< 1 seconde)
- **Économique** : Pas de requêtes répétées, juste une connexion WebSocket
- **Scalable** : Supporte des milliers d'utilisateurs simultanés
- **Fiable** : Fallback automatique vers polling si problème

### 🔄 Polling (mode fallback)
- Active automatiquement si Realtime échoue
- Vérifie toutes les 3 secondes
- Arrête automatiquement quand des chapitres existent

## 🧹 Gestion de la mémoire

Le hook nettoie automatiquement :
- ✅ Les abonnements Realtime lors du démontage du composant
- ✅ Les intervalles de polling
- ✅ Pas de fuites de mémoire

## 📝 Notes techniques

### Pourquoi Realtime plutôt que polling ?

**Avant** (polling) :
- Requête toutes les 3 secondes même sans changement
- Latence de 0-3 secondes avant de voir les chapitres
- Charge serveur proportionnelle au nombre d'utilisateurs

**Après** (Realtime) :
- Connexion WebSocket unique
- Latence < 1 seconde
- Charge serveur minimale

### Configuration du hook

Vous pouvez personnaliser le comportement :

```typescript
// Mode Realtime (par défaut)
const { chapters, isListening } = useCourseChapters({
  courseId,
  useRealtime: true
});

// Mode polling uniquement
const { chapters, isPolling } = useCourseChapters({
  courseId,
  useRealtime: false,
  pollingInterval: 2000 // 2 secondes
});
```

## 🐛 Débogage

Si les chapitres n'apparaissent pas automatiquement :

1. **Vérifier la console navigateur** :
   - Y a-t-il des erreurs Supabase ?
   - Le statut de l'abonnement est-il "SUBSCRIBED" ?

2. **Vérifier Realtime dans Supabase** :
   - La table `chapters` a-t-elle Realtime activé ?
   - Les RLS (Row Level Security) bloquent-elles les événements ?

3. **Vérifier le backend** :
   - Le job créé-t-il bien les chapitres en base ?
   - Le `course_id` est-il correct ?

4. **Mode fallback** :
   - Si "Checking for updates..." s'affiche, Realtime a échoué
   - Les chapitres se chargeront quand même, mais toutes les 3 secondes

## 🔐 Sécurité

Les abonnements Realtime respectent automatiquement les Row Level Security (RLS) policies de Supabase. Assurez-vous que vos policies permettent :

```sql
-- Exemple de policy pour permettre la lecture des chapitres
CREATE POLICY "Users can view chapters of their courses"
ON chapters FOR SELECT
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM courses
    WHERE courses.id = chapters.course_id
    AND courses.is_public = true
  )
);
```
