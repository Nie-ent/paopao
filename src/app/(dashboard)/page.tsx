"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"
import { ArrowUpRight, ArrowDownRight, Wallet, Sparkles, Loader2, Calendar, Clock, Activity } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getDashboardData } from "@/features/dashboard/actions"
import { generateDashboardInsight } from "@/features/ai/actions"
import { useLanguage } from "@/contexts/LanguageContext"

type Timeframe = 'ALL' | 'YTD' | 'MONTH' | 'WEEK'

const INCOME_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6']
const EXPENSE_COLORS = ['#ef4444', '#f97316', '#eab308', '#06b6d4', '#6366f1', '#d946ef']
const DONUT_COLORS = ['#10b981', '#ef4444'] // Income, Expense

export default function DashboardOverview() {
  const { t, language } = useLanguage()
  const [timeframe, setTimeframe] = useState<Timeframe>('ALL')
  const [dbData, setDbData] = useState<any>(null)
  const [insight, setInsight] = useState<string | null>(null)
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, title: string, data: any[], colors: string[]}>({
    isOpen: false, title: '', data: [], colors: []
  })
  
  // Fetch Data Payload
  useEffect(() => {
    setDbData(null)
    getDashboardData(timeframe).then((data) => {
      setDbData(data)
    }).catch((err) => {
      setDbData({ error: "Failed to connect to AI Core." })
    })
  }, [timeframe])

  // Lazy Load AI Insight (Once per day/language)
  useEffect(() => {
    generateDashboardInsight(language, 'MONTH').then(res => {
      if (res?.advice) {
        setInsight(res.advice)
      } else if (res?.error) {
        setInsight(res.error)
      } else {
        setInsight(language === 'th' ? "❌ ไม่สามารถดึงคำแนะนำได้ (โควต้า Gemini API ประจำเดือนของคุณอาจหมดแล้ว)" : "❌ AI service unavailable. Your Gemini API quota may be exhausted.")
      }
    }).catch(() => {
      setInsight(language === 'th' ? "❌ การเชื่อมต่อ AI ล้มเหลว" : "❌ AI connection failed.")
    })
  }, [language])

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
        <div className="flex bg-muted/50 p-1 rounded-lg self-start sm:self-auto overflow-x-auto no-scrollbar max-w-full">
          <Button 
            variant={timeframe === 'ALL' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setTimeframe('ALL')}
            className={timeframe === 'ALL' ? 'shadow-sm whitespace-nowrap' : 'whitespace-nowrap'}
          >
            <Activity className="w-4 h-4 mr-2" /> ทั้งหมด
          </Button>
          <Button 
            variant={timeframe === 'YTD' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setTimeframe('YTD')}
            className={timeframe === 'YTD' ? 'shadow-sm whitespace-nowrap' : 'whitespace-nowrap'}
          >
            <Calendar className="w-4 h-4 mr-2" /> รายปี
          </Button>
          <Button 
            variant={timeframe === 'MONTH' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setTimeframe('MONTH')}
            className={timeframe === 'MONTH' ? 'shadow-sm whitespace-nowrap' : 'whitespace-nowrap'}
          >
            <Activity className="w-4 h-4 mr-2" /> รายเดือน
          </Button>
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
              <div className="h-[280px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                    <Pie data={balanceData} innerRadius={55} outerRadius={75} paddingAngle={2} dataKey="value" stroke="none">
                      {balanceData.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v: any) => `฿${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '12px', paddingTop: '15px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Income Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Card 
            className="glass-panel overflow-hidden relative h-full flex flex-col cursor-pointer transition-all hover:ring-2 hover:ring-emerald-500/50 hover:shadow-lg"
            onClick={() => setModalConfig({ isOpen: true, title: t('dashboard.total_income'), data: incomeByCategory, colors: INCOME_COLORS })}
          >
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
              <div className="h-[280px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                    <Pie data={incomeByCategory.length ? incomeByCategory : [{name: 'None', value: 1}]} innerRadius={55} outerRadius={75} paddingAngle={2} dataKey="value" stroke="none">
                      {(incomeByCategory.length ? incomeByCategory : [{name: 'None', value: 1}]).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={incomeByCategory.length ? INCOME_COLORS[index % INCOME_COLORS.length] : '#888'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v: any) => `฿${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '12px', paddingTop: '15px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Expense Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <Card 
            className="glass-panel overflow-hidden relative h-full flex flex-col cursor-pointer transition-all hover:ring-2 hover:ring-red-500/50 hover:shadow-lg"
            onClick={() => setModalConfig({ isOpen: true, title: t('dashboard.total_expense'), data: expenseByCategory, colors: EXPENSE_COLORS })}
          >
            <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl -mt-8 -mr-8 pointer-events-none" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.total_expense')}</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              <div>
                <div className="text-2xl font-bold">฿{stats.totalExpense.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Lifetime Expense</p>
              </div>
              <div className="h-[280px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                    <Pie data={expenseByCategory.length ? expenseByCategory : [{name: 'None', value: 1}]} innerRadius={55} outerRadius={75} paddingAngle={2} dataKey="value" stroke="none">
                      {(expenseByCategory.length ? expenseByCategory : [{name: 'None', value: 1}]).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={expenseByCategory.length ? EXPENSE_COLORS[index % EXPENSE_COLORS.length] : '#888'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v: any) => `฿${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '12px', paddingTop: '15px' }} />
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
            {/* The timeframe buttons have been moved to the top of the dashboard */}
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

      {/* Category List Modal */}
      <Dialog open={modalConfig.isOpen} onOpenChange={(open) => setModalConfig({ ...modalConfig, isOpen: open })}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>รายละเอียดหมวดหมู่ ({modalConfig.title})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {modalConfig.data && modalConfig.data.length > 0 ? (
              (() => {
                const totalValue = modalConfig.data.reduce((acc, curr) => Number(acc) + Number(curr.value), 0);
                return modalConfig.data.map((item, index) => {
                  const percent = totalValue > 0 ? ((Number(item.value) / totalValue) * 100).toFixed(1) : "0.0";
                  return (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: modalConfig.colors[index % modalConfig.colors.length] }} 
                        />
                        <span className="font-medium line-clamp-1">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-bold">฿{item.value.toLocaleString()}</span>
                        <span className="text-sm font-medium text-muted-foreground w-12 text-right">{percent}%</span>
                      </div>
                    </div>
                  );
                });
              })()
            ) : (
              <div className="text-center text-muted-foreground py-8">ไม่มีข้อมูลในหมวดหมู่นี้</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
