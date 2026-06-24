import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-white',
        outline: 'text-foreground',
        t0: 'border-transparent bg-emerald-600/20 text-emerald-400',
        t1: 'border-transparent bg-blue-600/20 text-blue-400',
        t2: 'border-transparent bg-yellow-600/20 text-yellow-400',
        t3: 'border-transparent bg-orange-600/20 text-orange-400',
        t4: 'border-transparent bg-zinc-600/20 text-zinc-400'
      }
    },
    defaultVariants: { variant: 'default' }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps): React.JSX.Element {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
