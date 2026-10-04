"use client"

import React, { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Target, TrendingUp, Trophy, Plus, Loader2, Trash2, CheckCircle2, Circle, ListTodo, CalendarClock, Flag, Link as LinkIcon } from "lucide-react"
import confetti from "canvas-confetti"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { getGoals, createGoal, deleteGoal, toggleGoalCompletion, updateGoal } from "@/features/goals/actions"
import { toast } from "sonner"
import { useLanguage } from "@/contexts/LanguageContext"
import { cn } from "@/lib/utils"

export default function GoalsPage() {
  const { t, tc, locale } = useLanguage()
  const [goals, setGoals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitLoading, setIsSubmitLoading] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const evaluatedRef = useRef<Set<string>>(new Set())
  const submitLockRef = useRef(false)
  
  const [sheetType, setSheetType] = useState<"FINANCIAL" | "TODO" | "DAILY">("FINANCIAL")
  const [formData, setFormData] = useState({
    title: "",
    targetAmount: "",
    trackCategory: "",
    description: "",
    deadline: ""
  })

  const openCreateSheet = () => {
    setEditId(null)
    setFormData({ title: "", targetAmount: "", trackCategory: "", description: "", deadline: "" })
    setIsSheetOpen(true)
  }

  const openEditSheet = (goal: any) => {
    setEditId(goal.id)
    if (goal.type === "TODO") {
      setSheetType("TODO")
    } else if (goal.trackCategory === "DAILY_BALANCE") {
      setSheetType("DAILY")
    } else {
      setSheetType("FINANCIAL")
    }
    setFormData({
      title: goal.title,
      targetAmount: goal.targetAmount?.toString() || "",
      trackCategory: goal.trackCategory || "",
      description: goal.description || "",
      deadline: goal.deadline ? new Date(goal.deadline).toISOString().slice(0, 16) : ""
    })
    setIsSheetOpen(true)
  }

  useEffect(() => {
    fetchGoals()
  }, [])

  useEffect(() => {
    if (goals.length > 0 && typeof window !== "undefined" && window.location.hash) {
      const elementId = window.location.hash.substring(1)
      setTimeout(() => {
        const element = document.getElementById(elementId)
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" })
        }
      }, 300)
    }

    // Goal Completion Celebrations (Auto-complete if target reached)
    if (goals.length > 0) {
      goals.forEach(goal => {
        if (evaluatedRef.current.has(goal.id) || goal.type !== "FINANCIAL" || goal.isCompleted) return
        
        // If the goal target is reached!
        if (goal.targetAmount > 0 && goal.currentAmount >= goal.targetAmount) {
          evaluatedRef.current.add(goal.id)
          
          setTimeout(() => {
            confetti({
              particleCount: 200,
              spread: 100,
              origin: { y: 0.6 },
              colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
            })
            toast.success(t('goals.achieved_toast', { title: goal.title }), { duration: 8000 })
          }, 1000)
          
          // Auto complete in DB
          toggleGoalCompletion(goal.id, true)
        }
      })
    }
  }, [goals])

  const fetchGoals = async () => {
    try {
      setLoading(true)
      const res = await getGoals()
      if (res?.data) {
        setGoals(res.data)
      } else {
        toast.error(t('goals.load_failed'))
      }
    } catch (err) {
      console.error(err)
      toast.error(t('goals.load_failed'))
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitLoading || submitLockRef.current) return
    
    submitLockRef.current = true
    setIsSubmitLoading(true)
    
    try {
      const payload = new FormData(e.currentTarget)
      if (sheetType === "DAILY") {
        payload.set("type", "FINANCIAL")
        payload.set("trackCategory", "DAILY_BALANCE")
      } else {
        payload.set("type", sheetType)
      }
      
      let res
      if (editId) {
        res = await updateGoal(editId, payload)
      } else {
        res = await createGoal(payload)
      }
      
      if (res.success) {
        toast.success(editId ? t('goals.toast.updated') : (sheetType === "FINANCIAL" || sheetType === "DAILY" ? t('goals.toast.created') : t('goals.toast.task_added')), {
          description: t('goals.toast.saved_desc')
        })
        setIsSheetOpen(false)
        fetchGoals()
      } else {
        toast.error(t('common.error'), { description: res.error || t('common.something_wrong') })
      }
    } finally {
      setIsSubmitLoading(false)
      submitLockRef.current = false
    }
  }

  const executeDelete = async () => {
    if (!goalToDelete) return;
    const res = await deleteGoal(goalToDelete)
    if (res.success) {
      toast.success(t('goals.toast.deleted'), { description: t('goals.toast.deleted_desc') })
      fetchGoals()
    } else {
      toast.error(t('common.error'), { description: t('goals.toast.delete_failed') })
    }
    setGoalToDelete(null)
  }

  const handleToggleCompletion = async (id: string, isCompleted: boolean) => {
    const updatedGoals = goals.map(g => g.id === id ? { ...g, isCompleted: !isCompleted } : g)
    setGoals(updatedGoals) // Optimistic update
    
    const res = await toggleGoalCompletion(id, !isCompleted)
    if (!res.success) {
      toast.error(t('goals.toast.status_failed'))
      fetchGoals() // revert
    }
  }

  const financialGoals = goals.filter(g => (g.type === "FINANCIAL" || !g.type) && !g.isCompleted)
  const todoTasks = goals.filter(g => g.type === "TODO" && !g.isCompleted)

  const formatDate = (dateStr: string, includeTime: boolean = false) => {
    if (!dateStr) return t('common.no_deadline')
    const d = new Date(dateStr)
    if (includeTime) {
      return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground/90 flex items-center gap-2">
            <Target className="h-8 w-8 text-primary" /> {t('goals.title')}
          </h2>
          <p className="text-muted-foreground">{t('goals.subtitle')}</p>
        </div>
        
        <Button className="shrink-0 shadow-lg shadow-primary/20" onClick={openCreateSheet}>
          <Plus className="h-4 w-4 mr-2" /> {t('goals.btn.add')}
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">{t('goals.tab.all')}</TabsTrigger>
          <TabsTrigger value="financial">{t('goals.tab.financial')}</TabsTrigger>
          <TabsTrigger value="todo">{t('goals.tab.todo')}</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6 mt-0">
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {/* Mix both lists but maybe visually we can separate them or just list as is */}
            {financialGoals.length > 0 && (
              <div className="col-span-full mb-2 flex items-center gap-2 text-lg font-semibold text-primary">
                <TrendingUp className="w-5 h-5" /> {t('goals.tab.financial')}
              </div>
            )}
            <RenderFinancial goals={financialGoals} setGoalToDelete={setGoalToDelete} openEditSheet={openEditSheet} formatDate={formatDate} loading={loading} />

            {todoTasks.length > 0 && (
              <div className="col-span-full mt-6 mb-2 flex items-center gap-2 text-lg font-semibold text-primary">
                <ListTodo className="w-5 h-5" /> {t('goals.tab.todo')}
              </div>
            )}
            <RenderTodos todos={todoTasks} setGoalToDelete={setGoalToDelete} openEditSheet={openEditSheet} toggleCompletion={handleToggleCompletion} formatDate={formatDate} loading={loading} />
            
            {!loading && goals.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-24 glass-panel rounded-xl text-muted-foreground">
                <Trophy className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-medium text-foreground">{t('goals.empty.title')}</p>
                <p className="max-w-sm text-center mt-2">{t('goals.empty.desc')}</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="financial" className="mt-0">
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
             <RenderFinancial goals={financialGoals} setGoalToDelete={setGoalToDelete} openEditSheet={openEditSheet} formatDate={formatDate} loading={loading} />
          </div>
        </TabsContent>
        <TabsContent value="todo" className="mt-0">
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
             <RenderTodos todos={todoTasks} setGoalToDelete={setGoalToDelete} openEditSheet={openEditSheet} toggleCompletion={handleToggleCompletion} formatDate={formatDate} loading={loading} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Alert Dialog */}
      <AlertDialog open={!!goalToDelete} onOpenChange={(open) => !open && setGoalToDelete(null)}>
        <AlertDialogContent className="glass-panel border-destructive/20 border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5"/>
              {t('goals.delete.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('goals.delete.desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {t('common.confirm_delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Creation Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="bg-background border-border overflow-y-auto w-full sm:max-w-xl p-8 pt-14 md:p-12">
          <SheetHeader>
            <SheetTitle>{editId ? t('goals.sheet.title_edit') : t('goals.sheet.title_new')}</SheetTitle>
            <SheetDescription>{t('goals.sheet.desc')}</SheetDescription>
          </SheetHeader>
          
          <div className="mt-6">
            <Tabs value={sheetType} onValueChange={(val: any) => setSheetType(val)} className="w-full">
              <TabsList className="w-full grid border-border bg-muted/50 p-1 rounded-xl" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <TabsTrigger value="FINANCIAL" className="rounded-lg">{t('goals.sheet.type_financial')}</TabsTrigger>
                <TabsTrigger value="DAILY" className="rounded-lg">{t('goals.sheet.type_daily')}</TabsTrigger>
                <TabsTrigger value="TODO" className="rounded-lg">{t('goals.sheet.type_todo')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <form onSubmit={onSubmit} className="space-y-6 mt-8">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('goals.form.title')}</label>
              <Input name="title" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder={sheetType === "FINANCIAL" ? t('goals.form.title_ph_financial') : (sheetType === "DAILY" ? t('goals.form.title_ph_daily') : t('goals.form.title_ph_todo'))} className="bg-muted/50" />
            </div>
            
            {(sheetType === "FINANCIAL" || sheetType === "DAILY") && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('goals.form.target')}</label>
                  <Input name="targetAmount" type="number" value={formData.targetAmount} onChange={e => setFormData({...formData, targetAmount: e.target.value})} required placeholder="50000" className="bg-muted/50" />
                </div>
                {sheetType === "FINANCIAL" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-orange-500" /> {t('goals.form.sync')}
                    </label>
                    <p className="text-xs text-muted-foreground mb-2">{t('goals.form.sync_desc')}</p>
                    <select name="trackCategory" value={formData.trackCategory} onChange={e => setFormData({...formData, trackCategory: e.target.value})} className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-muted/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                      <option value="">{t('goals.form.sync_none')}</option>
                      <option value="DAILY_BALANCE">{t('goals.form.sync_daily')}</option>
                      <option value="Investment">{t('goals.form.sync_investment')}</option>
                      <option value="Saving">{t('goals.form.sync_saving')}</option>
                      <option value="Income">{t('goals.form.sync_income')}</option>
                      <option value="Expense">{t('goals.form.sync_expense')}</option>
                    </select>
                  </div>
                )}
              </>
            )}

            {sheetType === "TODO" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('goals.form.details')}</label>
                <textarea 
                  name="description" 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder={t('goals.form.details_ph')} 
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">{sheetType === "TODO" ? t('goals.form.deadline_todo') : (sheetType === "DAILY" ? t('goals.form.deadline_daily') : t('goals.form.deadline_financial'))}</label>
              <Input 
                name="deadline" 
                type={sheetType === "TODO" ? "datetime-local" : "date"} 
                required={sheetType !== "DAILY"} 
                value={formData.deadline.slice(0, sheetType === "TODO" ? 16 : 10)}
                onChange={e => setFormData({...formData, deadline: e.target.value})}
                className="bg-muted/50" 
              />
            </div>
            
            <SheetFooter className="mt-8">
              <Button type="submit" disabled={isSubmitLoading} className="w-full">
                {isSubmitLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t('goals.form.submit')}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function RenderFinancial({ goals, setGoalToDelete, openEditSheet, formatDate, loading }: any) {
  const { t, tc } = useLanguage()
  if (loading) return <LoadingPlaceholder />
  return (
    <AnimatePresence>
      {goals.map((goal: any, idx: number) => {
        const progressPercentage = Math.min(100, Math.max(0, (goal.currentAmount / goal.targetAmount) * 100))
        const isCompleted = progressPercentage === 100
        
        return (
          <motion.div key={goal.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: idx * 0.1 }}>
            <Card onClick={() => openEditSheet(goal)} className={cn("h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 glass-panel cursor-pointer", isCompleted ? 'border-primary/50' : 'border-border/50')}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      {goal.title}
                    </CardTitle>
                    {goal.trackCategory && (
                      <Badge variant="outline" className="mt-2 text-xs font-normal border-orange-200 text-orange-600 dark:border-orange-900 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30">
                        <LinkIcon className="w-3 h-3 mr-1" /> {t('goals.card.syncs', { category: goal.trackCategory === 'DAILY_BALANCE' ? t('goals.form.sync_daily') : tc(goal.trackCategory) })}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isCompleted && <Badge className="bg-emerald-500 text-white border-none shadow-sm">{t('goals.card.achieved')}</Badge>}
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); setGoalToDelete(goal.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="flex items-center gap-1 font-medium text-foreground/80">
                  <TrendingUp className="h-4 w-4" /> 
                  ฿{goal.currentAmount.toLocaleString()} / ฿{goal.targetAmount.toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-medium text-muted-foreground">
                    <span>{t('goals.card.progress')}</span>
                    <span className={cn("font-bold", progressPercentage >= 100 ? "text-emerald-500" : "text-primary")}>
                      {((goal.currentAmount / goal.targetAmount) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={progressPercentage} className={cn("h-2.5", progressPercentage >= 100 ? "[&>div]:bg-emerald-500" : "")} />
                </div>
                <div className="pt-2 text-xs text-muted-foreground border-t border-border/50">
                  <span className="font-medium text-foreground/70">{t('goals.card.deadline')}</span> {formatDate(goal.deadline)}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </AnimatePresence>
  )
}

function RenderTodos({ todos, setGoalToDelete, openEditSheet, toggleCompletion, formatDate, loading }: any) {
  if (loading) return <LoadingPlaceholder />
  return (
    <AnimatePresence>
      {todos.map((todo: any, idx: number) => {
        return (
          <motion.div key={todo.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: idx * 0.1 }}>
            <Card id={todo.id} onClick={() => openEditSheet(todo)} className={cn("h-full overflow-hidden transition-all duration-300 hover:shadow-md glass-panel target:ring-2 target:ring-primary target:ring-offset-2 target:ring-offset-background cursor-pointer", todo.isCompleted ? 'opacity-60 bg-muted/20 border-border/20' : 'border-border/50 hover:border-primary/50')}>
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleCompletion(todo.id, todo.isCompleted); }}
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                  >
                    {todo.isCompleted ? <CheckCircle2 className="w-6 h-6 text-primary" /> : <Circle className="w-6 h-6" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h4 className={cn("font-semibold text-base break-words", todo.isCompleted && "line-through text-muted-foreground")}>{todo.title}</h4>
                      <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-2 text-muted-foreground hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); setGoalToDelete(todo.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {todo.description && (
                      <p className={cn("text-sm text-balance mb-3", todo.isCompleted ? "text-muted-foreground/60" : "text-muted-foreground")}>
                        {todo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 pt-3 border-t border-border/50 text-xs font-medium">
                      <CalendarClock className="w-3.5 h-3.5 text-primary/70" />
                      <span className={todo.isCompleted ? "text-muted-foreground/80" : "text-foreground/80"}>
                        {formatDate(todo.deadline, true)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </AnimatePresence>
  )
}

function LoadingPlaceholder() {
  const { t } = useLanguage()
  return (
     <div className="col-span-full flex flex-col items-center justify-center py-10 text-muted-foreground animate-in fade-in">
        <motion.img 
          src="/favicon.png" 
          alt="Loading..." 
          className="w-12 h-12 mb-2 drop-shadow-md"
          animate={{ y: [0, -15, 0] }}
          transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
        />
        <p className="font-medium animate-pulse text-sm">{t('common.loading')}</p>
     </div>
  )
}
