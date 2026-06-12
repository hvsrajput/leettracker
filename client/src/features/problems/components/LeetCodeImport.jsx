import { Loader2 } from 'lucide-react';
import { useLeetCodeImport } from '@/features/problems/hooks/useLeetCodeImport';
import StepIndicator from '@/features/problems/components/leetcode/StepIndicator';
import MethodSelect from '@/features/problems/components/leetcode/MethodSelect';
import InstantSetup from '@/features/problems/components/leetcode/InstantSetup';
import AdvancedImportSteps from '@/features/problems/components/leetcode/AdvancedImportSteps';
import SuccessPanel from '@/features/problems/components/leetcode/SuccessPanel';

const LeetCodeImport = ({ onSuccess, onCancel }) => {
  const wizard = useLeetCodeImport({ onSuccess, onCancel });
  const { step, importMethod, loading } = wizard;

  const groupPicker = {
    userGroups: wizard.userGroups,
    groupsLoading: wizard.groupsLoading,
    selectedGroupIds: wizard.selectedGroupIds,
    selectedCount: wizard.selectedCount,
    showGroupConfig: wizard.showGroupConfig,
    setShowGroupConfig: wizard.setShowGroupConfig,
    toggleGroup: wizard.toggleGroup,
    toggleAllGroups: wizard.toggleAllGroups,
  };

  return (
    <div className="text-gray-300">
      {importMethod === 'advanced' && step > 0 && step < 4 && <StepIndicator step={step} />}

      {step === 0 && !loading && (
        <MethodSelect
          error={wizard.error}
          groupPicker={groupPicker}
          onSelectInstant={wizard.selectInstant}
          onSelectAdvanced={wizard.selectAdvanced}
        />
      )}

      {step === 5 && (
        <InstantSetup
          tempUsername={wizard.tempUsername}
          setTempUsername={wizard.setTempUsername}
          error={wizard.error}
          loading={loading}
          onBack={() => wizard.setStep(0)}
          onSync={wizard.handleInstantSync}
        />
      )}

      {loading && step === 0 && (
        <div className="py-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#FFA116]" />
          <p className="text-muted-foreground animate-pulse">Fetching your recent LeetCode activity...</p>
        </div>
      )}

      {importMethod === 'advanced' && step >= 1 && step <= 3 && (
        <AdvancedImportSteps
          step={step}
          copied={wizard.copied}
          onCopyScript={wizard.handleCopyScript}
          pastedData={wizard.pastedData}
          onPasteChange={wizard.onPasteChange}
          error={wizard.error}
          loading={loading}
          onStep={wizard.setStep}
          onImport={wizard.handleImport}
        />
      )}

      {step === 4 && wizard.result && (
        <SuccessPanel
          result={wizard.result}
          onRestart={wizard.restart}
          onDone={onCancel}
        />
      )}
    </div>
  );
};

export default LeetCodeImport;
