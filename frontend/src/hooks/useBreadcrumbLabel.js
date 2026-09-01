import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppDispatch } from '../app/hooks';
import { setEntityLabel } from '../features/ui/uiSlice';

/** Detail pages call this once their record has loaded so the breadcrumb can show its name
 * (e.g. "Internal AI code review assistant") instead of the raw id from the URL. `path` defaults
 * to the current page's own path — pass an explicit ancestor path (e.g. `/applications/${appId}`)
 * to label a PARENT segment too, for a page nested two levels deep (like a change request's own
 * detail screen) whose breadcrumb needs both its application's name and its own title, regardless
 * of whether the user ever visited the application's page directly first. */
export default function useBreadcrumbLabel(label, path) {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const targetPath = path ?? location.pathname;

  useEffect(() => {
    if (!label) return;
    dispatch(setEntityLabel({ path: targetPath, label }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, targetPath]);
}
