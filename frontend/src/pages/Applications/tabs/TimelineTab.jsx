import { timelineApi } from '../../../services/domains';
import SubResourceTab from '../../../components/common/SubResourceTab';
import StatusBadge from '../../../components/common/StatusBadge';
import { TIMELINE_STATUS_OPTIONS } from '../../../constants/options';
import usePermission from '../../../routes/usePermission';

export default function TimelineTab({ applicationId }) {
  const canCreate = usePermission('timeline', 'create');
  const canEdit = usePermission('timeline', 'update');
  const canDelete = usePermission('timeline', 'delete');

  return (
    <SubResourceTab
      api={timelineApi}
      applicationId={applicationId}
      title="Development Timeline"
      entityLabel="Milestone"
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      columns={[
        { key: 'title', label: 'Milestone' },
        { key: 'dueDate', label: 'Due Date' },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
      ]}
      fields={[
        { name: 'title', label: 'Milestone Title', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'dueDate', label: 'Due Date', type: 'date', half: true },
        { name: 'status', label: 'Status', type: 'select', options: TIMELINE_STATUS_OPTIONS, half: true },
      ]}
    />
  );
}
