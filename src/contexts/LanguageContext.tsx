"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

type Language = 'en' | 'th'

type LanguageContextType = {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.transactions': 'Transactions',
    'nav.ai_insights': 'PaoPao Insights',
    'nav.goals': 'Goals',
    'nav.settings': 'Settings',
    'header.search': 'Search transactions...',
    'header.account': 'My Account',
    'header.settings': 'Platform Settings',
    'header.language': 'Language: 🇺🇸 English',
    'header.logout': 'Log out',
    'dashboard.welcome': 'Welcome back! Here\'s your financial summary.',
    'dashboard.syncing': 'Syncing secure transactions...',
    'dashboard.error': 'Sync Error',
    'dashboard.title': 'Dashboard',
    'dashboard.total_balance': 'Total Balance',
    'dashboard.total_income': 'Total Income',
    'dashboard.total_expense': 'Total Expense',
    'dashboard.live': 'Live',
    'dashboard.from_last_month': 'from last month',
    'dashboard.gemini_insight': 'PaoPao Insight',
    'dashboard.time.ytd': 'YTD',
    'dashboard.time.month': 'Month',
    'dashboard.time.week': 'Week',
    'transactions.title': 'Transactions',
    'transactions.subtitle': 'Manage and audit your latest cash flows recorded via LINE.',
    'transactions.btn.add': 'Add Transaction',
    'transactions.filter.all': 'All',
    'transactions.filter.income': 'Income',
    'transactions.filter.expense': 'Expense',
    'transactions.table.date': 'Date',
    'transactions.table.source': 'Source',
    'transactions.table.category': 'Category',
    'transactions.table.amount': 'Amount (฿)',
    'transactions.table.payment': 'Payment Method',
    'transactions.table.notes': 'Notes',
    'transactions.empty': 'No transactions found for this period.',
    'transactions.pagination.prev': 'Previous',
    'transactions.pagination.next': 'Next',
    'transactions.action.edit': 'Edit',
    'transactions.action.save': 'Save Changes',
    'transactions.form.title.add': 'Add Manual Transaction',
    'transactions.form.title.edit': 'Edit Transaction',
    'transactions.sort.date_desc': 'Newest First',
    'transactions.sort.date_asc': 'Oldest First',
    'transactions.sort.category': 'Category',
    'goals.title': 'Financial Goals',
    'goals.subtitle': 'Track your savings and investment objectives.',
    'goals.btn.add': 'Add Goal',
    'goals.card.target': 'Target:',
    'goals.card.saved': 'Saved',
    'goals.card.deadline': 'Deadline:',
    'ai.title': 'PaoPao Insights',
    'ai.subtitle': 'Personalized financial advice generated mathematically by PaoPao',
    'ai.card.title': 'Cash Flow Analysis',
    'ai.card.desc': 'PaoPao reads your last 30 days of transactions to deliver targeted advice.',
    'ai.loading': 'Synthesizing PaoPao wisdom...',
    'ai.footer.anonymous': 'Data is strictly anonymous before processing.',
    'ai.btn.regenerate': 'Regenerate',
  },
  th: {
    'nav.dashboard': 'ภาพรวม',
    'nav.transactions': 'รายการธุรกรรม',
    'nav.ai_insights': 'วิเคราะห์ด้วย PaoPao',
    'nav.goals': 'เป้าหมาย',
    'nav.settings': 'การตั้งค่า',
    'header.search': 'ค้นหารายการ...',
    'header.account': 'บัญชีของฉัน',
    'header.settings': 'ตั้งค่าระบบ',
    'header.language': 'ภาษา: 🇹🇭 ไทย',
    'header.logout': 'ออกจากระบบ',
    'dashboard.welcome': 'ยินดีต้อนรับกลับมา! นี่คือสรุปสถานะการเงินของคุณ',
    'dashboard.syncing': 'กำลังซิงค์ข้อมูลอย่างปลอดภัย...',
    'dashboard.error': 'ข้อผิดพลาดการซิงค์',
    'dashboard.title': 'ภาพรวม (Dashboard)',
    'dashboard.total_balance': 'ยอดคงเหลือรวม',
    'dashboard.total_income': 'รายรับรวม',
    'dashboard.total_expense': 'รายจ่ายรวม',
    'dashboard.live': 'อัปเดตล่าสุด',
    'dashboard.from_last_month': 'จากเดือนที่แล้ว',
    'dashboard.gemini_insight': 'คำแนะนำจาก PaoPao',
    'dashboard.time.ytd': 'จนถึงปัจจุบัน',
    'dashboard.time.month': 'เดือนนี้',
    'dashboard.time.week': 'สัปดาห์นี้',
    'transactions.title': 'รายการธุรกรรม',
    'transactions.subtitle': 'จัดการและตรวจสอบกระแสเงินสดล่าสุดที่บันทึกผ่านระบบ LINE',
    'transactions.btn.add': 'เพิ่มรายการ',
    'transactions.filter.all': 'ทั้งหมด',
    'transactions.filter.income': 'รายรับ',
    'transactions.filter.expense': 'รายจ่าย',
    'transactions.table.date': 'วันที่',
    'transactions.table.source': 'แหล่งที่มา',
    'transactions.table.category': 'หมวดหมู่',
    'transactions.table.amount': 'จำนวนเงิน (฿)',
    'transactions.table.payment': 'ช่องทาง',
    'transactions.table.notes': 'โน้ตเพิ่มเติม',
    'transactions.empty': 'ไม่พบรายการธุรกรรมในช่วงเวลานี้',
    'transactions.pagination.prev': 'ก่อนหน้า',
    'transactions.pagination.next': 'ถัดไป',
    'transactions.action.edit': 'แก้ไข',
    'transactions.action.save': 'บันทึกข้อมูล',
    'transactions.form.title.add': 'เพิ่มรายการด้วยตนเอง',
    'transactions.form.title.edit': 'แก้ไขรายการ',
    'transactions.sort.date_desc': 'ใหม่ล่าสุด',
    'transactions.sort.date_asc': 'เก่าที่สุด',
    'transactions.sort.category': 'หมวดหมู่',
    'goals.title': 'เป้าหมายทางการเงิน',
    'goals.subtitle': 'ติดตามแผนการออมเงินและการลงทุนของคุณ',
    'goals.btn.add': 'เพิ่มเป้าหมาย',
    'goals.card.target': 'เป้าหมาย:',
    'goals.card.saved': 'ออมแล้ว',
    'goals.card.deadline': 'กำหนดเวลา:',
    'ai.title': 'คำแนะนำจาก PaoPao',
    'ai.subtitle': 'ผลประมวลผลคำแนะนำทางการเงินส่วนบุคคลผ่านขุมพลังการคำนวณของ PaoPao',
    'ai.card.title': 'วิเคราะห์กระแสเงินสด',
    'ai.card.desc': 'PaoPao จะทบทวนประวัติย้อนหลัง 30 วันเพื่อส่งมอบคำแนะนำที่ตรงเป้าที่สุดสำหรับคุณ',
    'ai.loading': 'PaoPao กำลังคิดวิเคราะห์แผนการเงินให้คุณ...',
    'ai.footer.anonymous': 'ข้อมูลทั้งหมดถูกปิดบังตัวตนอย่างเคร่งครัดตามมาตรฐาน PII ก่อนส่งประมวลผล',
    'ai.btn.regenerate': 'ประมวลผลใหม่',
  }
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('th')

  useEffect(() => {
    // Load from local storage
    const saved = localStorage.getItem('wealthness_lang') as Language
    if (saved && (saved === 'en' || saved === 'th')) {
      setLanguageState(saved)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('wealthness_lang', lang)
  }

  const t = (key: string): string => {
    return translations[language][key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
