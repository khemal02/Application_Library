import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Avatar from '@mui/material/Avatar';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import dayjs from 'dayjs';
import { changeRequestsApi } from '../../services/domains';
import { useAppSelector } from '../../app/hooks';
import useResource from '../../hooks/useResource';
import useToast from '../../hooks/useToast';
import usePermission from '../../routes/usePermission';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import StatusBadge from '../../components/common/StatusBadge';
import BackButton from '../../components/common/BackButton';
import {
  STAGE_ORDER, STAGE_LABELS, STAGE_STATUS_LABELS, deriveStatusChip,
} from '../../utils/changeRequestStatus';

const formatDate = (value) => (value ? dayjs(value).format('MMM D, YYYY') : '—');

// `value` is sometimes a StatusBadge (renders a <div>), which React DOM-nesting rules forbid
// inside a <p> (Typography's default root) — render a plain string as Typography, anything else
// as a Box. Same split ProjectInfoBox.jsx already uses for this exact reason.
function InfoField({ label, value }) {
  return (
    <Grid item xs={12} sm={4}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      {typeof value === 'string' ? (
        <Typography variant="body2" sx={{ mt: 0.25 }}>{value}</Typography>
      ) : (
        <Box sx={{ mt: 0.25 }}>{value}</Box>
      )}
    </Grid>
  );
}

/** Three equal boxes — the request's own pipeline, not to be confused with the application's own
 * Development/Testing/Deployment stepper on its own detail page (deliberately not styled to look
 * like it: this one lives under the request's title, which already does the disambiguating). */
function WorkflowBar({ stages }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1.5 }}>
      {stages.map((s, i) => {
        const isComplete = s.status === 'complete';
        const isCurrent = s.status === 'in_progress';
        return (
          <Stack key={s.stage} direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                flex: 1, minWidth: 0, p: 1.5, borderRadius: 1, textAlign: 'center', border: 1.5,
                borderColor: isCurrent ? 'primary.main' : 'divider',
                bgcolor: isComplete ? 'success.main' : isCurrent ? 'action.hover' : 'transparent',
                color: isComplete ? 'success.contrastText' : 'text.primary',
              }}
            >
              <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }}>STEP {i + 1}</Typography>
              <Typography variant="body2" fontWeight={700}>{STAGE_LABELS[s.stage]}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>{STAGE_STATUS_LABELS[s.status]}</Typography>
            </Box>
            {i < stages.length - 1 && <ArrowForwardIcon fontSize="small" color="disabled" />}
          </Stack>
        );
      })}
    </Stack>
  );
}

function StageCircle({ index, status }) {
  if (status === 'complete') {
    return (
      <Avatar sx={{ width: 32, height: 32, bgcolor: 'success.main' }}>
        <CheckIcon fontSize="small" />
      </Avatar>
    );
  }
  if (status === 'in_progress') {
    return <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>{index + 1}</Avatar>;
  }
  return <Avatar sx={{ width: 32, height: 32, bgcolor: 'action.disabledBackground', color: 'text.secondary' }}>{index + 1}</Avatar>;
}

/**
 * One of the three stage sections — deliberately identical in structure for all three, per the
 * project report ("that's the point, so reading one teaches all three"). `notEditableReason`
 * (set only when the whole request isn't `approved` yet) replaces the normal per-stage button
 * logic entirely — an implemented request needs no such copy, since every section is already
 * `complete` by the time that's true, which already renders no buttons on its own.
 */
function StageSection({
  index, stageData, canAct, isEditable, isBlockedByPredecessor, predecessorLabel,
  notEditableReason, candidates, draft, onDraftChange, onStart, onSave, onComplete, submitting,
}) {
  const isComplete = stageData.status === 'complete';
  // Three distinct field renderings, not two: 'text' (complete, or not approved yet, or a viewer
  // who simply isn't allowed to act here at all) never shows a form control — not even a disabled
  // one, per the rule that a non-permitted viewer sees plain text, "not disabled inputs". 'editable'
  // is the one in_progress section a permitted viewer can actually work in. 'disabled' is the
  // not-started-but-permitted case — shown as real (disabled, empty) controls specifically because
  // it's this viewer's stage to eventually act on, just not yet.
  const fieldMode = notEditableReason || isComplete || !canAct
    ? 'text'
    : isEditable ? 'editable' : 'disabled';

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: isEditable ? 'primary.main' : 'divider' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <StageCircle index={index} status={stageData.status} />
          <Typography variant="subtitle1" fontWeight={700}>{STAGE_LABELS[stageData.stage]}</Typography>
        </Stack>
        <StatusBadge
          color={isComplete ? 'success' : stageData.status === 'in_progress' ? 'info' : 'default'}
          label={STAGE_STATUS_LABELS[stageData.status]}
        />
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Assigned to</Typography>
          {fieldMode === 'text' ? (
            <Typography variant="body2" sx={{ mt: 0.25 }}>{stageData.assignee?.name || '—'}</Typography>
          ) : (
            <TextField
              select fullWidth size="small" sx={{ mt: 0.5 }}
              disabled={fieldMode === 'disabled'}
              value={fieldMode === 'disabled' ? '' : draft.assigneeId}
              onChange={(e) => onDraftChange({ ...draft, assigneeId: e.target.value })}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {candidates.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name} — {c.roleLabel}</MenuItem>
              ))}
            </TextField>
          )}
        </Grid>
        <Grid item xs={12} sm={4}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Start date</Typography>
          {fieldMode === 'text' ? (
            <Typography variant="body2" sx={{ mt: 0.25 }}>{formatDate(stageData.startDate)}</Typography>
          ) : (
            <TextField
              type="date" fullWidth size="small" sx={{ mt: 0.5 }} InputLabelProps={{ shrink: true }}
              disabled={fieldMode === 'disabled'}
              value={fieldMode === 'disabled' ? '' : (draft.startDate || '')}
              onChange={(e) => onDraftChange({ ...draft, startDate: e.target.value })}
            />
          )}
        </Grid>
        <Grid item xs={12} sm={4}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>End date</Typography>
          {fieldMode === 'text' ? (
            <Typography variant="body2" sx={{ mt: 0.25 }}>{formatDate(stageData.endDate)}</Typography>
          ) : (
            <TextField
              type="date" fullWidth size="small" sx={{ mt: 0.5 }} InputLabelProps={{ shrink: true }}
              disabled={fieldMode === 'disabled'}
              value={fieldMode === 'disabled' ? '' : (draft.endDate || '')}
              onChange={(e) => onDraftChange({ ...draft, endDate: e.target.value })}
            />
          )}
        </Grid>
      </Grid>

      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Notes</Typography>
        {fieldMode === 'text' ? (
          <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: 'pre-wrap' }}>{stageData.notes || '—'}</Typography>
        ) : (
          <TextField
            fullWidth multiline minRows={2} size="small" sx={{ mt: 0.5 }}
            disabled={fieldMode === 'disabled'}
            value={fieldMode === 'disabled' ? '' : draft.notes}
            onChange={(e) => onDraftChange({ ...draft, notes: e.target.value })}
          />
        )}
      </Box>

      {notEditableReason ? (
        <Typography variant="body2" color="text.secondary">{notEditableReason}</Typography>
      ) : !canAct ? null : stageData.status === 'not_started' ? (
        <Box>
          <Button variant="outlined" disabled={isBlockedByPredecessor || submitting} onClick={onStart}>
            Start {STAGE_LABELS[stageData.stage]}
          </Button>
          {isBlockedByPredecessor && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
              Starts when {predecessorLabel} is complete.
            </Typography>
          )}
        </Box>
      ) : stageData.status === 'in_progress' ? (
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" disabled={submitting} onClick={onSave}>Save</Button>
          <Button variant="contained" disabled={submitting} onClick={onComplete}>
            Mark {STAGE_LABELS[stageData.stage]} complete
          </Button>
        </Stack>
      ) : null}
    </Paper>
  );
}

const EMPTY_DRAFT = {
  assigneeId: '', startDate: '', endDate: '', notes: '',
};

// assigneeId/notes are always sent explicitly (including null, to support clearing them) — but a
// blank date is OMITTED rather than sent as null, so the backend's own "default to today" rule
// (rule 4) still gets to apply when the user just clicks Save/Mark complete without having
// touched the date fields themselves. Sending an explicit null there would silently defeat that
// default every time.
function buildDraftPayload(draft) {
  const payload = { assigneeId: draft.assigneeId || null, notes: draft.notes || null };
  if (draft.startDate) payload.startDate = draft.startDate;
  if (draft.endDate) payload.endDate = draft.endDate;
  return payload;
}

/**
 * Everything on this screen is derived from one refetch after every action (rule: "never patch
 * local state") — the header chip, the workflow bar and every stage section all read the same
 * server response, so they can never disagree with each other.
 */
export default function ChangeRequestDetailPage() {
  const { applicationId, changeRequestId } = useParams();
  const user = useAppSelector((s) => s.auth.user);
  const isSuperAdmin = usePermission('*', 'manage');
  const { showSuccess, showError } = useToast();
  const { data, loading, error, reload } = useResource(
    () => changeRequestsApi.getById(applicationId, changeRequestId),
    [applicationId, changeRequestId],
  );
  const [candidates, setCandidates] = useState([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    changeRequestsApi.assigneeCandidates(applicationId, changeRequestId)
      .then((res) => setCandidates(res.data))
      .catch(() => setCandidates([]));
  }, [applicationId, changeRequestId]);

  const inProgressStage = data?.stages?.find((s) => s.status === 'in_progress');
  useEffect(() => {
    if (inProgressStage) {
      setDraft({
        assigneeId: inProgressStage.assigneeId || '',
        startDate: inProgressStage.startDate || '',
        endDate: inProgressStage.endDate || '',
        notes: inProgressStage.notes || '',
      });
    }
  }, [data]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return null;

  const chip = deriveStatusChip(data);
  const isRequestReady = data.status === 'approved' || data.status === 'implemented';
  const notEditableReason = isRequestReady ? null
    : data.status === 'rejected' ? 'This change request was rejected.'
      : 'Available once this request is approved.';

  const canActOnStage = (stageData) => isSuperAdmin
    || data.application?.ownerId === user?.id
    || (!!stageData.assigneeId && stageData.assigneeId === user?.id);

  const patchStage = async (stage, payload, successMessage) => {
    setSubmitting(true);
    try {
      await changeRequestsApi.updateStage(applicationId, changeRequestId, stage, payload);
      showSuccess(successMessage);
      await reload();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update stage');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <BackButton>Back to {data.application?.name || 'application'}</BackButton>

      <Paper variant="outlined" sx={{ p: 2, mt: 1, mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" fontWeight={700}>{data.title}</Typography>
          <StatusBadge color={chip.color} label={chip.label} />
        </Stack>
        <WorkflowBar stages={data.stages} />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <InfoField label="Requested by" value={data.requester?.name || 'Unknown user'} />
          <InfoField label="Requested on" value={formatDate(data.createdAt)} />
          <InfoField label="Priority" value={<StatusBadge value={data.priority} />} />
        </Grid>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Description</Typography>
        <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: 'pre-wrap' }}>{data.description || '—'}</Typography>
      </Paper>

      {data.stages.map((stageData, index) => {
        const canAct = canActOnStage(stageData);
        const isEditable = isRequestReady && stageData.status === 'in_progress';
        const predecessor = index > 0 ? data.stages[index - 1] : null;
        const isBlockedByPredecessor = index > 0 && predecessor.status !== 'complete';

        return (
          <StageSection
            key={stageData.id}
            index={index}
            stageData={stageData}
            canAct={canAct}
            isEditable={isEditable}
            isBlockedByPredecessor={isBlockedByPredecessor}
            predecessorLabel={predecessor ? STAGE_LABELS[predecessor.stage] : null}
            notEditableReason={notEditableReason}
            candidates={candidates}
            draft={draft}
            onDraftChange={setDraft}
            submitting={submitting}
            onStart={() => patchStage(stageData.stage, { status: 'in_progress' }, `${STAGE_LABELS[stageData.stage]} started`)}
            onSave={() => patchStage(stageData.stage, buildDraftPayload(draft), 'Saved')}
            onComplete={() => patchStage(
              stageData.stage,
              { ...buildDraftPayload(draft), status: 'complete' },
              `${STAGE_LABELS[stageData.stage]} complete`,
            )}
          />
        );
      })}
    </Box>
  );
}
