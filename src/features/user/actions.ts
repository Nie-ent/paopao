"use server"

import { getCurrentUser } from "@/lib/current-user"

export async function getProfileData() {
  return getCurrentUser()
}
