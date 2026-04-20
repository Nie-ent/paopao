"use client"

import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Target, TrendingUp, Trophy, Plus, Loader2, Trash2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetFooter } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { getGoals, createGoal, deleteGoal } from "@/features/goals/actions"
import { toast } from "sonner"
import { useLanguage } from "@/contexts/LanguageContext"

export default function GoalsPage() {
  const { t, language } = useLanguage()
  const [goals, setGoals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitLoading, setIsSubmitLoading] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null)

  useEffect(() => {
    fetchGoals()
  }, [])

  const fetchGoals = async () => {
    setLoading(true)
    const res = await getGoals()
    if (res.data) setGoals(res.data)
    setLoading(false)
  }

  const handleCreate = async (formData: FormData) => {
    setIsSubmitLoading(true)
    const res = await createGoal(formData)
    if (res.success) {
      toast.success("Goal created!", { description: "Your new financial target has been set." })
      setIsSheetOpen(false)
      fetchGoals()
    } else {
      toast.error("Error", { description: res.error || "Failed to create goal." })
    }
    setIsSubmitLoading(false)
  }

  const executeDelete = async () => {
    if (!goalToDelete) return;
    const res = await deleteGoal(goalToDelete)
    if (res.success) {
      toast.success("Goal deleted", { description: "The goal has been permanently removed." })
      fetchGoals()
    } else {
      toast.error("Error", { description: "Failed to delete the goal." })
    }
    setGoalToDelete(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground/90 flex items-center gap-2">
            <Target className="h-8 w-8 text-primary" /> {t('goals.title')}
          </h2>
          <p className="text-muted-foreground">{t('goals.subtitle')}</p>
        </div>
        
        <Button className="shrink-0 shadow-lg shadow-primary/20" onClick={() => setIsSheetOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> {t('goals.btn.add')}
        </Button>
        <AlertDialog open={!!goalToDelete} onOpenChange={(open) => !open && setGoalToDelete(null)}>
          <AlertDialogContent className="glass-panel border-destructive/20 border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="w-5 h-5"/>
                Delete Warning
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you absolutely sure you want to demolish this target? 
                This action is irreversible and the AI will stop tracking it immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={executeDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                Yes, nuke it
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent className="bg-background border-border overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Create Financial Goal</SheetTitle>
              <SheetDescription>Set a new target. The AI will monitor your pacing automatically.</SheetDescription>
            </SheetHeader>
            <form action={handleCreate} className="space-y-6 mt-8">
              <div className="space-y-2">
                <label className="text-sm font-medium">Goal Title</label>
                <Input name="title" required placeholder="e.g. New Car, Japan Trip" className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Amount (฿)</label>
                <Input name="targetAmount" type="number" required placeholder="50000" className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Deadline</label>
                <Input name="deadline" type="date" required className="bg-muted/50" />
              </div>
              <SheetFooter className="mt-8">
                <Button type="submit" disabled={isSubmitLoading} className="w-full">
                  {isSubmitLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Goal
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
            <p>Loading your targets...</p>
          </div>
        ) : goals.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center py-24 glass-panel rounded-xl text-muted-foreground">
            <Trophy className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-lg font-medium text-foreground">No Goals Set</p>
            <p className="max-w-sm text-center mt-2">Start defining your financial destiny by creating your first savings target.</p>
          </div>
        ) : (
          <AnimatePresence>
            {goals.map((goal, idx) => {
              const progressPercentage = Math.min(100, Math.max(0, (goal.currentAmount / goal.targetAmount) * 100))
              const isCompleted = progressPercentage === 100
              
              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                >
                  <Card className={`h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isCompleted ? 'border-primary/50' : 'border-border/50'} glass-panel`}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start gap-4">
                        <CardTitle className="text-xl">{goal.title}</CardTitle>
                        <div className="flex items-center gap-2">
                          {isCompleted && (
                            <Badge className="bg-primary hover:bg-primary text-primary-foreground border-none">
                              Achieved
                            </Badge>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => setGoalToDelete(goal.id)}
                          >
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
                          <span>Progress</span>
                          <span>{progressPercentage.toFixed(1)}%</span>
                        </div>
                        <Progress value={progressPercentage} className="h-2.5" />
                      </div>
                      <div className="pt-2 text-xs text-muted-foreground border-t border-border/50">
                        <span className="font-medium text-foreground/70">Deadline:</span> {goal.deadline ? new Date(goal.deadline).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'No fixed date'}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
