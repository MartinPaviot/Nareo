# Guide de Test - Traduction du Header de Chapitre

## Prérequis
✅ Serveur de développement démarré sur http://localhost:3000

## Tests à Effectuer

### Test 1: Upload et Création de Chapitres avec Traductions

**Étapes:**
1. Ouvrir http://localhost:3000 dans le navigateur
2. Uploader une image ou un document (PDF/DOCX)
3. Attendre la création des chapitres

**Vérifications:**
- [ ] 3 chapitres sont créés (easy, medium, hard)
- [ ] Redirection automatique vers le premier chapitre
- [ ] Vérifier dans la console du navigateur les logs:
  - `🌐 Translating chapter 1 to French...`
  - `✅ Chapter 1 translated to French`
  - (Répété pour les chapitres 2 et 3)

**Résultat Attendu:**
- Chapitres créés avec succès
- Traductions françaises générées automatiquement
- Pas d'erreurs dans la console

---

### Test 2: Affichage du Header en Anglais (Par Défaut)

**Étapes:**
1. Après l'upload, vous êtes sur la page du chapitre
2. Vérifier que le toggle de langue est sur "EN" (coin supérieur droit)
3. Observer le header de la page (titre et description sous le titre)

**Vérifications:**
- [ ] Le titre du chapitre est en anglais
- [ ] La description sous le titre est en anglais
- [ ] Le reste de la page fonctionne normalement
- [ ] L'avatar Aristo est visible
- [ ] Le message d'Aristo est visible

**Exemple de Titre Attendu (EN):**
- "Customer and Virtual Market"
- "Marketing Fundamentals"
- "Business Strategy"

---

### Test 3: Basculement vers le Français

**Étapes:**
1. Sur la page du chapitre, cliquer sur le toggle "FR" en haut à droite
2. Observer le changement immédiat du header

**Vérifications:**
- [ ] Le titre passe immédiatement en français (sans rechargement de page)
- [ ] La description passe immédiatement en français
- [ ] Le toggle affiche maintenant "FR" comme actif
- [ ] Le message d'Aristo est en français
- [ ] Le bouton "Commencer l'apprentissage" est en français
- [ ] Les autres éléments de la page sont en français

**Exemple de Titre Attendu (FR):**
- "Client et Marché Virtuel"
- "Fondamentaux du Marketing"
- "Stratégie d'Entreprise"

**Performance:**
- [ ] Le changement est instantané (< 100ms)
- [ ] Pas de scintillement ou de rechargement de page
- [ ] Transition fluide

---

### Test 4: Basculement Retour vers l'Anglais

**Étapes:**
1. Avec la page en français, cliquer sur le toggle "EN"
2. Observer le changement

**Vérifications:**
- [ ] Le titre repasse en anglais immédiatement
- [ ] La description repasse en anglais
- [ ] Le toggle affiche "EN" comme actif
- [ ] Tous les éléments UI repassent en anglais
- [ ] Pas de rechargement de page

---

### Test 5: Vérification sur les 3 Chapitres

**Étapes:**
1. Naviguer vers le dashboard ou la liste des chapitres
2. Ouvrir le chapitre 1 (Easy)
3. Tester le basculement FR/EN
4. Répéter pour le chapitre 2 (Medium)
5. Répéter pour le chapitre 3 (Hard)

**Vérifications pour Chaque Chapitre:**
- [ ] Chapitre 1 (Easy): Titre et description changent avec la langue
- [ ] Chapitre 2 (Medium): Titre et description changent avec la langue
- [ ] Chapitre 3 (Hard): Titre et description changent avec la langue
- [ ] Tous les chapitres répondent instantanément au toggle
- [ ] Pas d'erreurs dans la console pour aucun chapitre

---

### Test 6: Tests API - Endpoint `/api/chapters/[id]`

**Test avec curl:**
```bash
# Remplacer [CHAPTER_ID] par l'ID réel d'un chapitre
curl http://localhost:3000/api/chapters/[CHAPTER_ID]
```

**Vérifications dans la Réponse JSON:**
- [ ] Champ `englishTitle` présent et non vide
- [ ] Champ `englishDescription` présent et non vide
- [ ] Champ `frenchTitle` présent et non vide
- [ ] Champ `frenchDescription` présent et non vide
- [ ] Champs `title` et `summary` présents (backward compatibility)
- [ ] `frenchTitle` est différent de `englishTitle`
- [ ] `frenchDescription` est différent de `englishDescription`

**Exemple de Réponse Attendue:**
```json
{
  "id": "abc123",
  "title": "Customer and Virtual Market",
  "summary": "A customer is the person...",
  "englishTitle": "Customer and Virtual Market",
  "englishDescription": "A customer is the person who makes the buying decision...",
  "frenchTitle": "Client et Marché Virtuel",
  "frenchDescription": "Un client est la personne qui prend la décision d'achat...",
  "difficulty": "easy",
  "orderIndex": 0,
  "questions": [...],
  "concepts": [...]
}
```

---

### Test 7: Tests de Régression

#### 7.1 Dashboard
**Étapes:**
1. Naviguer vers http://localhost:3000/dashboard
2. Vérifier l'affichage des chapitres

**Vérifications:**
- [ ] Les chapitres s'affichent correctement
- [ ] Les cartes de chapitres sont cliquables
- [ ] La navigation vers les chapitres fonctionne
- [ ] Pas d'erreurs dans la console

#### 7.2 Page d'Accueil
**Étapes:**
1. Naviguer vers http://localhost:3000
2. Tester l'upload d'une nouvelle image

**Vérifications:**
- [ ] L'upload fonctionne toujours
- [ ] La création de chapitres fonctionne
- [ ] Pas de régression sur le processus d'upload

#### 7.3 Page Learn
**Étapes:**
1. Depuis un chapitre, cliquer sur "Commencer l'apprentissage"
2. Vérifier que la page learn s'ouvre

**Vérifications:**
- [ ] La page learn s'ouvre correctement
- [ ] Les questions s'affichent
- [ ] Le système de points fonctionne
- [ ] Pas d'erreurs liées aux nouvelles modifications

#### 7.4 Navigation Générale
**Vérifications:**
- [ ] Le menu de navigation fonctionne
- [ ] Le bouton de déconnexion fonctionne (si applicable)
- [ ] Le toggle de langue fonctionne sur toutes les pages
- [ ] Pas de liens cassés

---

### Test 8: Tests de Performance et Console

**Vérifications:**
1. **Console du Navigateur:**
   - [ ] Pas d'erreurs JavaScript
   - [ ] Pas d'avertissements critiques
   - [ ] Les logs de traduction apparaissent lors de l'upload

2. **Performance:**
   - [ ] Le changement de langue est instantané
   - [ ] Pas de lag lors du basculement FR/EN
   - [ ] Le chargement initial de la page est rapide

3. **Mémoire:**
   - [ ] Pas de fuite mémoire lors des basculements répétés
   - [ ] L'application reste réactive après plusieurs changements

---

## Scénarios de Test Avancés

### Scénario A: Basculement Rapide
1. Basculer rapidement entre FR et EN plusieurs fois (10x)
2. Vérifier que l'affichage reste cohérent
3. Vérifier qu'il n'y a pas d'erreurs

### Scénario B: Rafraîchissement de Page
1. Mettre la langue sur FR
2. Rafraîchir la page (F5)
3. Vérifier que la langue FR est conservée
4. Vérifier que le header s'affiche en français

### Scénario C: Navigation Entre Chapitres
1. Ouvrir le chapitre 1 en FR
2. Naviguer vers le chapitre 2
3. Vérifier que la langue FR est conservée
4. Vérifier que le header du chapitre 2 est en français

---

## Checklist Finale

### Fonctionnalités Principales
- [ ] Upload et création de chapitres avec traductions
- [ ] Affichage en anglais par défaut
- [ ] Basculement vers français fonctionne
- [ ] Basculement vers anglais fonctionne
- [ ] Fonctionne sur les 3 chapitres

### API
- [ ] Endpoint retourne les champs bilingues
- [ ] Les traductions sont différentes de l'original
- [ ] Backward compatibility maintenue

### Régression
- [ ] Dashboard fonctionne
- [ ] Page d'accueil fonctionne
- [ ] Page learn fonctionne
- [ ] Navigation générale fonctionne

### Performance
- [ ] Changement de langue instantané
- [ ] Pas d'erreurs console
- [ ] Application reste réactive

---

## Résolution de Problèmes

### Si le header ne change pas de langue:
1. Vérifier que `currentLanguage` est bien importé dans le composant
2. Vérifier la console pour des erreurs
3. Vérifier que les champs `frenchTitle` et `frenchDescription` existent dans les données

### Si la traduction n'est pas générée lors de l'upload:
1. Vérifier que l'API OpenAI est configurée (clé API)
2. Vérifier les logs de console pour les erreurs de traduction
3. Vérifier que l'endpoint `/api/translate/content` fonctionne

### Si les chapitres existants ne fonctionnent pas:
- Les chapitres créés avant cette mise à jour n'ont pas de traductions
- Solution: Re-uploader l'image/document pour créer de nouveaux chapitres

---

## Conclusion

Une fois tous les tests passés avec succès, la fonctionnalité de traduction du header de chapitre est validée et prête pour la production.
