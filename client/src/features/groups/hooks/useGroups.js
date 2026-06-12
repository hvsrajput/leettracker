import { useState, useEffect } from 'react';
import { listGroups, createGroup } from '@/features/groups/services/groupsApi';
import { toast } from '@/shared/ui/use-toast';

// Owns the groups list and the create-group dialog state. The Groups page only
// renders what this returns.
export const useGroups = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    listGroups()
      .then(res => setGroups(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => setShowCreate(true);

  const closeCreate = () => {
    setShowCreate(false);
    setError('');
  };

  const handleCreate = async () => {
    const name = groupName.trim();
    if (!name) return;
    setError('');
    try {
      const res = await createGroup(name);
      setGroups(prev => [{ ...res.data, creator_name: 'You' }, ...prev]);
      toast({ title: 'Group created', description: name, variant: 'success' });
      setGroupName('');
      setShowCreate(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
    }
  };

  return {
    groups,
    loading,
    showCreate,
    openCreate,
    closeCreate,
    groupName,
    setGroupName,
    error,
    handleCreate,
  };
};
