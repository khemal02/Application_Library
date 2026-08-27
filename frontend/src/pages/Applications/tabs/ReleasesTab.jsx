import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { releasesApi } from '../../../services/domains';
import SubResourceTab from '../../../components/common/SubResourceTab';
import usePermission from '../../../routes/usePermission';

function linesToArray(text) {
  return (text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}
function arrayToLines(arr) {
  return (arr || []).join('\n');
}

export default function ReleasesTab({ applicationId }) {
  const canCreate = usePermission('releases', 'create');
  const canEdit = usePermission('releases', 'update');
  const canDelete = usePermission('releases', 'delete');

  return (
    <SubResourceTab
      api={releasesApi}
      applicationId={applicationId}
      title="Release Notes"
      entityLabel="Release"
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      columns={[
        { key: 'version', label: 'Version', render: (r) => <Chip size="small" label={`v${r.version}`} /> },
        { key: 'releaseDate', label: 'Release Date' },
        {
          key: 'newFeatures', label: 'New Features', render: (r) => (
            <Box>{(r.newFeatures || []).slice(0, 3).map((f, i) => <div key={i}>• {f}</div>)}</Box>
          ),
        },
      ]}
      fields={[
        { name: 'version', label: 'Version', required: true, half: true },
        { name: 'releaseDate', label: 'Release Date', type: 'date', half: true },
        { name: 'newFeatures', label: 'New Features (one per line)', type: 'textarea' },
        { name: 'bugFixes', label: 'Bug Fixes (one per line)', type: 'textarea' },
        { name: 'breakingChanges', label: 'Breaking Changes (one per line)', type: 'textarea' },
      ]}
      transformBeforeSubmit={(values) => ({
        ...values,
        newFeatures: linesToArray(values.newFeatures),
        bugFixes: linesToArray(values.bugFixes),
        breakingChanges: linesToArray(values.breakingChanges),
      })}
      transformToForm={(row) => ({
        ...row,
        newFeatures: arrayToLines(row.newFeatures),
        bugFixes: arrayToLines(row.bugFixes),
        breakingChanges: arrayToLines(row.breakingChanges),
      })}
    />
  );
}
