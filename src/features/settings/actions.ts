"use server"

import prisma from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"
import { suggestPayday } from "@/lib/pay-cycle"

export async function updateCategoryColors(categoryColors: Record<string, string>) {
  const prismaUser = await getCurrentUser()
  if (!prismaUser) return { error: 'Unauthorized' }

  try {

    // This is a simplified migration approach: 
    // We update existing categories or create them if they don't exist.
    // For a full relational refactor, the frontend should send full Category objects.
    const existingCats = await prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId: prismaUser.id }] }
    });

    const entries = Object.entries(categoryColors ?? {})
    const valid = (name: string, color: unknown) => typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) && name.trim().length > 0 && name.length <= 40
    if (entries.length > 200 || !entries.every(([name, color]) => valid(name, color))) return { error: 'Invalid colors' }
    let customCount = existingCats.filter(c => c.userId === prismaUser.id).length

    for (const [name, color] of entries) {
      const match = existingCats.find(c => c.name === name);
      if (match) {
        // Can only update if it belongs to user
        if (match.userId === prismaUser.id) {
           await prisma.category.update({
             where: { id: match.id },
             data: { color }
           });
        }
      } else {
        if (customCount >= 50) continue
        customCount++
        await prisma.category.create({
          data: {
            name,
            color,
            type: 'EXPENSE', // default assumption
            userId: prismaUser.id
          }
        });
      }
    }
    
    return { success: true }
  } catch (error) {
    console.error("Failed to update category colors:", error)
    return { error: 'Failed to save colors' }
  }
}

export async function getCategoryColors() {
  const prismaUser = await getCurrentUser()
  if (!prismaUser) return { error: 'Unauthorized', categoryColors: {} }

  try {

    const categories = await prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId: prismaUser.id }] }
    })
    
    const parsedColors: Record<string, string> = {}
    categories.forEach(c => parsedColors[c.name] = c.color)

    return { success: true, categoryColors: parsedColors }
  } catch (error) {
    console.error("Failed to fetch category colors:", error)
    return { error: 'Failed to fetch colors', categoryColors: {} }
  }
}


const BRIEF_FREQUENCIES = ["WEEKLY", "DAILY", "OFF"] as const

/** How often Pro users get their LINE summary (src/lib/brief.ts). */
export async function setBriefFrequency(frequency: string) {
  const user = await getCurrentUser()
  if (!user) return { error: "Unauthorized" }
  if (!BRIEF_FREQUENCIES.includes(frequency as (typeof BRIEF_FREQUENCIES)[number])) return { error: "Invalid" }
  await prisma.user.update({ where: { id: user.id }, data: { briefFrequency: frequency as (typeof BRIEF_FREQUENCIES)[number] } })
  return { success: true }
}

/** Sets the day the user is paid (1–31), or null for calendar months (src/lib/pay-cycle.ts). */
export async function setPayday(day: number | null) {
  const user = await getCurrentUser()
  if (!user) return { error: "Unauthorized" }
  if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) return { error: "Invalid" }
  await prisma.user.update({ where: { id: user.id }, data: { payday: day === 1 ? null : day } })
  return { success: true }
}

/** The user's payday and, when none is set, the day their salary history suggests. */
export async function getPaydaySetting() {
  const user = await getCurrentUser()
  if (!user) return null
  if (user.payday) return { payday: user.payday, suggested: null }
  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
  const incomes = await prisma.transaction.findMany({ where: { userId: user.id, type: "INCOME", date: { gte: since } }, select: { date: true, amount: true } })
  return { payday: null, suggested: suggestPayday(incomes) }
}
