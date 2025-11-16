# Chapter Header Translation Fix - TODO

## Problem
The chapter page header (title and description) always displays in English even when the language toggle is set to FR.

## Implementation Steps

- [x] 1. Update Chapter interface in `lib/memory-store.ts`
  - [x] Add englishTitle, englishDescription, frenchTitle, frenchDescription fields

- [x] 2. Update ChapterData type in `types/concept.types.ts`
  - [x] Add bilingual fields to the interface

- [x] 3. Update chapter creation in `app/api/upload/route.ts`
  - [x] Translate chapter titles and summaries to French during creation
  - [x] Store both English and French versions

- [x] 4. Update chapter API in `app/api/chapters/[id]/route.ts`
  - [x] Return both language versions in the response

- [x] 5. Update chapter page in `app/chapter/[id]/page.tsx`
  - [x] Use currentLanguage from useLanguage() context
  - [x] Display appropriate title/description based on language
  - [x] Header text now updates based on currentLanguage

## Testing
- [ ] Test with new chapter upload
- [ ] Verify French translation displays correctly
- [ ] Verify language toggle switches header text immediately
- [ ] Test with all 3 chapters (easy, medium, hard)

## Status
✅ Implementation Complete - Ready for Testing

## Notes
- The language switching happens automatically when the user toggles between FR/EN
- The LanguageContext's currentLanguage is used to determine which version to display
- Both English and French versions are stored during chapter creation
- Translation happens during upload using the existing /api/translate/content endpoint
- Backward compatibility maintained with existing title/summary fields
