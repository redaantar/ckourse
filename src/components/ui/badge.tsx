import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "relative inline-flex w-fit shrink-0 items-center justify-center gap-1 px-[0.1875rem] font-medium text-[0.625rem]/[0.875rem] whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        secondary: "bg-secondary text-muted-foreground",
        destructive: "bg-destructive/10 text-destructive",
        info: "bg-info/10 text-info",
        outline: "bg-transparent text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const borderColorMap: Record<string, string> = {
  default: "text-primary/30 dark:text-primary/40",
  secondary: "text-border",
  destructive: "text-destructive/30 dark:text-destructive/40",
  info: "text-info/30 dark:text-info/40",
  outline: "text-border",
}

function DashedBorder({ variant = "default" }: { variant?: string }) {
  const colorClass = borderColorMap[variant] ?? borderColorMap.default

  return (
    <>
      <span className={cn("-top-px absolute -inset-x-0.75 block transform-gpu", colorClass)}>
        <svg aria-hidden="true" height="1" stroke="currentColor" strokeDasharray="3.3 1" width="100%">
          <line x1="0" x2="100%" y1="0.5" y2="0.5" />
        </svg>
      </span>
      <span className={cn("-bottom-px absolute -inset-x-0.75 block transform-gpu", colorClass)}>
        <svg aria-hidden="true" height="1" stroke="currentColor" strokeDasharray="3.3 1" width="100%">
          <line x1="0" x2="100%" y1="0.5" y2="0.5" />
        </svg>
      </span>
      <span className={cn("-left-px absolute -inset-y-0.75 block transform-gpu", colorClass)}>
        <svg aria-hidden="true" height="100%" stroke="currentColor" strokeDasharray="3.3 1" width="1">
          <line x1="0.5" x2="0.5" y1="0" y2="100%" />
        </svg>
      </span>
      <span className={cn("-right-px absolute -inset-y-0.75 block transform-gpu", colorClass)}>
        <svg aria-hidden="true" height="100%" stroke="currentColor" strokeDasharray="3.3 1" width="1">
          <line x1="0.5" x2="0.5" y1="0" y2="100%" />
        </svg>
      </span>
    </>
  )
}

function Badge({
  className,
  variant = "default",
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {children}
      <DashedBorder variant={variant ?? "default"} />
    </Comp>
  )
}

export { Badge, badgeVariants }
