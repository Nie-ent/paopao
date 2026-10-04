/**
 * Single source of truth for the global (built-in) categories. Names must match the `Category`
 * rows with `userId = null` in the database; display names live in i18n (`category.<name>`).
 */

export type CategoryType = 'INCOME' | 'EXPENSE'

type CategoryDefinition = {
  name: string
  type: CategoryType
  color: string
  /** Tells the AI when to pick this category */
  aiHint: string
}

export const CATEGORIES: readonly CategoryDefinition[] = [
  { name: 'Salary', type: 'INCOME', color: '#10b981', aiHint: 'Regular monthly pay from employment, bonuses' },
  { name: 'Freelance', type: 'INCOME', color: '#3b82f6', aiHint: 'Side gigs, contract work, odd jobs' },
  { name: 'Business', type: 'INCOME', color: '#8b5cf6', aiHint: 'Revenue from selling goods or running a business' },
  { name: 'Investment Income', type: 'INCOME', color: '#2dd4bf', aiHint: 'Dividends, interest, profit from selling assets' },
  { name: 'Gift', type: 'INCOME', color: '#f59e0b', aiHint: 'Money received as a gift (birthdays, ang pao)' },
  { name: 'Transfer In', type: 'INCOME', color: '#6366f1', aiHint: 'Refunds, friends paying you back, moving money in from your own accounts' },
  { name: 'Other Income', type: 'INCOME', color: '#ec4899', aiHint: 'Incoming money that fits no other income category' },

  { name: 'Food', type: 'EXPENSE', color: '#ef4444', aiHint: 'Meals, snacks, drinks, coffee, food delivery' },
  { name: 'Groceries', type: 'EXPENSE', color: '#84cc16', aiHint: 'Supermarket and household shopping (Lotus, Big C, Tops, Makro, markets)' },
  { name: 'Transport', type: 'EXPENSE', color: '#f97316', aiHint: 'BTS, MRT, taxi, Grab rides, fuel, tolls, parking, flights' },
  { name: 'Housing', type: 'EXPENSE', color: '#06b6d4', aiHint: 'Rent, condo fees, home repairs' },
  { name: 'Utilities', type: 'EXPENSE', color: '#eab308', aiHint: 'Electricity, water, internet, mobile phone bills' },
  { name: 'Shopping', type: 'EXPENSE', color: '#d946ef', aiHint: 'Clothes, gadgets, Shopee/Lazada and other non-food goods' },
  { name: 'Personal Care', type: 'EXPENSE', color: '#ec4899', aiHint: 'Haircuts, cosmetics, spa, massage' },
  { name: 'Entertainment', type: 'EXPENSE', color: '#6366f1', aiHint: 'Movies, concerts, games, parties, streaming subscriptions' },
  { name: 'Education', type: 'EXPENSE', color: '#3b82f6', aiHint: 'Courses, books, tuition' },
  { name: 'Family & Pets', type: 'EXPENSE', color: '#f43f5e', aiHint: 'Money for parents or children, pet food and vet' },
  { name: 'Health & Medical', type: 'EXPENSE', color: '#14b8a6', aiHint: 'Hospital, clinic, pharmacy, dentist, gym' },
  { name: 'Investment', type: 'EXPENSE', color: '#2dd4bf', aiHint: 'Buying stocks, funds, crypto, gold, DCA' },
  { name: 'Saving', type: 'EXPENSE', color: '#10b981', aiHint: 'Moving money into a savings account' },
  { name: 'Transfer Out', type: 'EXPENSE', color: '#8b5cf6', aiHint: 'Transfers to other people or accounts with no clear purpose' },
  { name: 'Debt Payment', type: 'EXPENSE', color: '#ef4444', aiHint: 'Loan installments, credit card bills, paying back debts' },
  { name: 'Gift & Donation', type: 'EXPENSE', color: '#f59e0b', aiHint: 'Gifts for others, merit making, donations, wedding envelopes' },
  { name: 'Other Expense', type: 'EXPENSE', color: '#64748b', aiHint: 'Outgoing money that fits no other expense category' },
]

export const CATEGORY_NAMES = CATEGORIES.map(c => c.name)
export const INCOME_CATEGORIES = CATEGORIES.filter(c => c.type === 'INCOME').map(c => c.name)
export const EXPENSE_CATEGORIES = CATEGORIES.filter(c => c.type === 'EXPENSE').map(c => c.name)
export const DEFAULT_CATEGORY_COLORS: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.name, c.color]))

export const FALLBACK_CATEGORY: Record<CategoryType, string> = { INCOME: 'Other Income', EXPENSE: 'Other Expense' }
export const UNCATEGORIZED_COLOR = '#64748b'

export const isBuiltInCategory = (name: string) => CATEGORY_NAMES.includes(name)
