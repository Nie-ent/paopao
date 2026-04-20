"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"
import { ArrowUpRight, ArrowDownRight, Wallet, Sparkles, Loader2, Calendar, Clock, Activity } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { getDashboardData } from "@/features/dashboard/actions"
import { generateDashboardInsight } from "@/features/ai/actions"
import { useLanguage } from "@/contexts/LanguageContext"

type Timeframe = 'YTD' | 'MONTH' | 'WEEK'

const INCOME_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6']
const EXPENSE_COLORS = ['#ef4444', '#f97316', '#eab308', '#06b6d4', '#6366f1', '#d946ef']
const DONUT_COLORS = ['#10b981', '#ef4444'] // Income, Expense

export default function DashboardOverview() {
  const { t, language } = useLanguage()
  const [timeframe, setTimeframe] = useState<Timeframe>('MONTH')
  const [dbData, setDbData] = useState<any>(null)
  const [insight, setInsight] = useState<string | null>(null)
  
  // Fetch Data Payload
  useEffect(() => {
    setDbData(null)
    getDashboardData(timeframe).then((data) => {
      setDbData(data)
    }).catch((err) => {
      setDbData({ error: "Failed to connect to AI Core." })
    })
  }, [timeframe])

  // Lazy Load AI Insight
  useEffect(() => {
    setInsight(null)
    generateDashboardInsight(language, timeframe).then(res => {
      if (res.advice) setInsight(res.advice)
    })
  }, [language, timeframe])

  if (!dbData) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-muted-foreground animate-in fade-in">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
        <p>{t('dashboard.syncing')}</p>
      </div>
    )
  }

  if (dbData.error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-destructive animate-in fade-in">
        <p className="text-xl font-bold mb-2">{t('dashboard.error')}</p>
        <p>{dbData.error}</p>
      </div>
    )
  }

  const { chartData, stats, incomeByCategory, expenseByCategory } = dbData
  const balanceData = [
    { name: 'Income', value: stats.totalIncome },
    { name: 'Expense', value: stats.totalExpense }
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground/90">{t('dashboard.title')}</h2>
          <p className="text-muted-foreground">{t('dashboard.welcome')}</p>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Alert className="glass-card border-primary/20 bg-primary/5">
          <Sparkles className="h-5 w-5 text-primary" />
          <AlertTitle className="text-primary font-semibold">{t('dashboard.gemini_insight')}</AlertTitle>
          <AlertDescription className="text-muted-foreground min-h-[24px] flex items-center">
            {insight ? (
              <span className="animate-in fade-in">{insight}</span>
            ) : (
              <span className="flex items-center gap-2 opacity-60">
                <Loader2 className="h-4 w-4 animate-spin" /> 
                {language === 'th' ? "ผู้ช่วยกำลังคิดคำแนะนำให้คุณ..." : "Assistant is thinking..."}
              </span>
            )}
          </AlertDescription>
        </Alert>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Balance Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.0 }}>
          <Card className="glass-panel overflow-hidden relative h-full flex flex-col">
            <div className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mt-8 -mr-8 pointer-events-none" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.total_balance')}</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              <div>
                <div className="text-2xl font-bold">฿{stats.totalBalance.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Overall Net Balance</p>
              </div>
              <div className="h-[120px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <Pie data={balanceData} innerRadius={25} outerRadius={35} paddingAngle={2} dataKey="value" stroke="none">
                      {balanceData.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                    <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '10px', right: 0, lineHeight: '14px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Income Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Card className="glass-panel overflow-hidden relative h-full flex flex-col">
            <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mt-8 -mr-8 pointer-events-none" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.total_income')}</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              <div>
                <div className="text-2xl font-bold">฿{stats.totalIncome.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Lifetime Income</p>
              </div>
              <div className="h-[120px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <Pie data={incomeByCategory.length ? incomeByCategory : [{name: 'None', value: 1}]} innerRadius={25} outerRadius={35} paddingAngle={2} dataKey="value" stroke="none">
                      {(incomeByCategory.length ? incomeByCategory : [{name: 'None', value: 1}]).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={incomeByCategory.length ? INCOME_COLORS[index % INCOME_COLORS.length] : '#888'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v) => `฿${v}`} />
                    <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '10px', right: 0, lineHeight: '14px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Expense Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <Card className="glass-panel overflow-hidden relative h-full flex flex-col">
            <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl -mt-8 -mr-8 pointer-events-none" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.total_expense')}</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              <div>
                <div className="text-2xl font-bold">฿{stats.totalExpense.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Lifetime Expense</p>
              </div>
              <div className="h-[120px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <Pie data={expenseByCategory.length ? expenseByCategory : [{name: 'None', value: 1}]} innerRadius={25} outerRadius={35} paddingAngle={2} dataKey="value" stroke="none">
                      {(expenseByCategory.length ? expenseByCategory : [{name: 'None', value: 1}]).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={expenseByCategory.length ? EXPENSE_COLORS[index % EXPENSE_COLORS.length] : '#888'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v) => `฿${v}`} />
                    <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '10px', right: 0, lineHeight: '14px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="glass-card">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Cash Flow Overview</CardTitle>
              <CardDescription>Visualizing your cash flow across different timelines.</CardDescription>
            </div>
            <div className="flex bg-muted/50 p-1 rounded-lg self-start sm:self-auto">
              <Button 
                variant={timeframe === 'YTD' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setTimeframe('YTD')}
                className={timeframe === 'YTD' ? 'shadow-sm' : ''}
              >
                <Calendar className="w-4 h-4 mr-2" /> {t('dashboard.time.ytd')}
              </Button>
              <Button 
                variant={timeframe === 'MONTH' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setTimeframe('MONTH')}
                className={timeframe === 'MONTH' ? 'shadow-sm' : ''}
              >
                <Activity className="w-4 h-4 mr-2" /> {t('dashboard.time.month')}
              </Button>
              <Button 
                variant={timeframe === 'WEEK' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setTimeframe('WEEK')}
                className={timeframe === 'WEEK' ? 'shadow-sm' : ''}
              >
                <Clock className="w-4 h-4 mr-2" /> {t('dashboard.time.week')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.60 0.11 200)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="oklch(0.60 0.11 200)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.60 0.15 20)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="oklch(0.60 0.15 20)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `฿${value}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="income" stroke="oklch(0.60 0.11 200)" fillOpacity={1} fill="url(#colorIncome)" />
                  <Area type="monotone" dataKey="expense" stroke="oklch(0.60 0.15 20)" fillOpacity={1} fill="url(#colorExpense)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
