import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && user) {
      // Check if it's a LINE login
      if (user.app_metadata.provider === 'line') {
        const lineId = user.user_metadata.provider_id
        const name = user.user_metadata.full_name || 'LINE User'
        
        // Sync Prisma User
        if (lineId) {
          await prisma.user.upsert({
            where: { lineId },
            update: { name },
            create: { lineId, name }
          })
        }
      }
      
      return NextResponse.redirect(`${origin}/`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Authentication failed`)
}
