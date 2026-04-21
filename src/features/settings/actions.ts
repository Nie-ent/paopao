"use server"

import prisma from "@/lib/db"
import { getUser } from "@/features/auth/actions"

export async function getUserSettings() {
  const user = await getUser()
  if (!user) return { error: 'Unauthorized', data: null }

  let lineId = "U9f4477a859862ce8589b09e879ec068c"
  if (user.app_metadata?.provider === "line") {
    lineId = (user as any).user_metadata.provider_id
  }

  const prismaUser = await prisma.user.findUnique({
    where: { lineId },
    select: { salaryDeduction: true, freelanceTaxRate: true }
  })

  return { data: prismaUser }
}

export async function updateDeductionSettings(formData: FormData) {
  const user = await getUser()
  if (!user) return { error: 'Unauthorized' }

  let lineId = "U9f4477a859862ce8589b09e879ec068c"
  if (user.app_metadata?.provider === "line") {
    lineId = (user as any).user_metadata.provider_id
  }

  const salaryDeduction = Number(formData.get('salaryDeduction') || 0)
  const freelanceTaxRate = Number(formData.get('freelanceTaxRate') || 0)

  try {
    await prisma.user.update({
      where: { lineId },
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
