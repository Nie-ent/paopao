"use server"

import prisma from "@/lib/db"
import { getCurrentUser } from "@/lib/current-user"

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

  for (const goal of goals) {
    if (goal.type === "FINANCIAL" && goal.trackCategory) {
      if (goal.trackCategory === "DAILY_BALANCE") {
        // Daily Balance: Today's Income - Today's Expense
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const agg = await prisma.transaction.groupBy({
          by: ['type'],
          _sum: { amount: true },
          where: {
            userId: prismaUser.id,
            date: { gte: today }
          }
        });
        
        const income = agg.find((x: any) => x.type === 'INCOME')?._sum.amount || 0;
        const expense = agg.find((x: any) => x.type === 'EXPENSE')?._sum.amount || 0;
        
        goal.currentAmount = income - expense;
      } else {
        // Start counting from the 1st day of the month the goal was created
        // This allows retrospective transactions added in the same month to be included!
        const startDate = new Date(goal.createdAt);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);

        const agg = await prisma.transaction.aggregate({
          _sum: { amount: true },
          where: {
            userId: prismaUser.id,
            category: { name: goal.trackCategory },
            date: { 
              gte: startDate, 
              lte: goal.deadline ? new Date(goal.deadline.getTime() + 24 * 60 * 60 * 1000) : undefined // Include the entire deadline day
            }
          }
        })
        goal.currentAmount = agg._sum.amount || 0
      }
    }
  }

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
      deadline: deadlineStr ? new Date(deadlineStr) : null
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
      deadline: deadlineStr ? new Date(deadlineStr) : null
    }
  })

  return { success: true }
}
