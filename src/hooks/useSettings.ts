import { useState, useEffect, useCallback } from 'react';
import { supabase, type Settings } from '@/lib/supabase';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('settings').select('*').maybeSingle();
      if (!error && data) setSettings(data as Settings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { settings, reload: load, loading };
}
