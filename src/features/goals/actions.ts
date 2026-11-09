"use server"

import prisma from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"
import { trackedGoalAmount } from "@/lib/goal-progress"
import { parseBangkokDateTime } from "@/lib/dates"

export async function getGoals() {
  const prismaUser = await getCurrentUser()
  if (!prismaUser) return { error: 'User not found', data: [] }

  const goals = await prisma.goal.findMany({
    where: { 
      userId: prismaUser.id,
      isCompleted: false
    },
    orderBy: { deadline: 'asc' }
  })

  // One query per synced goal, run together rather than one after another
  await Promise.all(goals.map(async goal => {
    if (goal.type !== "FINANCIAL") return
    const synced = await trackedGoalAmount(goal)
    if (synced !== null) goal.currentAmount = synced
  }))

  return { data: goals }
}

export async function createGoal(formData: FormData) {
  const prismaUser = await getCurrentUser()
  if (!prismaUser) return { error: 'User not found' }

  const type = (formData.get('type') as string) || "FINANCIAL"
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const trackCategory = formData.get('trackCategory') as string
  const targetAmount = type === "TODO" ? 0 : Number(formData.get('targetAmount'))
  const deadlineStr = formData.get('deadline') as string
  
  if (!title || (type === "FINANCIAL" && !targetAmount)) return { error: 'Missing required fields' }

  await prisma.goal.create({
    data: {
      userId: prismaUser.id,
      type: type as any,
      title,
      description: description || null,
      targetAmount,
      currentAmount: 0,
      trackCategory: trackCategory || null,
      deadline: parseBangkokDateTime(deadlineStr)
    }
  })

  return { success: true }
}

export async function deleteGoal(goalId: string) {
  const prismaUser = await getCurrentUser()
  if (!prismaUser) return { error: 'User not found' }

  const { count } = await prisma.goal.deleteMany({
    where: { id: goalId, userId: prismaUser.id }
  })

  return count ? { success: true } : { error: 'Goal not found' }
}

export async function toggleGoalCompletion(goalId: string, isCompleted: boolean) {
  const prismaUser = await getCurrentUser()
  if (!prismaUser) return { error: 'User not found' }

  const { count } = await prisma.goal.updateMany({
    where: { id: goalId, userId: prismaUser.id },
    data: { isCompleted }
  })

  return count ? { success: true } : { error: 'Goal not found' }
}

export async function updateGoal(goalId: string, formData: FormData) {
  const prismaUser = await getCurrentUser()
  if (!prismaUser) return { error: 'User not found' }

  const type = (formData.get('type') as string) || "FINANCIAL"
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const trackCategory = formData.get('trackCategory') as string
  const targetAmount = type === "TODO" ? 0 : Number(formData.get('targetAmount'))
  const deadlineStr = formData.get('deadline') as string
  
  if (!title || (type === "FINANCIAL" && !targetAmount)) return { error: 'Missing required fields' }

  await prisma.goal.update({
    where: { 
      id: goalId,
      userId: prismaUser.id
    },
    data: {
      title,
      description: description || null,
      targetAmount,
      trackCategory: trackCategory || null,
      deadline: parseBangkokDateTime(deadlineStr)
    }
  })

  return { success: true }
}
