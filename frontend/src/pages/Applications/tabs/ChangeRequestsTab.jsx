import dayjs from 'dayjs';
import { changeRequestsApi } from '../../../services/domains';
import SubResourceTab from '../../../components/common/SubResourceTab';
import usePermission from '../../../routes/usePermission';
import { useAppSelector } from '../../../app/hooks';

function requesterMeta(record) {
  const name = record.requester?.name || 'Unknown user';
  const when = record.createdAt ? dayjs(record.createdAt).format('MMM D, YYYY, h:mm A') : '';
  return [name, when].filter(Boolean).join(' · ');
}

export default function ChangeRequestsTab({ applicationId }) {
  const canCreate = usePermission('change_requests', 'create');
  const canEdit = usePermission('change_requests', 'update');
  const hasDeleteRole = usePermission('change_requests', 'delete');
  const isSuperAdmin = usePermission('*', 'manage');
  const user = useAppSelector((s) => s.auth.user);
  // Same rule the backend enforces (requireRecordOwnership on the delete route): only the person
  // who raised a given change request, or a true super-admin, may delete it — not just anyone
  // whose role happens to have change_requests:delete.
  const canDeleteRecord = (record) => hasDeleteRole && (isSuperAdmin || record.requestedBy === user?.id);

  return (
    <SubResourceTab
      api={changeRequestsApi}
      applicationId={applicationId}
      title="Change Requests"
      entityLabel="Change Request"
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDeleteRecord}
      renderMeta={requesterMeta}
      metaPosition="bottom"
      hideFieldList
      fields={[
        { name: 'title', label: 'Change Request', type: 'textarea', required: true },
      ]}
    />
  );
}
