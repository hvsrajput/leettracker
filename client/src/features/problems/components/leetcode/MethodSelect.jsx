import { Zap, FileCode2, AlertCircle } from 'lucide-react';
import GroupPicker from '@/features/problems/components/leetcode/GroupPicker';

const MethodSelect = ({ error, groupPicker, onSelectInstant, onSelectAdvanced }) => (
  <div className="space-y-6 animate-fade-in">
    {error && (
      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {error}
      </div>
    )}

    <GroupPicker {...groupPicker} />

    <div className="grid grid-cols-1 gap-4">
      <button
        onClick={onSelectInstant}
        className="group p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#FFA116]/50 hover:bg-[#FFA116]/5 transition-all text-left"
      >
        <div className="flex items-center gap-4 mb-3">
          <div className="w-11 h-11 rounded-xl bg-[#FFA116]/10 flex items-center justify-center border border-[#FFA116]/20 flex-shrink-0">
            <Zap className="w-5 h-5 text-[#FFA116]" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white">Instant Sync</h4>
            <p className="text-[11px] text-[#FFA116] font-semibold uppercase tracking-wider">Zero Config</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Uses your public profile to import recent solved problems plus best-effort recent attempts. Fast and easy, but limited to your most recent public activity.
        </p>
      </button>

      <button
        onClick={onSelectAdvanced}
        className="group p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all text-left"
      >
        <div className="flex items-center gap-4 mb-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 flex-shrink-0">
            <FileCode2 className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white">Advanced Import</h4>
            <p className="text-[11px] text-indigo-400 font-semibold uppercase tracking-wider">Full History</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Uses a browser script to fetch your full solved history and attempted-only problems from your logged-in LeetCode session.
        </p>
      </button>
    </div>
  </div>
);

export default MethodSelect;
