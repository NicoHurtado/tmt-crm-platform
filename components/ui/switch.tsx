"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  checked,
  onCheckedChange,
  onClick,
  disabled,
  ...props
}: {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  className?: string
  size?: "sm" | "default"
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "checked">) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-state={checked ? "checked" : "unchecked"}
      onClick={(e) => {
        onClick?.(e)
        if (!e.isPropagationStopped()) {
          onCheckedChange?.(!checked)
        }
      }}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 outline-none",
        "focus-visible:ring-2 focus-visible:ring-[#D6A75D]/40",
        size === "default" ? "h-6 w-11" : "h-5 w-9",
        checked ? "bg-[#D6A75D]" : "bg-gray-300",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-md ring-0 transition-transform duration-200",
          size === "default" ? "h-[18px] w-[18px]" : "h-[14px] w-[14px]",
          checked
            ? size === "default"
              ? "translate-x-[18px]"
              : "translate-x-[14px]"
            : "translate-x-0.5"
        )}
      />
    </button>
  )
}

export { Switch }
