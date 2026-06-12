import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

const StepIndicator = ({ step }) => (
  <div className="flex items-center gap-2 mb-6 justify-center">
    {[1, 2, 3].map((s, i) => (
      <div key={s} className="flex items-center gap-2">
        {i > 0 && <div className={cn('w-8 h-px', step > i ? 'bg-[#FFA116]' : 'bg-white/10')} />}
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors border',
            step > s
              ? 'bg-[#FFA116]/15 text-[#FFA116] border-[#FFA116]/40'
              : step === s
                ? 'bg-[#FFA116] text-black border-[#FFA116]'
                : 'bg-white/5 text-muted-foreground border-white/10'
          )}
        >
          {step > s ? <Check className="w-4 h-4" strokeWidth={3} /> : s}
        </div>
      </div>
    ))}
  </div>
);

export default StepIndicator;
