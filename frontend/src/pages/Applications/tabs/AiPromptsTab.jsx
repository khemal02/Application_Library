import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { aiPromptsApi } from '../../../services/domains';
import SubResourceTab from '../../../components/common/SubResourceTab';
import usePermission from '../../../routes/usePermission';

export default function AiPromptsTab({ applicationId }) {
  const canCreate = usePermission('ai_prompts', 'create');
  const canEdit = usePermission('ai_prompts', 'update');
  const canDelete = usePermission('ai_prompts', 'delete');

  return (
    <SubResourceTab
      api={aiPromptsApi}
      applicationId={applicationId}
      title="AI Prompt Library"
      entityLabel="AI Prompt"
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'promptType', label: 'Category' },
        { key: 'aiModel', label: 'AI Model' },
        { key: 'version', label: 'Version' },
        {
          key: 'promptText', label: 'Prompt', render: (r) => (
            <Box sx={{ maxWidth: 320 }}>
              <Typography variant="body2" noWrap title={r.promptText}>{r.promptText}</Typography>
            </Box>
          ),
        },
      ]}
      fields={[
        { name: 'title', label: 'Prompt Title', required: true },
        { name: 'promptText', label: 'Actual Prompt', type: 'textarea', required: true },
        { name: 'promptType', label: 'Prompt Category', half: true },
        { name: 'aiModel', label: 'AI Model Used', half: true },
        { name: 'version', label: 'Version', half: true },
        { name: 'outputSummary', label: 'Output Summary', type: 'textarea' },
      ]}
    />
  );
}
