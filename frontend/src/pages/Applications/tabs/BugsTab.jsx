import { bugsApi } from '../../../services/domains';
import SubResourceTab from '../../../components/common/SubResourceTab';
import StatusBadge from '../../../components/common/StatusBadge';
import { SEVERITY_OPTIONS, BUG_STATUS_OPTIONS } from '../../../constants/options';
import usePermission from '../../../routes/usePermission';

export default function BugsTab({ applicationId }) {
  const canCreate = usePermission('bugs', 'create');
  const canEdit = usePermission('bugs', 'update');
  const canDelete = usePermission('bugs', 'delete');

  return (
    <SubResourceTab
      api={bugsApi}
      applicationId={applicationId}
      title="Bug History"
      entityLabel="Bug"
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'severity', label: 'Severity', render: (r) => <StatusBadge value={r.severity} /> },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
        { key: 'reporter', label: 'Reported By', render: (r) => r.reporter?.name || '—' },
      ]}
      fields={[
        { name: 'title', label: 'Title', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'severity', label: 'Severity', type: 'select', options: SEVERITY_OPTIONS, half: true },
        { name: 'status', label: 'Status', type: 'select', options: BUG_STATUS_OPTIONS, half: true },
        { name: 'reportedDate', label: 'Reported Date', type: 'date', half: true },
        { name: 'resolvedDate', label: 'Resolved Date', type: 'date', half: true },
      ]}
    />
  );
}
