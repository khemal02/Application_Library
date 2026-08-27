import { useState } from 'react';
import { featuresApi } from '../../../services/domains';
import SubResourceTab from '../../../components/common/SubResourceTab';
import StatusBadge from '../../../components/common/StatusBadge';
import { FEATURE_STATUS_OPTIONS } from '../../../constants/options';
import usePermission from '../../../routes/usePermission';

export default function FeaturesTab({ applicationId }) {
  const [featureOptions, setFeatureOptions] = useState([]);
  const canCreate = usePermission('features', 'create');
  const canEdit = usePermission('features', 'update');
  const canDelete = usePermission('features', 'delete');

  return (
    <SubResourceTab
      api={featuresApi}
      applicationId={applicationId}
      title="Application Features"
      entityLabel="Feature"
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      columns={[
        { key: 'name', label: 'Feature' },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
        { key: 'assignedDeveloper', label: 'Assigned Developer', render: (r) => r.assignedDeveloper?.name || '—' },
        { key: 'estimatedTime', label: 'Estimated Time' },
        { key: 'completionDate', label: 'Completion Date' },
      ]}
      fields={[
        { name: 'name', label: 'Feature Name', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        { name: 'status', label: 'Status', type: 'select', options: FEATURE_STATUS_OPTIONS, half: true },
        { name: 'estimatedTime', label: 'Estimated Time', half: true },
        { name: 'completionDate', label: 'Completion Date', type: 'date', half: true },
        { name: 'dependencyIds', label: 'Depends On', type: 'multiselect', options: featureOptions },
      ]}
      onDataChange={(rows) => setFeatureOptions(rows.map((r) => ({ value: r.id, label: r.name })))}
      transformBeforeSubmit={(values) => ({ ...values, dependencyIds: values.dependencyIds || [] })}
      transformToForm={(row) => ({ ...row, dependencyIds: (row.dependencies || []).map((d) => d.dependsOnFeatureId) })}
    />
  );
}
