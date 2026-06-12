import { Plus } from 'lucide-react';
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

const CreateGroupDialog = ({ open, onClose, groupName, setGroupName, error, onCreate }) => (
  <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Create New Group</DialogTitle>
        <DialogDescription>Invite friends and track problems together.</DialogDescription>
      </DialogHeader>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{error}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="group-name">Group Name</Label>
        <Input
          id="group-name"
          type="text"
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
          placeholder="e.g. Blind 75 Squad"
          onKeyDown={e => e.key === 'Enter' && onCreate()}
          autoFocus
        />
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={onCreate} disabled={!groupName.trim()}>
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default CreateGroupDialog;
