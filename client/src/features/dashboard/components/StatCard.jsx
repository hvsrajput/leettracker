import { Card } from '@/shared/ui/card';
import { cn } from '@/shared/lib/utils';

const StatCard = (props) => {
  const { label, value, sub, accentText, accentBg, delay = 0 } = props;
  return (
    <Card
      className="p-5 sm:p-6 animate-rise transition-colors hover:bg-white/[0.04]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cn('p-2 rounded-lg', accentBg, accentText)}>
          <props.Icon className="h-4.5 w-4.5" size={18} />
        </span>
      </div>
      <div className="mt-4 text-3xl font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-sm text-muted-foreground">{sub}</div>}
    </Card>
  );
};

export default StatCard;
