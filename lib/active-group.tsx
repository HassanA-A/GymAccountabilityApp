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

// Cheap structural equality so a background refresh that returns the same data
// keeps the existing object references (no re-render / re-fetch churn).
function sameGroup(a: Group, b: Group): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.invite_code === b.invite_code &&
    a.target_days_per_week === b.target_days_per_week &&
    a.week_start_dow === b.week_start_dow &&
    a.created_by === b.created_by
  );
}

function sameGroups(a: Group[], b: Group[]): boolean {
  return a.length === b.length && a.every((g, i) => sameGroup(g, b[i]));
}

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

    // Note: no setLoading(true) here. This runs on every screen focus, so
    // toggling the global loading flag would flash a spinner each time. We
    // load quietly and only clear the initial spinner in `finally`.
    try {
      const nextGroups = await getMyGroups();
      const savedId = await AsyncStorage.getItem(storageKey(user.id));
      const selected = nextGroups.find((group) => group.id === savedId) ?? nextGroups[0] ?? null;
      // Preserve object identity when nothing changed so screens keyed on the
      // group don't needlessly re-fetch on every focus.
      setGroups((prev) => (sameGroups(prev, nextGroups) ? prev : nextGroups));
      setActiveGroupState((prev) =>
        prev && selected && prev.id === selected.id && sameGroup(prev, selected) ? prev : selected
      );
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
