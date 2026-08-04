import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './auth';
import { getMyGroups, type Group } from './db';

type ActiveGroupValue = {
  groups: Group[];
  activeGroup: Group | null;
  loading: boolean;
  setActiveGroup: (group: Group) => Promise<void>;
  refreshGroups: () => Promise<Group | null>;
};

const ActiveGroupContext = createContext<ActiveGroupValue | undefined>(undefined);

const storageKey = (userId: string) => `huddle:active-group:${userId}`;

export function ActiveGroupProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroupState] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshGroups = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setActiveGroupState(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      const nextGroups = await getMyGroups();
      const savedId = await AsyncStorage.getItem(storageKey(user.id));
      const selected = nextGroups.find((group) => group.id === savedId) ?? nextGroups[0] ?? null;
      setGroups(nextGroups);
      setActiveGroupState(selected);
      if (selected) await AsyncStorage.setItem(storageKey(user.id), selected.id);
      return selected;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshGroups();
  }, [refreshGroups]);

  const setActiveGroup = useCallback(async (group: Group) => {
    setActiveGroupState(group);
    if (user) await AsyncStorage.setItem(storageKey(user.id), group.id);
  }, [user]);

  const value = useMemo(
    () => ({ groups, activeGroup, loading, setActiveGroup, refreshGroups }),
    [groups, activeGroup, loading, setActiveGroup, refreshGroups]
  );

  return <ActiveGroupContext.Provider value={value}>{children}</ActiveGroupContext.Provider>;
}

export function useActiveGroup(): ActiveGroupValue {
  const context = useContext(ActiveGroupContext);
  if (!context) throw new Error('useActiveGroup must be used within an ActiveGroupProvider');
  return context;
}
