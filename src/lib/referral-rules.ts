/** Invite-a-friend rules (no server imports, so marketing copy can quote them). Logic: src/lib/referral.ts */
/** Free Pro trial for a friend who signs up through an invite link (instead of the usual TRIAL_DAYS) */
export const REFERRAL_TRIAL_DAYS = 30
/** Pro days the inviter gets per friend who qualifies */
export const REWARD_DAYS = 30
/** Most rewards one inviter can earn */
export const MAX_REWARDS = 3
/** A friend qualifies after logging entries on this many different (Bangkok) days… */
export const QUALIFY_DAYS = 3
/** …within this many days of signing up */
export const QUALIFY_WINDOW_DAYS = 14
