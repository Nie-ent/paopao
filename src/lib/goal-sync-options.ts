import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories"

/** Categories people usually set goals on, listed first */
const GOAL_FIRST = ["Debt Payment", "Saving", "Investment"]

/**
 * Category names a financial goal can sync from, in the order the form lists them:
 * goal-like expense categories, other expense categories, income categories, then the
 * user's own. Values are real category names, which is what goal progress matches on.
 */
export function goalSyncCategories(allCategoryNames: string[]) {
  const builtIn = new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES])
  const custom = [...new Set(allCategoryNames.filter(n => n && !builtIn.has(n)))].sort((a, b) => a.localeCompare(b))
  return {
    expense: [...GOAL_FIRST, ...EXPENSE_CATEGORIES.filter(c => !GOAL_FIRST.includes(c))],
    income: [...INCOME_CATEGORIES],
    custom,
  }
}
