import { techStackApi } from '../../../services/domains';
import SubResourceTab from '../../../components/common/SubResourceTab';
import StatusBadge from '../../../components/common/StatusBadge';
import { TECH_STACK_CATEGORY_OPTIONS } from '../../../constants/options';
import usePermission from '../../../routes/usePermission';

export default function TechStackTab({ applicationId }) {
  const canCreate = usePermission('tech_stack', 'create');
  const canEdit = usePermission('tech_stack', 'update');
  const canDelete = usePermission('tech_stack', 'delete');

  return (
    <SubResourceTab
      api={techStackApi}
      applicationId={applicationId}
      title="Technology Stack"
      entityLabel="Tech Stack Entry"
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      columns={[
        { key: 'category', label: 'Category', render: (r) => <StatusBadge value={r.category} /> },
        { key: 'name', label: 'Name' },
        { key: 'version', label: 'Version' },
        { key: 'notes', label: 'Notes' },
      ]}
      fields={[
        { name: 'category', label: 'Category', type: 'select', options: TECH_STACK_CATEGORY_OPTIONS, required: true, half: true },
        { name: 'name', label: 'Name', required: true, half: true },
        { name: 'version', label: 'Version', half: true },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
    />
  );
}
