import { Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/dialog';

const DeleteGroupDialog = ({
  open,
  onClose,
  group,
  confirmName,
  setConfirmName,
  error,
  isDeleting,
  onDelete,
}) => (
  <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent className="max-w-md border-rose-500/20">
      <DialogHeader>
        <DialogTitle>Delete Group</DialogTitle>
        <DialogDescription>
          This will permanently delete <span className="font-semibold text-foreground">{group.name}</span> for every member, including all group membership and problem entries.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{error}</div>
      )}

      <div className="space-y-2">
        <Label>
          Type <span className="font-mono text-foreground">{group.name}</span> to confirm.
        </Label>
        <Input
          type="text"
          value={confirmName}
          onChange={e => setConfirmName(e.target.value)}
          className="focus-visible:ring-rose-500/50 focus-visible:border-rose-500/60"
          autoFocus
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          className="bg-rose-600 hover:bg-rose-500 text-white border-0"
          onClick={onDelete}
          disabled={confirmName !== group.name || isDeleting}
        >
          {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isDeleting ? 'Deleting...' : 'Delete Group'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default DeleteGroupDialog;
