type LocalizableQuest = { title: string; description: string | null; titleEn?: string | null; descriptionEn?: string | null }

/** Quest copy for the UI language. English falls back to the Thai text when no translation was entered. */
export function questText(quest: LocalizableQuest, language: 'th' | 'en') {
  if (language === 'en') {
    return { title: quest.titleEn?.trim() || quest.title, description: quest.descriptionEn?.trim() || quest.description }
  }
  return { title: quest.title, description: quest.description }
}
