import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { architectureDocsApi } from '../../../services/domains';
import useToast from '../../../hooks/useToast';
import usePermission from '../../../routes/usePermission';

const DOC_TYPES = [
  { key: 'high_level', label: 'High Level Architecture' },
  { key: 'folder_structure', label: 'Folder Structure' },
  { key: 'api_flow', label: 'API Flow' },
  { key: 'db_design', label: 'Database Design' },
  { key: 'auth_flow', label: 'Authentication Flow' },
  { key: 'microservice_diagram', label: 'Microservice Diagram' },
  { key: 'deployment_diagram', label: 'Deployment Diagram' },
];

function DocEditor({ applicationId, docType, label, existing, onSaved, canEdit }) {
  const [content, setContent] = useState(existing?.contentMarkdown || '');
  const [diagramUrl, setDiagramUrl] = useState(existing?.diagramUrl || '');
  const [saving, setSaving] = useState(false);
  const { showSuccess, showError } = useToast();

  const save = async () => {
    setSaving(true);
    try {
      await architectureDocsApi.upsert(applicationId, { docType, title: label, contentMarkdown: content, diagramUrl });
      showSuccess(`${label} saved`);
      onSaved();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to save — please try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <TextField
        label="Diagram URL (optional image/diagram link)"
        value={diagramUrl}
        onChange={(e) => setDiagramUrl(e.target.value)}
        size="small"
        disabled={!canEdit}
      />
      <TextField
        label="Documentation (Markdown)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        multiline minRows={6}
        disabled={!canEdit}
      />
      {canEdit && (
        <Box>
          <Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </Box>
      )}
    </Stack>
  );
}

export default function ArchitectureDocsTab({ applicationId }) {
  const [docs, setDocs] = useState([]);
  const canEdit = usePermission('architecture_docs', 'update');

  const load = async () => {
    const res = await architectureDocsApi.list(applicationId, { limit: 20 });
    setDocs(res.data);
  };

  useEffect(() => { load(); }, [applicationId]);

  const byType = Object.fromEntries(docs.map((d) => [d.docType, d]));

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Architecture Documentation</Typography>
      {DOC_TYPES.map(({ key, label }) => (
        <Accordion key={key} variant="outlined">
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>{label}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <DocEditor applicationId={applicationId} docType={key} label={label} existing={byType[key]} onSaved={load} canEdit={canEdit} />
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
