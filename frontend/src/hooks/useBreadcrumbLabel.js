import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppDispatch } from '../app/hooks';
import { setEntityLabel } from '../features/ui/uiSlice';

/** Detail pages call this once their record has loaded so the breadcrumb can show its name
 * (e.g. "Internal AI code review assistant") instead of the raw id from the URL. */
export default function useBreadcrumbLabel(label) {
  const location = useLocation();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!label) return;
    dispatch(setEntityLabel({ path: location.pathname, label }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, location.pathname]);
}
