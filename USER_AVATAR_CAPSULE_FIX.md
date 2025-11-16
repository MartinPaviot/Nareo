# Fix: Capsule Bleue "You" - Guide de Dépannage

## Problème
La capsule bleue "You" n'apparaît pas stylisée - seul le texte "You" est visible sans le fond bleu.

## Solution

### Étape 1: Redémarrer le serveur de développement
Le CSS personnalisé nécessite parfois un redémarrage complet du serveur Next.js.

```bash
# Arrêter le serveur (Ctrl+C dans le terminal)
# Puis relancer:
npm run dev
```

### Étape 2: Vider le cache du navigateur
Après le redémarrage, rafraîchir la page avec:
- **Windows/Linux**: `Ctrl + Shift + R` ou `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

### Étape 3: Vérifier que les fichiers sont corrects

#### ✅ components/chat/UserMessageBubble.tsx
Le composant doit contenir:
```tsx
{/* User Avatar - Blue Capsule */}
<div className="flex-shrink-0">
  <div className="user-avatar-capsule">
    You
  </div>
</div>
```

#### ✅ app/globals.css
Les styles doivent être présents au début du fichier:
```css
/* User Avatar Capsule - Blue pill design */
.user-avatar-capsule {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 9999px;
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  animation: capsuleFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  transition: transform 0.2s ease;
}
```

## Résultat Attendu
Après le redémarrage, vous devriez voir:
- ✅ Une capsule bleue avec dégradé
- ✅ Le texte "You" en blanc, centré
- ✅ Forme de pilule avec coins arrondis
- ✅ Animation douce au chargement
- ✅ Effet hover (légère augmentation de taille)

## Si le problème persiste

### Option 1: Rebuild complet
```bash
# Supprimer le cache Next.js
rm -rf .next

# Réinstaller les dépendances (si nécessaire)
npm install

# Relancer
npm run dev
```

### Option 2: Vérifier la configuration Tailwind
Assurez-vous que `tailwind.config.ts` permet les classes personnalisées.

### Option 3: Utiliser des classes Tailwind inline
Si le CSS personnalisé ne fonctionne toujours pas, on peut utiliser uniquement des classes Tailwind:

```tsx
<div className="inline-flex items-center justify-center h-8 px-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full text-white text-sm font-semibold tracking-wide animate-in fade-in duration-400">
  You
</div>
```

## Contact
Si le problème persiste après ces étapes, faites-moi savoir et je proposerai une solution alternative!
