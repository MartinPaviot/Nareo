-- Migration: Remove "Acte x :" prefix from blog article section titles
-- This updates the content to show only the section titles without the "Acte" prefix

-- Update Article 1: Active Recall
UPDATE blog_articles
SET
    content_fr = REPLACE(REPLACE(REPLACE(content_fr, '## Acte 1 : ', '## '), '## Acte 2 : ', '## '), '## Acte 3 : ', '## '),
    content_en = REPLACE(REPLACE(REPLACE(content_en, '## Act 1: ', '## '), '## Act 2: ', '## '), '## Act 3: ', '## '),
    content_de = REPLACE(REPLACE(REPLACE(content_de, '## Akt 1: ', '## '), '## Akt 2: ', '## '), '## Akt 3: ', '## ')
WHERE slug = 'active-recall-methode-revision-efficace';

-- Update Article 2: Répétition Espacée
UPDATE blog_articles
SET
    content_fr = REPLACE(REPLACE(REPLACE(content_fr, '## Acte 1 : ', '## '), '## Acte 2 : ', '## '), '## Acte 3 : ', '## '),
    content_en = REPLACE(REPLACE(REPLACE(content_en, '## Act 1: ', '## '), '## Act 2: ', '## '), '## Act 3: ', '## '),
    content_de = REPLACE(REPLACE(REPLACE(content_de, '## Akt 1: ', '## '), '## Akt 2: ', '## '), '## Akt 3: ', '## ')
WHERE slug = 'repetition-espacee-memoriser-long-terme';

-- Update Article 3: Technique Pomodoro
UPDATE blog_articles
SET
    content_fr = REPLACE(REPLACE(REPLACE(content_fr, '## Acte 1 : ', '## '), '## Acte 2 : ', '## '), '## Acte 3 : ', '## '),
    content_en = REPLACE(REPLACE(REPLACE(content_en, '## Act 1: ', '## '), '## Act 2: ', '## '), '## Act 3: ', '## '),
    content_de = REPLACE(REPLACE(REPLACE(content_de, '## Akt 1: ', '## '), '## Akt 2: ', '## '), '## Akt 3: ', '## ')
WHERE slug = 'technique-pomodoro-rester-concentre';
