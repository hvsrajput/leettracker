import { CheckCheck, Clock, Target, Flame } from 'lucide-react';
import StatCard from '@/features/dashboard/components/StatCard';

const StatStrip = ({ totalSolved, totalAttempted, remaining, totalPercent, streak }) => {
  return (
    <section>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          label="Solved"
          value={totalSolved}
          sub={`${totalPercent}% of tracked`}
          accentText="text-emerald-400"
          accentBg="bg-emerald-500/10"
          delay={0}
          Icon={CheckCheck}
        />
        <StatCard
          label="Attempted"
          value={totalAttempted}
          sub="in progress"
          accentText="text-amber-400"
          accentBg="bg-amber-500/10"
          delay={60}
          Icon={Clock}
        />
        <StatCard
          label="Remaining"
          value={remaining}
          sub="left to solve"
          accentText="text-indigo-400"
          accentBg="bg-indigo-500/10"
          delay={120}
          Icon={Target}
        />
        <StatCard
          label="Day streak"
          value={streak.current}
          sub={`${streak.activeDays} active days`}
          accentText="text-orange-400"
          accentBg="bg-orange-500/10"
          delay={180}
          Icon={Flame}
        />
      </div>
    </section>
  );
};

export default StatStrip;
