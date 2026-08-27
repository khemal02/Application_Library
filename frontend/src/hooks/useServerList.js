import { useCallback, useEffect, useState } from 'react';

/**
 * Owns pagination/sort/search/filter state for a list page and re-fetches whenever it changes.
 * `fetcher` is any `(params) => Promise<{data, meta}>` — typically one of the resource API
 * modules' `.list()` — so this hook works identically across applications/ideas/suggestions/etc.
 */
export default function useServerList(fetcher, { initialFilters = {}, initialSort = { field: 'createdAt', direction: 'desc' }, limit: initialLimit = 20 } = {}) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [sort, setSort] = useState(initialSort);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page, limit, search: search || undefined,
        sort: `${sort.direction === 'desc' ? '-' : ''}${sort.field}`,
        ...filters,
      };
      const res = await fetcher(params);
      setRows(res.data);
      setPagination(res.meta?.pagination || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sort, search, JSON.stringify(filters), reloadToken]);

  useEffect(() => { load(); }, [load]);

  const updateFilters = (next) => {
    setFilters(next);
    setPage(1);
  };

  const updateSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const reload = () => setReloadToken((t) => t + 1);

  return {
    rows, pagination, loading, error, sort, search, filters, page, limit,
    setPage, setLimit, setSort, setSearch: updateSearch, setFilters: updateFilters, reload,
  };
}
