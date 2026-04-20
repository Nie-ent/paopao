"use client"

import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeftRight, ArrowDownRight, ArrowUpRight, Loader2, FileX2, Edit, Plus } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { getTransactions, createTransactionServer, updateTransactionServer } from "@/features/transactions/actions"
import { useLanguage } from "@/contexts/LanguageContext"
import { toast } from "sonner"

type TransactionType = 'ALL' | 'INCOME' | 'EXPENSE'
type SortBy = 'DATE_DESC' | 'DATE_ASC' | 'CATEGORY'

const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Gift', 'Income', 'Transfer In', 'Other Income']
const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Housing', 'Utilities', 'Shopping', 'Entertainment', 'Transfer Out', 'Other Expense']

export default function TransactionsPage() {
  const { t, language } = useLanguage()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterType, setFilterType] = useState<TransactionType>('ALL')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<SortBy>('DATE_DESC')
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  // Sheet States
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    amount: '',
    category: 'Other Expense',
    type: 'EXPENSE',
    date: new Date().toISOString().slice(0,10),
    paymentMethod: 'Cash',
    notes: ''
  })

  useEffect(() => {
    fetchData()
  }, [page, filterType, selectedMonth, selectedYear, sortBy, selectedCategory])

  const fetchData = async () => {
    setLoading(true)
    const res = await getTransactions({ page, limit: 10, type: filterType, month: selectedMonth, year: selectedYear, sortBy, filterCategory: selectedCategory })
    if (res.data) {
      setData(res.data)
      setTotalPages(res.totalPages)
    }
    setLoading(false)
  }

  const handleFilter = (type: TransactionType) => {
    if (filterType === type) return
    setPage(1)
    setFilterType(type)
  }

  const handleNextPage = () => {
    if (page < totalPages) setPage(p => p + 1)
  }

  const handlePrevPage = () => {
    if (page > 1) setPage(p => p - 1)
  }

  // --- CRUD ACTION HANDLERS ---
  const openCreateSheet = () => {
    setEditId(null)
    setFormData({
      amount: '',
      category: 'Other Expense',
      type: 'EXPENSE',
      date: new Date().toISOString().slice(0,10),
      paymentMethod: 'Cash',
      notes: ''
    })
    setIsSheetOpen(true)
  }

  const openEditSheet = (tx: any) => {
    setEditId(tx.id)
    setFormData({
      amount: tx.amount.toString(),
      category: tx.category || 'Other',
      type: tx.type,
      date: new Date(tx.date).toISOString().slice(0, 10),
      paymentMethod: tx.paymentMethod || 'Cash',
      notes: tx.note || ''
    })
    setIsSheetOpen(true)
  }

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    const payload = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      payload.append(key, value)
    })

    let res
    if (editId) {
      res = await updateTransactionServer(editId, payload)
    } else {
      res = await createTransactionServer(payload)
    }

    if (res.success) {
      toast.success(t('transactions.action.save'), { description: "Action completed successfully." })
      setIsSheetOpen(false)
      fetchData()
    } else {
      toast.error("Error", { description: res.error || "Action failed." })
    }
    setIsSubmitting(false)
  }

  const availableCategories = formData.type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground/90">{t('transactions.title')}</h2>
          <p className="text-muted-foreground">{t('transactions.subtitle')}</p>
        </div>
        <Button className="shrink-0 shadow-lg" onClick={openCreateSheet}>
          <Plus className="h-4 w-4 mr-2" /> {t('transactions.btn.add')}
        </Button>
      </div>

      <Card className="glass-panel overflow-hidden border-border/50">
        <CardHeader className="bg-muted/10 pb-4 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <CardTitle>{t('transactions.title')}</CardTitle>
            <CardDescription className="flex items-center gap-2 flex-wrap">
              <select 
                className="bg-background border border-border rounded text-sm p-1 text-foreground"
                value={selectedMonth}
                onChange={(e) => { setPage(1); setSelectedMonth(Number(e.target.value)) }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>
                    {new Date(0, m - 1).toLocaleString(language === 'th' ? 'th-TH' : 'en-US', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select 
                className="bg-background border border-border rounded text-sm p-1 text-foreground"
                value={selectedYear}
                onChange={(e) => { setPage(1); setSelectedYear(Number(e.target.value)) }}
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y + (language === 'th' ? 543 : 0)}</option>
                ))}
              </select>
              <select 
                className="bg-background border border-border rounded text-sm p-1 text-foreground font-medium"
                value={sortBy}
                onChange={(e) => { setPage(1); setSortBy(e.target.value as SortBy) }}
              >
                <option value="DATE_DESC">{t('transactions.sort.date_desc')}</option>
                <option value="DATE_ASC">{t('transactions.sort.date_asc')}</option>
                <option value="CATEGORY">{t('transactions.sort.category')}</option>
              </select>
              <select 
                className="bg-background border border-border rounded text-sm p-1 text-foreground"
                value={selectedCategory}
                onChange={(e) => { setPage(1); setSelectedCategory(e.target.value) }}
              >
                <option value="ALL">All Categories</option>
                {filterType === 'INCOME' 
                  ? INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)
                  : filterType === 'EXPENSE'
                    ? EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)
                    : Array.from(new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES])).map(c => <option key={c} value={c}>{c}</option>)
                }
              </select>
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 bg-secondary/50 p-1 rounded-lg">
            <Button 
              variant={filterType === 'ALL' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => handleFilter('ALL')}
              className={filterType === 'ALL' ? 'bg-primary shadow-md' : 'text-muted-foreground'}
            >
              <ArrowLeftRight className="w-4 h-4 mr-2" /> {t('transactions.filter.all')}
            </Button>
            <Button 
              variant={filterType === 'INCOME' ? 'outline' : 'ghost'} 
              size="sm" 
              onClick={() => handleFilter('INCOME')}
              className={filterType === 'INCOME' ? 'border-primary/50 text-primary bg-primary/10' : 'text-muted-foreground'}
            >
              <ArrowUpRight className="w-4 h-4 mr-2" /> {t('transactions.filter.income')}
            </Button>
            <Button 
              variant={filterType === 'EXPENSE' ? 'outline' : 'ghost'} 
              size="sm" 
              onClick={() => handleFilter('EXPENSE')}
              className={filterType === 'EXPENSE' ? 'border-destructive/50 text-destructive bg-destructive/10' : 'text-muted-foreground'}
            >
              <ArrowDownRight className="w-4 h-4 mr-2" /> {t('transactions.filter.expense')}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary opacity-80" />
                <p>Loading transactions...</p>
              </div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                <FileX2 className="h-12 w-12 mb-4 opacity-20" />
                <p>{t('transactions.empty')}</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[180px]">{t('transactions.table.date')}</TableHead>
                    <TableHead>{t('transactions.table.category')}</TableHead>
                    <TableHead className="w-[300px]">{t('transactions.table.notes')}</TableHead>
                    <TableHead className="text-right">{t('transactions.table.amount')}</TableHead>
                    <TableHead className="w-[80px] text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {data.map((tx, idx) => (
                      <motion.tr
                        key={tx.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, delay: idx * 0.05 }}
                        className="border-b transition-colors hover:bg-muted/30 data-[state=selected]:bg-muted"
                      >
                        <TableCell className="font-medium text-muted-foreground whitespace-nowrap">
                          {new Date(tx.date).toLocaleString('en-US', { 
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded-md bg-secondary/50 text-secondary-foreground text-xs font-medium">
                              {tx.category}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground line-clamp-1 max-w-[300px]">
                          {tx.note || "-"}
                        </TableCell>
                        <TableCell className={`text-right font-bold \${tx.type === 'INCOME' ? 'text-[#00B900]' : 'text-foreground'}`}>
                          {tx.type === 'INCOME' ? '+' : '-'}฿{Number(tx.amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" onClick={() => openEditSheet(tx)} className="h-8 w-8 text-primary/70 hover:text-primary">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-4 border-t border-border/50">
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrevPage} 
                disabled={page === 1}
              >
                {t('transactions.pagination.prev')}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNextPage} 
                disabled={page === totalPages}
              >
                {t('transactions.pagination.next')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CRUD Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="bg-background border-border overflow-y-auto sm:max-w-md w-full p-6 pt-12">
          <SheetHeader>
            <SheetTitle>{editId ? t('transactions.form.title.edit') : t('transactions.form.title.add')}</SheetTitle>
            <SheetDescription>Configure the transaction details directly to the database.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleFormSubmit} className="space-y-6 mt-8">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <select 
                className="w-full bg-muted/50 border border-border rounded p-2 text-sm text-foreground"
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('transactions.table.amount')}</label>
              <Input 
                name="amount" 
                type="number" 
                required 
                placeholder="0.00" 
                className="bg-muted/50" 
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('transactions.table.category')}</label>
              <select 
                className="w-full bg-muted/50 border border-border rounded p-2 text-sm text-foreground"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
              >
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('transactions.table.date')}</label>
              <Input 
                name="date" 
                type="date" 
                required 
                className="bg-muted/50" 
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('transactions.table.notes')}</label>
              <Input 
                name="notes" 
                placeholder="Optional description" 
                className="bg-muted/50" 
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              />
            </div>
            <SheetFooter className="mt-8">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t('transactions.action.save')}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
