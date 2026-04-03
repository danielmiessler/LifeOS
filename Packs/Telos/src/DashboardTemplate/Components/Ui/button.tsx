import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-gray-900 text-white hover:bg-gray-900/90",
        destructive:
          "bg-[#f52a65] text-white hover:bg-[#f52a65]/90",
        outline:
          "border border-gray-300 bg-white hover:bg-gray-100 hover:text-gray-900",
        secondary:
          "bg-gray-100 text-gray-900 hover:bg-gray-100/80",
        ghost:
          "hover:bg-gray-100 hover:text-gray-900",
        link:
          "text-[#2e7de9] underline-offset-4 hover:underline",
        primary:
          "bg-[#2e7de9] text-white hover:bg-[#2e7de9]/90",
        success:
          "bg-[#33b579] text-white hover:bg-[#33b579]/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
