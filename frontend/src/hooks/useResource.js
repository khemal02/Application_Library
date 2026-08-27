import { useCallback, useEffect, useState } from 'react';

/**
 * Single-record counterpart to useServerList: owns loading/error state for a "fetch one thing"
 * page (application/idea/suggestion detail, dashboard summary) so every such page doesn't
 * reimplement its own unguarded `.then(setState)` with no loading spinner and no failure path.
 */
export default function useResource(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load, setData };
}
