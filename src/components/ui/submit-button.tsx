"use client"

import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Submit button for a <form action={serverAction}>: shows a spinner and blocks resubmitting while
 * the action runs. (Disabling a button in its own onClick would cancel the submission.)
 */
export function SubmitButton(props: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus()
  return <Button type="submit" {...props} loading={pending || props.loading} />
}

/** Unstyled variant for custom-styled submit buttons (marketing pages, sidebar): same pending behaviour. */
export function PlainSubmitButton({ children, className, ...props }: React.ComponentProps<"button">) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" {...props} disabled={pending || props.disabled} aria-busy={pending || undefined} className={className}>
      {pending && <Loader2 className="mr-2 inline size-4 animate-spin align-[-3px]" aria-hidden />}
      {children}
    </button>
  )
}
