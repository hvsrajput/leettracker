import { UserPlus } from 'lucide-react';
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

const AddMemberDialog = ({ open, onClose, username, setUsername, error, onAdd }) => (
  <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Add Member</DialogTitle>
        <DialogDescription>Invite a LeetTracker user to this group.</DialogDescription>
      </DialogHeader>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{error}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="member-username">Username</Label>
        <Input
          id="member-username"
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Enter LeetTracker username..."
          onKeyDown={e => e.key === 'Enter' && onAdd()}
          autoFocus
        />
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={onAdd} disabled={!username.trim()}>
          <UserPlus className="w-4 h-4" />
          Add
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default AddMemberDialog;
