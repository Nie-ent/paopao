"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Gift, Star, ShoppingBag, Coins, Loader2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { fetchProfileDataCached } from "@/lib/clientCache"
import { getAvailableRewards, redeemReward, getUserClaims } from "@/features/quests/actions"
import { toast } from "sonner"
import { useLanguage } from "@/contexts/LanguageContext"

export default function RewardsPage() {
  const { t, locale } = useLanguage()
  const [points, setPoints] = useState<number | null>(null)
  const [rewards, setRewards] = useState<any[]>([])
  const [claims, setClaims] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const redeemLockRef = React.useRef(false)
  
  const loadData = async () => {
    fetchProfileDataCached().then(user => {
      if (user) setPoints(user.paoPoints || 0)
    })
    getAvailableRewards().then(setRewards)
    getUserClaims().then(setClaims)
  }

  useEffect(() => { loadData() }, [])

  const handleRedeem = async (item: any) => {
    if (loading || redeemLockRef.current) return
    if (points === null) return
    if (points < item.points) {
      toast.error(t('rewards.not_enough', { points: item.points - points }))
      return
    }
    
    redeemLockRef.current = true
    setLoading(true)
    try {
      const res = await redeemReward(item.id)
      if (res.success) {
        toast.success(t('rewards.redeemed', { name: item.name }), { description: t('rewards.redeemed_desc') })
        setPoints(prev => prev! - item.points)
        window.dispatchEvent(new Event('points_updated')) // Notify Header
        loadData() // Refresh list of claims
      } else {
        toast.error(t(res.error || 'rewards.redeem_failed'))
      }
    } finally {
      setLoading(false)
      redeemLockRef.current = false
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground/90">{t('rewards.title')}</h2>
          <p className="text-muted-foreground">{t('rewards.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 font-bold border border-orange-200 dark:border-orange-900/50">
          <Coins className="w-5 h-5" />
          <span className="text-lg">{points === null ? <img src="/favicon.png" className="w-4 h-4 rounded-full inline animate-bounce" alt="Loading" /> : points} Pts</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        {rewards.map((item, idx) => (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1, duration: 0.3 }}
          >
            <Card className="glass-panel overflow-hidden h-full flex flex-col hover:border-orange-200 dark:hover:border-orange-900 transition-colors">
              <div className="h-32 bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-950/40 dark:to-orange-900/40 flex items-center justify-center text-6xl">
                {item.iconString}
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg line-clamp-2 leading-tight">{item.name}</CardTitle>
                {item.description && <CardDescription className="text-xs line-clamp-1">{item.description}</CardDescription>}
              </CardHeader>
              <CardContent className="flex-1 flex items-end">
                <p className="text-orange-500 font-bold text-xl flex items-center gap-1">
                  {item.points} <span className="text-sm font-normal text-muted-foreground">Pts</span>
                </p>
              </CardContent>
              <CardFooter className="pt-0">
                <Button 
                  onClick={() => handleRedeem(item)}
                  disabled={loading || item.status === 'OUT_OF_STOCK' || points === null || points < item.points} 
                  className={`w-full ${item.status === 'OUT_OF_STOCK' ? 'bg-muted text-muted-foreground' : 'bg-orange-500 hover:bg-orange-600'}`}
                >
                  {item.status === 'OUT_OF_STOCK' ? t('rewards.out_of_stock') : t('rewards.redeem')}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ))}
        {rewards.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground flex flex-col items-center">
            <Gift className="w-12 h-12 opacity-20 mb-4" />
            <p>{t('rewards.empty')}</p>
          </div>
        )}
      </div>

      <div className="mt-12 max-w-4xl mx-auto">
        <h3 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-orange-500" />
          {t('rewards.history')}
        </h3>
        <Card className="shadow-sm border-orange-200/50">
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {claims.map(claim => (
                <div key={claim.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-2xl shrink-0 border border-orange-200 dark:border-orange-900/60">
                      {claim.reward.iconString}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">{claim.reward.name}</p>
                      <p className="text-xs text-slate-500">{new Date(claim.createdAt).toLocaleString(locale)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 flex-1">
                    <span className="text-sm font-semibold text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-2 py-1 rounded">
                      -{claim.reward.points} Pts
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      claim.status === 'PENDING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' : 
                      claim.status === 'SHIPPED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 
                      'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                    }`}>
                      {claim.status === 'PENDING' ? t('rewards.status.pending') : claim.status === 'SHIPPED' ? t('rewards.status.shipped') : t('rewards.status.rejected')}
                    </span>
                  </div>
                </div>
              ))}
              {claims.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">
                  {t('rewards.history_empty')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
