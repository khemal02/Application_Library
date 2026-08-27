import { dbDocsApi } from '../../../services/domains';
import SubResourceTab from '../../../components/common/SubResourceTab';
import usePermission from '../../../routes/usePermission';

export default function DbDocsTab({ applicationId }) {
  const canCreate = usePermission('db_docs', 'create');
  const canEdit = usePermission('db_docs', 'update');
  const canDelete = usePermission('db_docs', 'delete');

  return (
    <SubResourceTab
      api={dbDocsApi}
      applicationId={applicationId}
      title="Database Documentation"
      entityLabel="Table Doc"
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      columns={[
        { key: 'docTableName', label: 'Table' },
        { key: 'description', label: 'Description' },
      ]}
      fields={[
        { name: 'docTableName', label: 'Table Name', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  );
}
