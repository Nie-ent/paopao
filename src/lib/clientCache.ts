import { getProfileData } from "@/features/user/actions"
import { cacheKeys } from "@/lib/cache-keys"
import { clearAll, load } from "@/lib/data-cache"

/** The signed-in user's record, shared by the header and pages (see src/lib/data-cache.ts). */
export const fetchProfileDataCached = (force = false) => load(cacheKeys.profile, getProfileData, { force })

/** Forgets all cached data, e.g. on sign out. */
export const clearProfileCache = () => clearAll()
