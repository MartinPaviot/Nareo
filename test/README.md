# Test Directory

Ce dossier centralise tous les fichiers et scripts de test pour le projet LevelUp.

## Structure

```
test/
├── files/          # Fichiers de test (PDF, DOCX, images, etc.)
├── scripts/        # Scripts de test automatisés
└── README.md       # Ce fichier
```

## Fichiers de Test (`/test/files`)

Les fichiers de test sont utilisés pour valider les fonctionnalités d'upload et d'extraction de texte.

**Fichiers actuels :**
- `Beginner's guide - Cities_ Skylines Wiki.pdf` - Test PDF standard
- `Philosophy 101_...pdf` - Test PDF de philosophie
- `Projet bac à sable.pdf` - Test PDF en français
- `philosophie (dragged).pdf` - Test PDF corrompu (fallback Vision OCR)
- `Presentation Alter coloc Nov2024.docx` - Test DOCX

### Ajouter un nouveau fichier de test

1. Placez votre fichier dans le dossier `test/files/`
2. Assurez-vous qu'il s'agit d'un des formats supportés :
   - PDF (`.pdf`)
   - Word (`.docx`)
   - Images (`.png`, `.jpg`, `.jpeg`)

3. Si vous souhaitez l'ajouter à un script de test automatisé, mettez à jour le tableau `TEST_FILES` dans le script correspondant

## Scripts de Test (`/test/scripts`)

### Scripts TypeScript

**`test-pdf-readability.ts`**
- Teste l'extraction de texte avec scoring de lisibilité
- Teste le fallback Vision OCR pour PDFs corrompus
- Usage : `npx ts-node test/scripts/test-pdf-readability.ts`

**`test-upload-robustness.ts`**
- Teste la robustesse du système d'upload
- Valide l'extraction de texte pour PDF et DOCX
- Usage : `npx ts-node test/scripts/test-upload-robustness.ts`

### Scripts PowerShell

**`test-pdf-vision.ps1`**
- Test complet de l'API d'upload avec Vision OCR
- Vérifie la présence des fichiers de test
- Teste l'upload via l'API REST
- Usage : `.\test\scripts\test-pdf-vision.ps1`

**`test-all-endpoints.ps1`**
- Teste tous les endpoints de l'API
- Usage : `.\test\scripts\test-all-endpoints.ps1`

**`test-user-isolation.ps1`**
- Teste l'isolation des données utilisateurs
- Usage : `.\test\scripts\test-user-isolation.ps1`

**`test-study-plan-api.ps1`**
- Teste l'API de génération de plans d'étude
- Usage : `.\test\scripts\test-study-plan-api.ps1`

**`test-document-upload.ps1`**
- Teste l'upload de documents
- Usage : `.\test\scripts\test-document-upload.ps1`

### Scripts Bash

**`test-api.sh`**
- Tests généraux de l'API
- Usage : `./test/scripts/test-api.sh`

**`test-document-upload.sh`**
- Version bash du test d'upload de documents
- Usage : `./test/scripts/test-document-upload.sh`

**`test-image-extraction.sh`**
- Teste l'extraction de texte depuis les images
- Usage : `./test/scripts/test-image-extraction.sh`

**`test-upload-api.sh`**
- Teste l'API d'upload
- Usage : `./test/scripts/test-upload-api.sh`

### Autres Fichiers de Test

- `test-api-key.js` - Test de validation des clés API
- `test-upload.js` - Test JavaScript d'upload
- `test-course.txt` - Fichier texte de test
- `test-ml-image.html` - Page HTML de test pour extraction ML d'images
- `test-sample.pdf` - PDF d'exemple simple

## Exécution des Tests

### Prérequis

1. Assurez-vous que le serveur de développement est lancé :
   ```bash
   npm run dev
   ```

2. Vérifiez que les variables d'environnement sont configurées dans `.env.local`

### Tests TypeScript

```bash
# Depuis la racine du projet
npx ts-node test/scripts/test-pdf-readability.ts
npx ts-node test/scripts/test-upload-robustness.ts
```

### Tests PowerShell

```powershell
# Depuis la racine du projet
.\test\scripts\test-pdf-vision.ps1
.\test\scripts\test-all-endpoints.ps1
.\test\scripts\test-user-isolation.ps1
```

### Tests Bash

```bash
# Depuis la racine du projet
./test/scripts/test-api.sh
./test/scripts/test-document-upload.sh
./test/scripts/test-image-extraction.sh
```

## Bonnes Pratiques

1. **Ne jamais commiter de données sensibles** dans les fichiers de test
2. **Documenter les fichiers de test** : ajouter un commentaire expliquant l'objectif du fichier
3. **Nettoyer régulièrement** : supprimer les fichiers de test obsolètes
4. **Nommer clairement** : utiliser des noms descriptifs (ex: `test-corrupted-pdf.pdf`)
5. **Garder les fichiers légers** : préférer des fichiers de petite taille pour les tests

## Ajout d'un Nouveau Script de Test

1. Créez votre script dans `test/scripts/`
2. Nommez-le avec le préfixe `test-` (ex: `test-new-feature.ts`)
3. Utilisez les chemins relatifs depuis la racine du projet :
   - Fichiers de test : `test/files/`
   - Imports lib : `../../lib/` (depuis `test/scripts/`)
4. Documentez l'usage dans ce README
5. Ajoutez des commentaires explicatifs dans le script

## Notes

- Tous les chemins dans les scripts doivent pointer vers `test/files/` au lieu de `public/test_files/`
- Les scripts TypeScript utilisent des imports relatifs : `../../lib/` depuis `test/scripts/`
- Le dossier `/test` est exclu du build de production
- Les fichiers de test ne sont pas exposés publiquement via l'URL
