import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:bg-[var(--accent-hover)]',
        secondary:
          'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)]',
        outline:
          'border border-[var(--border)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)]',
        ghost:
          'text-[var(--text-primary)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)]',
        destructive:
          'bg-[var(--error)] text-white hover:bg-[var(--error)]/90 active:bg-[var(--error)]/80',
        link:
          'text-[var(--accent)] underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        default: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={buttonVariants({ variant, size, className })}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
