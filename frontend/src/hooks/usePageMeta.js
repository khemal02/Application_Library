import { useEffect } from 'react';
import { useAppDispatch } from '../app/hooks';
import { setPageMeta } from '../features/ui/uiSlice';

/** A top-level list page (Dashboard, Ideas, Idea Prioritization, Application Tracking,
 * Applications) calls this once with its own title + one-line subtitle — the Topbar renders both
 * itself now, next to the breadcrumb pill, per the approved reference. Cleared on unmount so a
 * detail page navigated to next doesn't inherit a stale title. */
export default function usePageMeta(title, subtitle) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setPageMeta({ title, subtitle }));
    return () => dispatch(setPageMeta({ title: '', subtitle: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle]);
}
