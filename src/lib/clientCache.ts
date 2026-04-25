import { getProfileData } from "@/features/user/actions"

let profilePromise: Promise<any> | null = null;
let profileData: any = null;

// Memory Cache for Client Side so we don't spam Server Action requests via useEffect
export const fetchProfileDataCached = (force = false) => {
   if (force || typeof window === 'undefined') {
      profileData = null;
      profilePromise = null;
      if (typeof window === 'undefined') return getProfileData();
   }
   if (profileData) return Promise.resolve(profileData);
   if (!profilePromise) {
      profilePromise = getProfileData().then(d => {
         profileData = d;
         return d;
      }).catch(e => {
         profilePromise = null;
         throw e;
      })
   }
   return profilePromise;
}

export const clearProfileCache = () => {
    profileData = null;
    profilePromise = null;
}
