import { useAppSelector } from '../app/hooks';
import { selectHasPermission } from '../features/auth/authSlice';

/** const canCreateApps = usePermission('applications', 'create'); */
export default function usePermission(resource, action) {
  return useAppSelector((state) => selectHasPermission(state, resource, action));
}
