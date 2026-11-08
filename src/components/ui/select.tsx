"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

export type SelectOption = { value: string; label: React.ReactNode; disabled?: boolean }

/**
 * Themed dropdown in place of the native <select>, whose option list is drawn by the OS and
 * can't follow the app's theme. Keyboard and screen-reader behaviour come from Base UI.
 * `name` renders a hidden input, so it works inside <form> / FormData too.
 */
export function Select({
  value,
  onValueChange,
  options,
  name,
  placeholder,
  disabled,
  required,
  className,
  "aria-label": ariaLabel,
  id,
}: {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  name?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  "aria-label"?: string
  id?: string
}) {
  const items = React.useMemo(() => options.map(o => ({ value: o.value, label: o.label })), [options])
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={v => onValueChange(String(v ?? ""))}
      items={items}
      name={name}
      disabled={disabled}
      required={required}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        data-slot="select-trigger"
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm text-foreground transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:border-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <SelectPrimitive.Value className="truncate data-[placeholder]:text-muted-foreground">
          {(v: string | null) => (v == null || v === "" ? placeholder ?? "" : options.find(o => o.value === v)?.label ?? v)}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon className="shrink-0 text-muted-foreground">
          <ChevronDown className="size-4" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-50 outline-none">
          <SelectPrimitive.Popup
            data-slot="select-popup"
            className={cn(
              "max-h-[min(20rem,var(--available-height))] min-w-[var(--anchor-width)] overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
              "origin-[var(--transform-origin)] transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
            )}
          >
            <SelectPrimitive.List>
              {options.map(o => (
                <SelectPrimitive.Item
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  className="flex cursor-default items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[highlighted]:bg-primary/10 data-[highlighted]:text-foreground data-[selected]:font-medium data-[disabled]:opacity-50"
                >
                  <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check className="size-4 text-primary" aria-hidden />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
