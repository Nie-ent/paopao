type Language = 'th' | 'en'

/** English text when the UI is English and a translation was entered, otherwise the Thai text. */
function pick(thai: string, english: string | null | undefined, language: Language): string
function pick(thai: string | null, english: string | null | undefined, language: Language): string | null
function pick(thai: string | null, english: string | null | undefined, language: Language) {
  return (language === 'en' && english?.trim()) || thai
}

type LocalizableQuest = { title: string; description: string | null; titleEn?: string | null; descriptionEn?: string | null }

/** Quest copy for the UI language. */
export function questText(quest: LocalizableQuest, language: Language) {
  return { title: pick(quest.title, quest.titleEn, language), description: pick(quest.description, quest.descriptionEn, language) }
}

type LocalizableReward = { name: string; description: string | null; nameEn?: string | null; descriptionEn?: string | null }

/** Reward copy for the UI language. */
export function rewardText(reward: LocalizableReward, language: Language) {
  return { name: pick(reward.name, reward.nameEn, language), description: pick(reward.description, reward.descriptionEn, language) }
}
