/**
 * Keys of the client data cache (src/lib/data-cache.ts). The app snapshot fills the same keys
 * the pages read, so a page opened after the snapshot renders without a request.
 */
export type Locale = "th-TH" | "en-US"
export type Timeframe = "ALL" | "YTD" | "MONTH" | "WEEK"

export type TransactionQuery = {
  page: number
  limit: number
  type?: "ALL" | "INCOME" | "EXPENSE"
  month?: number
  year?: number
  sortBy?: "DATE_DESC" | "DATE_ASC" | "CATEGORY"
  filterCategoryId?: string
}

export const cacheKeys = {
  profile: "profile",
  bills: "bills",
  goals: "goals",
  categoryColors: "categoryColors",
  subscription: "subscription",
  rewards: "rewards",
  claims: "claims",
  quests: "quests",
  releases: "releases",
  dashboard: (timeframe: Timeframe, month: number, year: number, locale: Locale) => `dashboard:${timeframe}:${year}-${month}:${locale}`,
  transactions: (q: TransactionQuery) =>
    `transactions:${q.page}:${q.limit}:${q.type ?? "ALL"}:${q.year ?? ""}-${q.month ?? ""}:${q.sortBy ?? "DATE_DESC"}:${q.filterCategoryId ?? "ALL"}`,
}

/** What the transactions page asks for when it opens: this month, newest first, no filters. */
export function defaultTransactionQuery(month: number, year: number): TransactionQuery {
  return { page: 1, limit: 15, type: "ALL", month, year, sortBy: "DATE_DESC", filterCategoryId: "ALL" }
}
