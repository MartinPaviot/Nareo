# Debug du Widget de Feedback

## Problème : Le widget n'apparaît pas

### Causes Possibles

1. **localStorage a enregistré la fermeture**
   - Le widget a été fermé précédemment et le flag est toujours actif

2. **Erreur de chargement de l'image**
   - L'image `Happy.png` n'existe pas ou le chemin est incorrect

3. **Erreur JavaScript dans la console**
   - Vérifier la console du navigateur pour des erreurs

---

## Solutions de Débogage

### 1. Réinitialiser le localStorage

Ouvrez la console du navigateur (F12) et exécutez :

```javascript
localStorage.removeItem('hideFeedbackWidget');
location.reload();
```

### 2. Vérifier si le widget est masqué

Dans la console :

```javascript
console.log('Widget hidden?', localStorage.getItem('hideFeedbackWidget'));
```

Si cela retourne `"1"`, le widget est masqué. Utilisez la commande du point 1 pour le réinitialiser.

### 3. Forcer l'affichage du widget (temporaire)

Modifiez temporairement `FeedbackWidget.tsx` pour ignorer le localStorage :

```tsx
useEffect(() => {
  // TEMPORAIRE - Ignorer localStorage pour debug
  // const hideFeedback = localStorage.getItem('hideFeedbackWidget');
  
  // if (!hideFeedback) {
    setIsVisible(false);
    setIsClosing(false);
    
    setTimeout(() => {
      setIsVisible(true);
    }, 1000);
  // }
}, [pathname]);
```

### 4. Vérifier l'image Happy.png

Assurez-vous que le fichier existe :
- Chemin : `public/chat/Happy.png`
- Le fichier doit être accessible via : `http://localhost:3000/chat/Happy.png`

### 5. Vérifier les erreurs dans la console

1. Ouvrez les DevTools (F12)
2. Allez dans l'onglet "Console"
3. Rechargez la page
4. Cherchez des erreurs en rouge

---

## Test Rapide

Exécutez ces commandes dans la console du navigateur :

```javascript
// 1. Nettoyer le localStorage
localStorage.clear();

// 2. Recharger la page
location.reload();
```

Le widget devrait apparaître après 1 seconde.

---

## Si le problème persiste

Vérifiez que :
1. ✅ Le serveur de développement est en cours d'exécution (`npm run dev`)
2. ✅ Aucune erreur dans le terminal
3. ✅ Le fichier `Happy.png` existe dans `public/chat/`
4. ✅ Le navigateur n'a pas de cache problématique (Ctrl+Shift+R pour hard refresh)

---

## Commande de Test Complète

```javascript
// Dans la console du navigateur
(function() {
  console.log('=== DEBUG FEEDBACK WIDGET ===');
  console.log('localStorage hideFeedbackWidget:', localStorage.getItem('hideFeedbackWidget'));
  console.log('Pathname:', window.location.pathname);
  console.log('Clearing localStorage...');
  localStorage.removeItem('hideFeedbackWidget');
  console.log('Reloading page...');
  setTimeout(() => location.reload(), 500);
})();
```

Copiez-collez cette fonction complète dans la console et appuyez sur Entrée.
