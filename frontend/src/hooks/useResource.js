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

  // Only a genuine new resource (deps change — e.g. navigating to a different id) shows the
  // blocking spinner; that's the one case this effect itself fires. A caller's own `reload()` is
  // the SAME `load` reference called imperatively, so it deliberately leaves `loading` alone —
  // pages gate their whole tree on `if (loading) return <LoadingBlock />`, and flipping it on
  // every reload (e.g. after a Save elsewhere on the page) would unmount that entire tree, wiping
  // out any unrelated in-progress local state (an open edit form, a picked-but-not-yet-confirmed
  // dropdown value) that had nothing to do with what was actually being saved.
  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return { data, loading, error, reload: load, setData };
}
