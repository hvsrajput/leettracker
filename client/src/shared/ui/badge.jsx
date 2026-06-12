import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-white/10 bg-white/5 text-gray-300',
        destructive: 'border-rose-500/20 bg-rose-500/10 text-rose-400',
        outline: 'border-white/15 text-foreground',
        easy: 'border-sky-500/20 bg-sky-500/10 text-sky-400 uppercase tracking-wide font-bold text-[10px]',
        medium: 'border-amber-500/20 bg-amber-500/10 text-amber-400 uppercase tracking-wide font-bold text-[10px]',
        hard: 'border-rose-500/20 bg-rose-500/10 text-rose-400 uppercase tracking-wide font-bold text-[10px]',
        success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
        warning: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
        topic: 'border-violet-500/20 bg-violet-500/10 text-violet-400 font-medium rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const DIFFICULTY_VARIANT = { Easy: 'easy', Medium: 'medium', Hard: 'hard' };

function DifficultyBadge({ difficulty, className }) {
  return (
    <Badge variant={DIFFICULTY_VARIANT[difficulty] || 'medium'} className={className}>
      {difficulty}
    </Badge>
  );
}

export { Badge, badgeVariants, DifficultyBadge };
