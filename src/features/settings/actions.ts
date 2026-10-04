"use server"

import prisma from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"

export async function getUserSettings() {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', data: null }

  return { data: { salaryDeduction: user.salaryDeduction, freelanceTaxRate: user.freelanceTaxRate } }
}

export async function updateDeductionSettings(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized' }

  const salaryDeduction = Number(formData.get('salaryDeduction') || 0)
  const freelanceTaxRate = Number(formData.get('freelanceTaxRate') || 0)

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        salaryDeduction,
        freelanceTaxRate
      }
    })
    return { success: true }
  } catch (error) {
    console.error("Failed to update deduction settings:", error)
    return { error: 'Failed to save settings' }
  }
}

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

    for (const [name, color] of Object.entries(categoryColors)) {
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

