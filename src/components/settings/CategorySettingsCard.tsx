"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Palette, Trash2, Plus, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getCategoryColors, updateCategoryColors } from "@/features/settings/actions"
import { useLanguage } from "@/contexts/LanguageContext"

// Mirrors the global categories (and their default colors) in the DB
const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  'Salary': '#10b981',
  'Freelance': '#3b82f6',
  'Business': '#8b5cf6',
  'Investment Income': '#2dd4bf',
  'Gift': '#f59e0b',
  'Transfer In': '#6366f1',
  'Other Income': '#ec4899',
  'Food': '#ef4444',
  'Groceries': '#84cc16',
  'Transport': '#f97316',
  'Housing': '#06b6d4',
  'Utilities': '#eab308',
  'Shopping': '#d946ef',
  'Personal Care': '#ec4899',
  'Entertainment': '#6366f1',
  'Education': '#3b82f6',
  'Family & Pets': '#f43f5e',
  'Health & Medical': '#14b8a6',
  'Investment': '#2dd4bf',
  'Saving': '#10b981',
  'Transfer Out': '#8b5cf6',
  'Debt Payment': '#ef4444',
  'Gift & Donation': '#f59e0b',
  'Other Expense': '#64748b'
}

export function CategorySettingsCard() {
  const { t, tc } = useLanguage()
  const [colors, setColors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newCategory, setNewCategory] = useState("")

  useEffect(() => {
    async function loadColors() {
      const res = await getCategoryColors()
      if (res.success && res.categoryColors) {
        setColors(res.categoryColors)
      }
      setLoading(false)
    }
    loadColors()
  }, [])

  const handleColorChange = (category: string, color: string) => {
    setColors(prev => ({ ...prev, [category]: color }))
  }

  const handleSave = async () => {
    setSaving(true)
    const res = await updateCategoryColors(colors)
    if (res.success) {
      toast.success(t('settings.colors.saved'))
    } else {
      toast.error(t('settings.colors.save_failed'))
    }
    setSaving(false)
  }

  const handleAddCategory = () => {
    if (!newCategory.trim()) return
    const cat = newCategory.trim()
    if (colors[cat] || DEFAULT_CATEGORY_COLORS[cat]) {
      toast.error(t('settings.colors.exists'))
      return
    }
    setColors(prev => ({ ...prev, [cat]: '#64748b' }))
    setNewCategory("")
  }

  const handleDeleteCustom = (cat: string) => {
    const newColors = { ...colors }
    delete newColors[cat]
    setColors(newColors)
  }

  if (loading) {
    return (
      <Card className="glass-panel border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Palette className="h-5 w-5 text-primary" />
            {t('settings.colors.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  const allCategories = Array.from(new Set([...Object.keys(DEFAULT_CATEGORY_COLORS), ...Object.keys(colors)]))
  const defaultCats = Object.keys(DEFAULT_CATEGORY_COLORS)
  const customCats = Object.keys(colors).filter(c => !defaultCats.includes(c))

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Palette className="h-5 w-5 text-primary" />
          {t('settings.colors.title')}
        </CardTitle>
        <CardDescription>
          {t('settings.colors.desc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Custom Categories Section */}
        <div className="space-y-4">
          <h3 className="font-medium text-foreground text-sm border-b pb-2 border-border/50">{t('settings.colors.custom')}</h3>
          
          <div className="flex gap-2">
            <Input 
              placeholder={t('settings.colors.custom_ph')}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="bg-background/50"
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            />
            <Button onClick={handleAddCategory} variant="secondary" className="shrink-0">
              <Plus className="w-4 h-4 mr-1" /> {t('common.add')}
            </Button>
          </div>

          {customCats.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">{t('settings.colors.custom_empty')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AnimatePresence>
                {customCats.map(cat => (
                  <motion.div 
                    key={cat}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50 shadow-sm"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <input 
                        type="color" 
                        value={colors[cat] || '#64748b'} 
                        onChange={(e) => handleColorChange(cat, e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer shrink-0 border-0 p-0 bg-transparent"
                      />
                      <span className="text-sm font-medium truncate">{cat}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDeleteCustom(cat)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Default Categories Section */}
        <div className="space-y-4">
          <h3 className="font-medium text-foreground text-sm border-b pb-2 border-border/50">{t('settings.colors.default')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {defaultCats.map(cat => (
              <div key={cat} className="flex items-center justify-between p-2 rounded-lg bg-background/30 border border-border/30">
                <div className="flex items-center gap-3 overflow-hidden">
                  <input 
                    type="color" 
                    value={colors[cat] || DEFAULT_CATEGORY_COLORS[cat]} 
                    onChange={(e) => handleColorChange(cat, e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer shrink-0 border-0 p-0 bg-transparent"
                  />
                  <span className="text-sm font-medium truncate">{tc(cat)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="shadow-md">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {t('settings.colors.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
