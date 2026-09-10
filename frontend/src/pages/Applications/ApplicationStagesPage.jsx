import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import dayjs from 'dayjs';
import { applicationsApi } from '../../services/domains';
import useResource from '../../hooks/useResource';
import useBreadcrumbLabel from '../../hooks/useBreadcrumbLabel';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import BackButton from '../../components/common/BackButton';
import StatusBadge from '../../components/common/StatusBadge';
import { STAGE_ORDER, STAGE_LABELS, STAGE_STATUS_LABELS } from '../../utils/applicationTrackStatus';

const formatDate = (value) => (value ? dayjs(value).format('MMM D, YYYY') : '—');

const STAGE_CHIP_COLOR = { not_started: 'default', in_progress: 'info', complete: 'success' };

const CAPTION_SX = {
  display: 'block', textTransform: 'uppercase', letterSpacing: '.07em', color: 'text.disabled',
};

function ReadField({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" sx={CAPTION_SX}>{label}</Typography>
      <Typography variant="body2" color={value ? 'text.primary' : 'text.disabled'} sx={{ mt: 0.25 }}>
        {value || '—'}
      </Typography>
    </Box>
  );
}

function IdeaFieldAccordion({ label, value }) {
  return (
    <Accordion disableGutters variant="outlined" sx={{ mb: 1.5, '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2" fontWeight={700}>{label}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', textAlign: 'justify' }}>
          {value || '—'}
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
}

/** Read-only record of one Development/Testing/Deployment stage, exactly as it was left when the
 * track that produced this application went live — nothing here is editable from this page. */
function StageCard({ stage, stageData }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>{STAGE_LABELS[stage]}</Typography>
        <StatusBadge color={STAGE_CHIP_COLOR[stageData.status]} label={STAGE_STATUS_LABELS[stageData.status]} />
      </Stack>
      <Grid container spacing={2}>
        <Grid item xs={6} sm={2.4}><ReadField label="Assignee" value={stageData.assignee?.name} /></Grid>
        <Grid item xs={6} sm={2.4}><ReadField label="Started" value={formatDate(stageData.startDate)} /></Grid>
        <Grid item xs={6} sm={2.4}><ReadField label="Expected finish" value={formatDate(stageData.endDate)} /></Grid>
        <Grid item xs={6} sm={2.4}><ReadField label="Finished date" value={formatDate(stageData.finishedDate)} /></Grid>
        <Grid item xs={6} sm={2.4}>
          <ReadField
            label="Document link"
            value={stageData.documentUrl ? (
              <Link href={stageData.documentUrl} target="_blank" rel="noopener noreferrer">{stageData.documentUrl}</Link>
            ) : null}
          />
        </Grid>
      </Grid>
    </Paper>
  );
}

/**
 * The record of how this application came to be — reached by clicking the title card on its
 * detail page (ProjectInfoBox.jsx). Only ever has content for an application registered through
 * Idea Prioritization's go-live step (see applications.service.js#getOrigin); one created directly
 * in the catalogue has no idea/track to show, and that's the common case, not an error state.
 */
export default function ApplicationStagesPage() {
  const { id } = useParams();
  const { data: application, loading: loadingApp, error: appError, reload: reloadApp } = useResource(() => applicationsApi.getById(id), [id]);
  const { data: origin, loading: loadingOrigin, error: originError, reload: reloadOrigin } = useResource(() => applicationsApi.getOrigin(id), [id]);
  useBreadcrumbLabel(application?.name);

  if (loadingApp || loadingOrigin) return <LoadingBlock />;
  if (appError) return <ErrorBlock message={appError} onRetry={reloadApp} />;
  if (originError) return <ErrorBlock message={originError} onRetry={reloadOrigin} />;
  if (!application) return null;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1}>
        <BackButton />
        <Typography variant="body2" color="text.secondary">
          Owner by, <Typography component="span" variant="body2" fontWeight={700} color="text.primary">{application.owner?.name || '—'}</Typography>
        </Typography>
      </Stack>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2, mt: 1 }}>{application.name}</Typography>

      {!origin ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" fontWeight={600}>No idea or stage history for this application</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            It was registered directly in the catalogue, not through Idea Prioritization.
          </Typography>
        </Paper>
      ) : (
        <>
          {origin.idea && (
            <Box sx={{ mb: 2 }}>
              <IdeaFieldAccordion label="Problem Statement" value={origin.idea.description} />
              <IdeaFieldAccordion label="Solution" value={origin.idea.proposedSolution} />
              <IdeaFieldAccordion label="Technologies and Efficiency" value={origin.idea.technologiesAndEfficiency} />
            </Box>
          )}

          <Stack spacing={2}>
            {STAGE_ORDER.map((stage) => {
              const stageData = origin.stages.find((s) => s.stage === stage) || { stage, status: 'not_started' };
              return <StageCard key={stage} stage={stage} stageData={stageData} />;
            })}
          </Stack>
        </>
      )}
    </Box>
  );
}
