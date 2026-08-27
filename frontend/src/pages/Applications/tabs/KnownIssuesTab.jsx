import { knownIssuesApi } from '../../../services/domains';
import SubResourceTab from '../../../components/common/SubResourceTab';
import StatusBadge from '../../../components/common/StatusBadge';
import { SEVERITY_OPTIONS, KNOWN_ISSUE_STATUS_OPTIONS } from '../../../constants/options';
import usePermission from '../../../routes/usePermission';

export default function KnownIssuesTab({ applicationId }) {
  const canCreate = usePermission('known_issues', 'create');
  const canEdit = usePermission('known_issues', 'update');
  const canDelete = usePermission('known_issues', 'delete');

  return (
    <SubResourceTab
      api={knownIssuesApi}
      applicationId={applicationId}
      title="Known Issues"
      entityLabel="Known Issue"
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'severity', label: 'Severity', render: (r) => <StatusBadge value={r.severity} /> },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
        { key: 'workaround', label: 'Workaround' },
      ]}
      fields={[
        { name: 'title', label: 'Title', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'severity', label: 'Severity', type: 'select', options: SEVERITY_OPTIONS, half: true },
        { name: 'status', label: 'Status', type: 'select', options: KNOWN_ISSUE_STATUS_OPTIONS, half: true },
        { name: 'workaround', label: 'Workaround', type: 'textarea' },
      ]}
    />
  );
}
