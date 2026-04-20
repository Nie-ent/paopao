"use server"

import prisma from "@/lib/db"
import { getUser } from "@/features/auth/actions"

export async function getProfileData() {
  const authUser = await getUser()
  if (!authUser) return null

  const lineId = authUser.user_metadata?.provider_id || (authUser as any).id
  
  if (!lineId) return null

  const user = await prisma.user.findUnique({
    where: { lineId }
  })

  return user;
}
