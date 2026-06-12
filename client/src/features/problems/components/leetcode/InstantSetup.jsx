import { AlertCircle, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

const InstantSetup = ({ tempUsername, setTempUsername, error, loading, onBack, onSync }) => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <h3 className="text-xl font-bold text-white mb-2">Set Your LeetCode Username</h3>
      <p className="text-muted-foreground text-sm">We need your public username to fetch your recent solved and attempted activity.</p>
    </div>

    <div className="space-y-3">
      <Input
        type="text"
        placeholder="Your LeetCode Username"
        className="h-11 focus-visible:ring-[#FFA116]/40 focus-visible:border-[#FFA116]/60"
        value={tempUsername}
        onChange={e => setTempUsername(e.target.value)}
      />
      {error && (
        <p className="flex items-center gap-2 text-rose-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </p>
      )}
    </div>

    <div className="flex gap-3">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" />
        Back
      </Button>
      <Button
        className="flex-1 bg-[#FFA116] text-black hover:bg-[#ffb038] font-semibold"
        onClick={() => onSync()}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Syncing...
          </>
        ) : (
          <>
            Start Syncing
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </div>
  </div>
);

export default InstantSetup;
