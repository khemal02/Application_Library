import Chip from '@mui/material/Chip';
import { apiDocsApi } from '../../../services/domains';
import SubResourceTab from '../../../components/common/SubResourceTab';
import { API_METHOD_OPTIONS } from '../../../constants/options';
import usePermission from '../../../routes/usePermission';

const METHOD_COLOR = { GET: 'info', POST: 'success', PUT: 'warning', PATCH: 'warning', DELETE: 'error' };

export default function ApiDocsTab({ applicationId }) {
  const canCreate = usePermission('api_docs', 'create');
  const canEdit = usePermission('api_docs', 'update');
  const canDelete = usePermission('api_docs', 'delete');

  return (
    <SubResourceTab
      api={apiDocsApi}
      applicationId={applicationId}
      title="API Documentation"
      entityLabel="API Endpoint"
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      columns={[
        { key: 'method', label: 'Method', render: (r) => <Chip size="small" color={METHOD_COLOR[r.method]} label={r.method} /> },
        { key: 'endpoint', label: 'Endpoint' },
        { key: 'description', label: 'Description' },
      ]}
      fields={[
        { name: 'method', label: 'Method', type: 'select', options: API_METHOD_OPTIONS, required: true, half: true },
        { name: 'endpoint', label: 'Endpoint', required: true, half: true },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  );
}
