import { ArrowLeft, ArrowRight, Check, Copy, Loader2, AlertCircle } from 'lucide-react';
import { CONSOLE_SCRIPT } from '@/features/problems/constants/consoleScript';
import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';

const AdvancedImportSteps = ({
  step,
  copied,
  onCopyScript,
  pastedData,
  onPasteChange,
  error,
  loading,
  onStep,
  onImport,
}) => {
  if (step === 1) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h3 className="text-xl font-bold text-white mb-2">Step 1: Open LeetCode</h3>
          <p className="text-muted-foreground">Open a new tab and go to LeetCode. Make sure you are logged in.</p>
        </div>

        <div className="flex gap-3">
          <a
            href="https://leetcode.com"
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#FFA116] px-6 py-2.5 text-sm font-semibold text-black hover:bg-[#ffb038] transition-colors"
            onClick={() => onStep(2)}
          >
            Open LeetCode
            <ArrowRight className="w-4 h-4" />
          </a>
          <Button variant="outline" className="flex-1" onClick={() => onStep(2)}>
            I'm already logged in
          </Button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h3 className="text-xl font-bold text-white mb-3">Step 2: Run the Script in Console</h3>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
            <li>On the LeetCode tab, press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-gray-200 text-xs">F12</kbd> (Windows) or <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-gray-200 text-xs">Cmd + Option + J</kbd> (Mac) to open DevTools.</li>
            <li>Click the <strong className="text-white">Console</strong> tab.</li>
            <li>Copy the script below and paste it into the console, then press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-gray-200 text-xs">Enter</kbd>.</li>
            <li>Wait for the floating panel or the final import JSON in the console.</li>
          </ol>
        </div>

        <div className="relative group">
          <pre className="bg-black/50 border border-white/10 p-4 rounded-xl text-xs font-mono text-gray-300 overflow-x-auto max-h-48 overflow-y-auto scrollbar-thin">
            {CONSOLE_SCRIPT}
          </pre>
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-3 right-3 backdrop-blur-md"
            onClick={onCopyScript}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>

        <div className="flex items-start gap-2.5 text-xs text-amber-300/90 bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/20">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Never paste scripts from unknown sources into your browser console.
            This script only reads your submission list from LeetCode and copies it locally —
            it does not send your cookies or credentials anywhere.
          </span>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => onStep(1)}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button
            className="flex-1 bg-[#FFA116] text-black hover:bg-[#ffb038] font-semibold"
            onClick={() => onStep(3)}
          >
            Script ran successfully
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // step === 3
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-xl font-bold text-white mb-2">Step 3: Paste the Result Here</h3>
        <p className="text-sm text-muted-foreground">
          The script copied your data to clipboard automatically.
          Just paste it below (<kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">Ctrl+V</kbd> / <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">Cmd+V</kbd>).
        </p>
      </div>

      <Textarea
        className="font-mono text-sm focus-visible:ring-[#FFA116]/40 focus-visible:border-[#FFA116]/60"
        rows={5}
        placeholder='Paste your data here... it should start with {"solvedMap":{...},"attemptedMap":{...}}'
        value={pastedData}
        onChange={e => onPasteChange(e.target.value)}
      />

      {error && (
        <p className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => onStep(2)}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          className="flex-1 bg-[#FFA116] text-black hover:bg-[#ffb038] font-semibold"
          onClick={onImport}
          disabled={!pastedData.trim() || loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            'Import My Problems'
          )}
        </Button>
      </div>
    </div>
  );
};

export default AdvancedImportSteps;
