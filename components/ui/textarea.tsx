import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base md:text-sm text-foreground transition-all outline-none placeholder:text-muted-foreground hover:border-border/80 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
