import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none disabled:pointer-events-none disabled:opacity-40 transition-[background-color,color,opacity,transform,box-shadow] duration-150 ease-out active:not-disabled:scale-[0.96] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-fg text-accent-fg hover:bg-accent shadow-[0_0_0_1px_rgb(255_255_255/0.06)]",
        ghost:
          "bg-transparent text-fg hover:bg-white/6",
        outline:
          "bg-transparent text-fg shadow-[0_0_0_1px_rgb(255_255_255/0.12)] hover:bg-white/5",
        subtle:
          "bg-surface-2 text-fg hover:bg-white/10",
        danger: "bg-danger/15 text-danger hover:bg-danger/25",
      },
      size: {
        sm: "h-9 rounded-sm px-3 text-sm [&_svg]:size-4",
        md: "h-11 rounded-md px-4 text-sm [&_svg]:size-4",
        lg: "h-12 rounded-lg px-5 text-base [&_svg]:size-5",
        icon: "size-11 rounded-md [&_svg]:size-5",
        "icon-sm": "size-9 rounded-sm [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
