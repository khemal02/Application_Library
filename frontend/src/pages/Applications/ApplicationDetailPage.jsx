import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/EditOutlined';
import { applicationsApi } from '../../services/domains';
import useResource from '../../hooks/useResource';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import useToast from '../../hooks/useToast';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import StatusBadge from '../../components/common/StatusBadge';
import usePermission from '../../routes/usePermission';
import ApplicationFormDialog from './ApplicationFormDialog';
import OverviewTab from './tabs/OverviewTab';
import TechStackTab from './tabs/TechStackTab';
import FeaturesTab from './tabs/FeaturesTab';
import AiPromptsTab from './tabs/AiPromptsTab';
import ArchitectureDocsTab from './tabs/ArchitectureDocsTab';
import ApiDocsTab from './tabs/ApiDocsTab';
import DbDocsTab from './tabs/DbDocsTab';
import ReleasesTab from './tabs/ReleasesTab';
import BugsTab from './tabs/BugsTab';
import KnownIssuesTab from './tabs/KnownIssuesTab';
import RoadmapTab from './tabs/RoadmapTab';
import TimelineTab from './tabs/TimelineTab';
import SuggestionsTab from './tabs/SuggestionsTab';
import AttachmentsPanel from '../../components/common/AttachmentsPanel';
import CommentThread from '../../components/common/CommentThread';
import BackButton from '../../components/common/BackButton';

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const [editOpen, setEditOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState(false);
  const sectionRefs = useRef({});
  const canUpdate = usePermission('applications', 'update');
  const { showSuccess } = useToast();

  const { data: application, loading, error, reload } = useResource(() => applicationsApi.getById(id), [id]);
  useBreadcrumbLabel(application?.name);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!application) return null;

  const SECTIONS = [
    { label: 'Overview', content: <OverviewTab application={application} /> },
    { label: 'SAP Technology Stack', content: <TechStackTab applicationId={id} /> },
    { label: 'Features', content: <FeaturesTab applicationId={id} /> },
    { label: 'AI Prompts (Business AI)', content: <AiPromptsTab applicationId={id} /> },
    { label: 'SAP Architecture', content: <ArchitectureDocsTab applicationId={id} /> },
    { label: 'OData Services', content: <ApiDocsTab applicationId={id} /> },
    { label: 'Data Dictionary', content: <DbDocsTab applicationId={id} /> },
    { label: 'Releases', content: <ReleasesTab applicationId={id} /> },
    { label: 'Bugs', content: <BugsTab applicationId={id} /> },
    { label: 'Known Issues', content: <KnownIssuesTab applicationId={id} /> },
    { label: 'Roadmap', content: <RoadmapTab applicationId={id} /> },
    { label: 'Timeline', content: <TimelineTab applicationId={id} /> },
    { label: 'Suggestions', content: <SuggestionsTab applicationId={id} applicationName={application.name} /> },
    { label: 'Attachments', content: <AttachmentsPanel entityType="application" entityId={id} /> },
  ];

  return (
    <Box>
      <BackButton />
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{application.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>{application.description}</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <StatusBadge value={application.status} />
            <StatusBadge value={application.priority} />
            {application.currentVersion && <Chip size="small" label={`v${application.currentVersion}`} variant="outlined" />}
          </Stack>
        </Box>
        {canUpdate && (
          <Button startIcon={<EditIcon />} variant="outlined" onClick={() => setEditOpen(true)}>Edit</Button>
        )}
      </Stack>

      {SECTIONS.map((section) => (
        <Accordion
          key={section.label}
          ref={(el) => { sectionRefs.current[section.label] = el; }}
          variant="outlined"
          TransitionProps={{ unmountOnExit: true }}
          expanded={expandedSection === section.label}
          onChange={(e, isExpanded) => {
            setExpandedSection(isExpanded ? section.label : false);
            if (isExpanded) {
              // Wait for the collapse/expand transitions to settle so the target isn't scrolled
              // to its pre-animation position.
              setTimeout(() => {
                sectionRefs.current[section.label]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 300);
            }
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>{section.label}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {section.content}
          </AccordionDetails>
        </Accordion>
      ))}

      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <CommentThread entityType="application" entityId={id} />
      </Paper>

      <ApplicationFormDialog
        open={editOpen}
        application={application}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); showSuccess('Application updated'); reload(); }}
      />
    </Box>
  );
}
