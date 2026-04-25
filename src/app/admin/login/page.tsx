"use client"
import React, { useState } from "react"
import { loginAdmin } from "@/features/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { Lock } from "lucide-react"

export default function AdminLoginPage() {
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await loginAdmin(password)
    if (res.success) {
      window.location.href = "/admin"
    } else {
      toast.error(res.error)
      setPassword("")
    }
    setLoading(false)
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm shadow-xl border-t-4 border-t-slate-900 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-slate-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-slate-700" />
          </div>
          <CardTitle className="text-2xl font-black">PaoPao Admin</CardTitle>
          <CardDescription>Enter admin password to access Gamification & Rewards dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-center tracking-widest text-lg"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={!password || loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-11">
              {loading ? "Authenticating..." : "Login Securely"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
