"use client"

import React, { useEffect, useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeftRight, ArrowDownRight, ArrowUpRight, Loader2, FileX2, Edit, Plus, Cat, Sparkle, Download } from "lucide-react"
import * as XLSX from "xlsx"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { getTransactions, createTransactionServer, updateTransactionServer, deleteTransactionServer } from "@/features/transactions/actions"
import { updateCategoryColors } from "@/features/settings/actions"
import { useLanguage } from "@/contexts/LanguageContext"
import { toast } from "sonner"

type TransactionType = 'ALL' | 'INCOME' | 'EXPENSE'

// YYYY-MM-DD in the viewer's local time (toISOString would shift to UTC)
const toDateInput = (d: Date) => d.toLocaleDateString('en-CA')
type SortBy = 'DATE_DESC' | 'DATE_ASC' | 'CATEGORY'

// Mirrors the global categories in the DB
const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Business', 'Investment Income', 'Gift', 'Transfer In', 'Other Income']
const EXPENSE_CATEGORIES = ['Food', 'Groceries', 'Transport', 'Housing', 'Utilities', 'Shopping', 'Personal Care', 'Entertainment', 'Education', 'Family & Pets', 'Health & Medical', 'Investment', 'Saving', 'Transfer Out', 'Debt Payment', 'Gift & Donation', 'Other Expense']

const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  // Income (based on dashboard INCOME_COLORS)
  'Salary': '#10b981',      
  'Freelance': '#3b82f6',   
  'Gift': '#f59e0b',        
  'Income': '#14b8a6',      
  'Transfer In': '#8b5cf6', 
  'Other Income': '#ec4899',
  
  // Expense (based on dashboard EXPENSE_COLORS)
  'Food': '#ef4444',        
  'Transport': '#f97316',   
  'Housing': '#06b6d4',     
  'Utilities': '#eab308',   
  'Shopping': '#d946ef',    
  'Entertainment': '#6366f1',
  'Transfer Out': '#8b5cf6', 
  'Investment': '#2dd4bf',  
  'Saving': '#34d399',      
  'Other Expense': '#64748b'
}

export default function TransactionsPage() {
  const { t, tc, locale } = useLanguage()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>({})
  const [filterType, setFilterType] = useState<TransactionType>('ALL')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<SortBy>('DATE_DESC')
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  // Sheet States
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessPaoPao, setShowSuccessPaoPao] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [formData, setFormData] = useState({
    amount: '',
    category: 'Other Expense',
    type: 'EXPENSE',
    date: toDateInput(new Date()),
    paymentMethod: 'Cash',
    notes: '',
    color: '#64748b'
  })
  
  // AlertDialog states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [filterType, selectedMonth, selectedYear, sortBy, selectedCategory])

  const fetchInitialData = async () => {
    setLoading(true)
    setPage(1)
    const res = await getTransactions({ page: 1, limit: 15, type: filterType, month: selectedMonth, year: selectedYear, sortBy, filterCategoryId: selectedCategory })
    if (res.data) {
      setData(res.data)
      setTotalPages(res.totalPages)
      if (res.categoryColors) {
        setCategoryColors(res.categoryColors)
      }
    }
    setLoading(false)
  }

  const loadMore = async () => {
    if (page >= totalPages || loadingMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    const res = await getTransactions({ page: nextPage, limit: 15, type: filterType, month: selectedMonth, year: selectedYear, sortBy, filterCategoryId: selectedCategory })
    if (res.data) {
      setData(prev => [...prev, ...res.data])
      setPage(nextPage)
      setTotalPages(res.totalPages)
    }
    setLoadingMore(false)
  }

  const observer = useRef<IntersectionObserver | null>(null)
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore || page >= totalPages) return
    if (observer.current) observer.current.disconnect()
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        loadMore()
      }
    })
    if (node) observer.current.observe(node)
  }, [loading, loadingMore, page, totalPages, filterType, selectedMonth, selectedYear, sortBy, selectedCategory])

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

  const exportToExcel = async () => {
    toast.info(t('transactions.export.preparing'))
    const res = await getTransactions({ page: 1, limit: 10000, type: filterType, month: selectedMonth, year: selectedYear, sortBy, filterCategoryId: selectedCategory })
    if (res.data && res.data.length > 0) {
      const exportData = res.data.map((tx: any) => ({
        [t('transactions.table.date')]: new Date(tx.date).toLocaleDateString(locale),
        [t('transactions.table.type')]: tx.type === 'INCOME' ? t('common.income') : t('common.expense'),
        [t('transactions.table.category')]: tc(tx.category || 'Other Expense'),
        [t('transactions.table.amount')]: tx.amount,
        [t('transactions.table.notes')]: tx.note || ''
      }))
      
      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions")
      
      const fileName = `PaoPao_Transactions_${selectedYear}_${selectedMonth}.xlsx`
      XLSX.writeFile(workbook, fileName)
      toast.success(t('transactions.export.success'))
    } else {
      toast.error(t('transactions.export.empty'))
    }
  }

  // --- CRUD ACTION HANDLERS ---
  const openCreateSheet = () => {
    setEditId(null)
    setIsCustomCategory(false)
    setFormData({
      amount: '',
      category: 'Other Expense',
      type: 'EXPENSE',
      date: toDateInput(new Date()),
      paymentMethod: 'Cash',
      notes: '',
      color: categoryColors['Other Expense'] || DEFAULT_CATEGORY_COLORS['Other Expense'] || '#64748b'
    })
    setIsSheetOpen(true)
  }

  const openEditSheet = (tx: any) => {
    setEditId(tx.id)
    const availableCategoriesForTx = tx.type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    const c = tx.category || 'Other'
    setIsCustomCategory(!availableCategoriesForTx.includes(c))
    
    setFormData({
      amount: tx.amount.toString(),
      category: c,
      type: tx.type,
      date: toDateInput(new Date(tx.date)),
      paymentMethod: tx.paymentMethod || 'Cash',
      notes: tx.note || '',
      color: categoryColors[c] || DEFAULT_CATEGORY_COLORS[c] || '#64748b'
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

    if (res.success && formData.color) {
      const newColors = { ...categoryColors, [formData.category]: formData.color }
      setCategoryColors(newColors)
      await updateCategoryColors(newColors)
    }

    if (res.success) {
      if (!editId) {
        // Show PaoPao animation only on new additions for positive reinforcement!
        setShowSuccessPaoPao(true)
        setTimeout(() => setShowSuccessPaoPao(false), 2500)
      }
      toast.success(t('transactions.action.save'), { description: t('transactions.action.saved_desc') })
      setIsSheetOpen(false)
      fetchInitialData()
    } else {
      toast.error(t('common.error'), { description: res.error || t('transactions.action.failed') })
    }
    setIsSubmitting(false)
  }

  const requestDeleteTx = () => {
    setDeleteConfirmOpen(true)
  }

  const executeDeleteTx = async () => {
    if (!editId) return
    setDeleteConfirmOpen(false)
    setIsSubmitting(true)
    const res = await deleteTransactionServer(editId)
    if (res.success) {
       toast.success(t('transactions.delete.success'))
       setIsSheetOpen(false)
       fetchInitialData()
    } else {
       toast.error(t('common.error'), { description: res.error || t('transactions.delete.failed') })
    }
    setIsSubmitting(false)
  }

  const availableCategories = formData.type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const customCategories = Object.keys(categoryColors).filter(c => !INCOME_CATEGORIES.includes(c) && !EXPENSE_CATEGORIES.includes(c))

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground/90">{t('transactions.title')}</h2>
          <p className="text-muted-foreground">{t('transactions.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="shrink-0 bg-background/50 backdrop-blur" onClick={exportToExcel}>
            <Download className="h-4 w-4 mr-2" /> {t('transactions.btn.export')}
          </Button>
          <Button className="shrink-0 shadow-lg" onClick={openCreateSheet}>
            <Plus className="h-4 w-4 mr-2" /> {t('transactions.btn.add')}
          </Button>
        </div>
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
                <option value={0}>{t('transactions.filter.all_months')}</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>
                    {new Date(0, m - 1).toLocaleString(locale, { month: 'long' })}
                  </option>
                ))}
              </select>
              <select 
                className="bg-background border border-border rounded text-sm p-1 text-foreground"
                value={selectedYear}
                onChange={(e) => { setPage(1); setSelectedYear(Number(e.target.value)) }}
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y + (locale === 'th-TH' ? 543 : 0)}</option>
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
                <option value="ALL">{t('transactions.filter.all_categories')}</option>
                {filterType === 'INCOME' 
                  ? INCOME_CATEGORIES.map(c => <option key={c} value={c}>{tc(c)}</option>)
                  : filterType === 'EXPENSE'
                    ? EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{tc(c)}</option>)
                    : Array.from(new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES])).map(c => <option key={c} value={c}>{tc(c)}</option>)
                }
                {customCategories.length > 0 && (
                  <optgroup label={t('transactions.filter.custom')}>
                    {customCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                )}
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
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground animate-in fade-in">
                <motion.img 
                  src="/favicon.png" 
                  alt="Loading..." 
                  className="w-16 h-16 mb-4 drop-shadow-md"
                  animate={{ y: [0, -20, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
                />
                <p className="font-medium animate-pulse">{t('transactions.loading')}</p>
              </div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                <FileX2 className="h-12 w-12 mb-4 opacity-20" />
                <p>{t('transactions.empty')}</p>
              </div>
            ) : (
              <div className="flex flex-col">
                <AnimatePresence>
                  {data.map((tx, idx) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-2 p-4 border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span 
                              className="px-2 py-0.5 rounded text-white text-xs font-medium"
                              style={{ backgroundColor: categoryColors[tx.category] || DEFAULT_CATEGORY_COLORS[tx.category] || '#64748b' }}
                            >
                              {tc(tx.category)}
                            </span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(tx.date).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <p className="font-medium text-foreground text-sm line-clamp-2 md:text-base">{tx.note || t('transactions.no_note')}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`font-bold text-lg md:text-xl ${tx.type === 'INCOME' ? 'text-[#00B900]' : 'text-foreground'}`}>
                            {tx.type === 'INCOME' ? '+' : '-'}฿{Number(tx.amount).toLocaleString()}
                          </span>
                          <Button variant="ghost" size="icon" onClick={() => openEditSheet(tx)} className="h-6 w-6 mt-1 text-muted-foreground hover:text-primary">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
          
          {page < totalPages && (
            <div ref={lastElementRef} className="flex justify-center px-4 py-8 border-t border-border/50">
              <motion.img 
                src="/favicon.png" 
                alt="Loading..." 
                className="w-10 h-10 drop-shadow-md"
                animate={{ y: [0, -15, 0] }}
                transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }}
              />
            </div>
          )}
          {data.length > 0 && page === totalPages && (
            <div className="text-center p-6 text-xs text-muted-foreground border-t border-border/50">
              {t('transactions.all_loaded')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CRUD Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="bg-background border-border overflow-y-auto sm:max-w-md w-full p-6 pt-12">
          <SheetHeader>
            <SheetTitle>{editId ? t('transactions.form.title.edit') : t('transactions.form.title.add')}</SheetTitle>
            <SheetDescription>{t('transactions.form.desc')}</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleFormSubmit} className="space-y-6 mt-8">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('transactions.table.type')}</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
              >
                <option value="EXPENSE">{t('common.expense')}</option>
                <option value="INCOME">{t('common.income')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('transactions.table.amount')}</label>
              <Input 
                name="amount" 
                type="number" 
                required 
                placeholder="0.00" 
                className="bg-background" 
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('transactions.table.category')}</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={isCustomCategory ? 'CUSTOM' : formData.category}
                onChange={(e) => {
                  if (e.target.value === 'CUSTOM') {
                    setIsCustomCategory(true)
                    setFormData({...formData, category: '', color: '#64748b'})
                  } else {
                    setIsCustomCategory(false)
                    setFormData({...formData, category: e.target.value, color: categoryColors[e.target.value] || DEFAULT_CATEGORY_COLORS[e.target.value] || '#64748b'})
                  }
                }}
              >
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{tc(cat)}</option>
                ))}
                {customCategories.length > 0 && (
                  <optgroup label={t('transactions.form.custom_group')}>
                    {customCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </optgroup>
                )}
                <option value="CUSTOM">+ {t('transactions.form.new_category')}</option>
              </select>
              <div className="mt-2 flex items-center gap-3">
                <input 
                  type="color" 
                  value={formData.color} 
                  onChange={(e) => setFormData({...formData, color: e.target.value})}
                  className="w-8 h-8 p-0.5 rounded cursor-pointer border border-border bg-background"
                />
                <span className="text-xs text-muted-foreground">{t('transactions.form.pick_color')}</span>
              </div>
              {isCustomCategory && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <Input 
                    autoFocus
                    placeholder={t('transactions.form.category_name')}
                    className="mt-2 bg-background" 
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    required
                  />
                </motion.div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('transactions.table.date')}</label>
              <Input 
                name="date" 
                type="date" 
                required 
                className="bg-background" 
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('transactions.table.notes')}</label>
              <Input 
                name="notes" 
                placeholder={t('transactions.notes_placeholder')} 
                className="bg-background" 
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              />
            </div>
            <SheetFooter className={`mt-8 grid gap-3 w-full ${editId ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {editId && (
                <Button type="button" variant="destructive" disabled={isSubmitting} className="w-full" onClick={requestDeleteTx}>
                  {t('common.delete')}
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t('transactions.action.save')}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Alert Dialog for Deletion */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="glass-panel border-destructive/20 border max-w-sm rounded-[1.5rem]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2 text-xl">
              <FileX2 className="w-6 h-6"/>
              {t('transactions.delete.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base pt-2 text-foreground/80">
              {t('transactions.delete.desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 border-t border-border/50 pt-4">
            <AlertDialogCancel disabled={isSubmitting} className="rounded-xl h-11 w-full mt-0">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteTx} disabled={isSubmitting} className="rounded-xl h-11 w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {t('common.confirm_delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PaoPao Success Micro-Interaction Overlay */}
      <AnimatePresence>
        {showSuccessPaoPao && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            transition={{ type: "spring", bounce: 0.6, duration: 0.8 }}
            className="fixed bottom-10 right-10 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="relative">
              <div className="absolute -top-4 -right-4 text-yellow-400 animate-bounce delay-75">
                <Sparkle className="w-8 h-8 fill-yellow-400" />
              </div>
              <div className="absolute -bottom-2 -left-4 text-emerald-400 animate-bounce delay-150">
                <Sparkle className="w-6 h-6 fill-emerald-400" />
              </div>
              <div className="bg-primary text-primary-foreground p-6 rounded-t-full rounded-bl-full shadow-2xl flex flex-col items-center justify-center gap-2 border-4 border-white/20">
                <Cat className="w-16 h-16 animate-pulse" />
                <span className="font-heading font-bold text-lg text-white">{t('transactions.success_badge')}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
