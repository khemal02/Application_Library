import { roadmapApi } from '../../../services/domains';
import SubResourceTab from '../../../components/common/SubResourceTab';
import StatusBadge from '../../../components/common/StatusBadge';
import { ROADMAP_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../../constants/options';
import usePermission from '../../../routes/usePermission';

export default function RoadmapTab({ applicationId }) {
  const canCreate = usePermission('roadmap', 'create');
  const canEdit = usePermission('roadmap', 'update');
  const canDelete = usePermission('roadmap', 'delete');

  return (
    <SubResourceTab
      api={roadmapApi}
      applicationId={applicationId}
      title="Future Roadmap"
      entityLabel="Roadmap Item"
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'targetQuarter', label: 'Target' },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
        { key: 'priority', label: 'Priority', render: (r) => <StatusBadge value={r.priority} /> },
      ]}
      fields={[
        { name: 'title', label: 'Title', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'targetQuarter', label: 'Target Quarter (e.g. 2026-Q4)', half: true },
        { name: 'status', label: 'Status', type: 'select', options: ROADMAP_STATUS_OPTIONS, half: true },
        { name: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS, half: true },
      ]}
    />
  );
}
