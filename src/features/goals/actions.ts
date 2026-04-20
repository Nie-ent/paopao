"use server"

import prisma from "@/lib/db"
import { getUser } from "@/features/auth/actions"

export async function getGoals() {
  const user = await getUser()
  if (!user) return { error: 'Unauthorized', data: [] }

  let lineId = "U9f4477a859862ce8589b09e879ec068c"
  if (user.app_metadata?.provider === "line") {
    lineId = (user as any).user_metadata.provider_id
  }

  const prismaUser = await prisma.user.findUnique({ where: { lineId } })
  if (!prismaUser) return { error: 'User not found', data: [] }

  const goals = await prisma.goal.findMany({
    where: { userId: prismaUser.id },
    orderBy: { deadline: 'asc' }
  })

  // Ensure default demo goals exist if empty
  if (goals.length === 0) {
    const demoGoals = await prisma.$transaction([
      prisma.goal.create({
        data: {
          userId: prismaUser.id,
          title: "New MacBook Pro",
          targetAmount: 85000,
          currentAmount: 20000,
          deadline: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        }
      }),
      prisma.goal.create({
        data: {
          userId: prismaUser.id,
          title: "Emergency Fund",
          targetAmount: 100000,
          currentAmount: 85000,
          deadline: new Date(new Date().setFullYear(new Date().getFullYear() + 2))
        }
      })
    ])
    return { data: demoGoals }
  }

  return { data: goals }
}

export async function createGoal(formData: FormData) {
  const user = await getUser()
  if (!user) return { error: 'Unauthorized' }

  let lineId = "U9f4477a859862ce8589b09e879ec068c"
  if (user.app_metadata?.provider === "line") {
    lineId = (user as any).user_metadata.provider_id
  }

  const prismaUser = await prisma.user.findUnique({ where: { lineId } })
  if (!prismaUser) return { error: 'User not found' }

  const title = formData.get('title') as string
  const targetAmount = Number(formData.get('targetAmount'))
  const deadlineStr = formData.get('deadline') as string
  
  if (!title || !targetAmount) return { error: 'Missing required fields' }

  await prisma.goal.create({
    data: {
      userId: prismaUser.id,
      title,
      targetAmount,
      currentAmount: 0,
      deadline: deadlineStr ? new Date(deadlineStr) : null
    }
  })

  return { success: true }
}

export async function deleteGoal(goalId: string) {
  const user = await getUser()
  if (!user) return { error: 'Unauthorized' }

  await prisma.goal.delete({
    where: { id: goalId }
  })

  return { success: true }
}
