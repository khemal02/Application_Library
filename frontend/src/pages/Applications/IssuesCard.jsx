import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckIcon from '@mui/icons-material/Check';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { issuesApi, votesApi } from '../../services/domains';
import { useAppSelector } from '../../app/hooks';
import useToast from '../../hooks/useToast';
import usePermission from '../../routes/usePermission';
import StatusBadge from '../../components/common/StatusBadge';
import NotesThread from '../../components/common/NotesThread';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';

dayjs.extend(relativeTime);

const MAX_VISIBLE = 5;
const OPEN_STATUSES = ['needs_triage', 'acknowledged', 'being_fixed'];
const RESOLVED_TAB_STATUSES = ['resolved', 'duplicate', 'not_an_issue'];
const CLOSED_STATUSES = ['resolved', 'known_limitation', 'duplicate', 'not_an_issue'];
const TABS = [
  { key: 'open', label: 'Open' },
  { key: 'known_limitation', label: 'Known limitations' },
  { key: 'resolved', label: 'Resolved' },
];
const EMPTY_META = {
  open: { title: 'No open issues', body: 'Anyone can report one with the button above.' },
  known_limitation: { title: 'No known limitations', body: 'Issues closed as a known limitation will appear here.' },
  resolved: { title: 'Nothing resolved yet', body: 'Resolved, duplicate, and not-an-issue reports will appear here.' },
};

// Severity is scanned by, so it's outlined and never competes with the filled status chip — see
// the Stage 0 answers. Deliberately its own map, not StatusBadge's COLOR_MAP (which colors
// 'medium' as info) — Stage 2's own instruction is explicit: "medium and low neutral".
const SEVERITY_META = {
  critical: { label: 'Critical', color: 'error' },
  high: { label: 'High', color: 'warning' },
  medium: { label: 'Medium', color: null },
  low: { label: 'Low', color: null },
};
const SEVERITY_REPORT_OPTIONS = [
  { value: 'critical', label: 'Critical', description: "Can't work at all" },
  { value: 'high', label: 'High', description: 'Painful workaround' },
  { value: 'medium', label: 'Medium', description: 'Annoying' },
  { value: 'low', label: 'Low', description: 'Cosmetic' },
];
const STATUS_META = {
  needs_triage: { label: 'Needs triage', color: 'warning' },
  acknowledged: { label: 'Acknowledged', color: 'info' },
  being_fixed: { label: 'Being fixed', color: 'info' },
  resolved: { label: 'Resolved', color: 'success' },
  known_limitation: { label: 'Known limitation', color: 'default' },
  duplicate: { label: 'Duplicate', color: 'default' },
  not_an_issue: { label: 'Not an issue', color: 'default' },
};
const TRIAGE_TITLES = {
  accept: 'Accept and fix',
  known_limitation: 'Mark as a known limitation',
  duplicate: 'Mark as a duplicate',
  not_an_issue: 'Mark as not an issue',
  convert: 'Convert to a change request',
};
const TRIAGE_COPY = {
  accept: 'This issue will be acknowledged and ready to work on.',
  known_limitation: 'This issue will be closed and documented as a known limitation.',
  duplicate: 'This issue will be closed and linked to the original.',
  not_an_issue: 'This issue will be closed as not an issue.',
  convert: 'This creates an already-approved change request (its Development/Testing/Deployment stages are seeded) and moves this issue to Being fixed. It resolves automatically once that change request is implemented.',
};
const NOTE_DIALOG_META = {
  resolve: {
    title: 'Resolve this issue', label: 'Resolution', submitLabel: 'Mark resolved',
    copy: '"Resolved" with no explanation is how the same bug gets reported again in a month.',
  },
  reopen: {
    title: 'Reopen this issue', label: 'Reason', submitLabel: 'Reopen',
    copy: 'This moves the issue back to Acknowledged so it can be worked again.',
  },
};

function SeverityChip({ severity }) {
  const meta = SEVERITY_META[severity] || SEVERITY_META.low;
  return <Chip size="small" variant="outlined" color={meta.color || 'default'} label={meta.label} />;
}

function ReportDialog({ open, onClose, onSubmit }) {
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState('');
  const [description, setDescription] = useState('');
  const [affectedVersion, setAffectedVersion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setTitle(''); setSeverity(''); setDescription(''); setAffectedVersion(''); setError(null);
    }
  }, [open]);

  const canSubmit = !!title.trim() && !!severity;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(), severity, description: description.trim() || undefined, affectedVersion: affectedVersion.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to report the issue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Report an issue</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            autoFocus fullWidth label="Title" value={title} inputProps={{ maxLength: 200 }}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextField select fullWidth label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {SEVERITY_REPORT_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label} — {opt.description}</MenuItem>
            ))}
          </TextField>
          <TextField fullWidth multiline minRows={3} label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <TextField fullWidth label="Affected version (optional)" value={affectedVersion} inputProps={{ maxLength: 50 }} onChange={(e) => setAffectedVersion(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" disabled={!canSubmit || submitting} onClick={handleSubmit}>
          {submitting ? 'Reporting...' : 'Report it'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TriageDialog({
  open, outcome, issue, applicationId, onClose, onSubmit,
}) {
  const [assigneeId, setAssigneeId] = useState('');
  const [duplicateOfId, setDuplicateOfId] = useState('');
  const [note, setNote] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [otherIssues, setOtherIssues] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setAssigneeId(''); setDuplicateOfId(''); setNote(''); setError(null);
    if (outcome === 'accept') {
      issuesApi.assigneeCandidates(applicationId).then((res) => setCandidates(res.data)).catch(() => {});
    } else if (outcome === 'duplicate') {
      issuesApi.list(applicationId, { group: 'open' })
        .then((res) => setOtherIssues(res.data.filter((i) => i.id !== issue?.id)))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, outcome, applicationId, issue?.id]);

  if (!outcome) return null;
  const requiresNote = outcome === 'known_limitation' || outcome === 'not_an_issue';
  const canSubmit = outcome === 'duplicate' ? !!duplicateOfId : (!requiresNote || !!note.trim());

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = { outcome };
      if (outcome === 'accept' && assigneeId) payload.assigneeId = assigneeId;
      if (outcome === 'duplicate') payload.duplicateOfId = duplicateOfId;
      if (requiresNote) payload.note = note.trim();
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to triage the issue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>{TRIAGE_TITLES[outcome]}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{TRIAGE_COPY[outcome]}</Typography>
        {outcome === 'accept' && (
          <TextField select fullWidth label="Assignee (optional)" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <MenuItem value="">— Unassigned —</MenuItem>
            {candidates.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}{c.roleLabel ? ` — ${c.roleLabel}` : ''}</MenuItem>
            ))}
          </TextField>
        )}
        {outcome === 'duplicate' && (
          <TextField select fullWidth label="Duplicate of" value={duplicateOfId} onChange={(e) => setDuplicateOfId(e.target.value)}>
            {otherIssues.length === 0 && <MenuItem value="" disabled>No other open issues on this application</MenuItem>}
            {otherIssues.map((i) => <MenuItem key={i.id} value={i.id}>{i.title}</MenuItem>)}
          </TextField>
        )}
        {requiresNote && (
          <TextField
            fullWidth multiline minRows={3} label="Reason" required value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" disabled={!canSubmit || submitting} onClick={handleSubmit}>
          {submitting ? 'Saving...' : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AssignDialog({
  open, issue, applicationId, onClose, onSubmit,
}) {
  const [assigneeId, setAssigneeId] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setAssigneeId(issue?.assignee?.id || '');
    setError(null);
    issuesApi.assigneeCandidates(applicationId).then((res) => setCandidates(res.data)).catch(() => {});
  }, [open, applicationId, issue?.assignee?.id]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ assigneeId: assigneeId || null });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update the assignee');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Assign this issue</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField select fullWidth label="Assignee" value={assigneeId} sx={{ mt: 0.5 }} onChange={(e) => setAssigneeId(e.target.value)}>
          <MenuItem value="">— Unassigned —</MenuItem>
          {candidates.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.name}{c.roleLabel ? ` — ${c.roleLabel}` : ''}</MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" disabled={submitting} onClick={handleSubmit}>{submitting ? 'Saving...' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
}

function NoteDialog({
  open, mode, onClose, onSubmit,
}) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const meta = NOTE_DIALOG_META[mode] || NOTE_DIALOG_META.resolve;

  useEffect(() => { if (open) { setNote(''); setError(null); } }, [open, mode]);

  const handleSubmit = async () => {
    if (!note.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ note: note.trim() });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>{meta.title}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{meta.copy}</Typography>
        <TextField
          autoFocus fullWidth multiline minRows={3} label={meta.label} required value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" disabled={!note.trim() || submitting} onClick={handleSubmit}>
          {submitting ? 'Saving...' : meta.submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function FieldLabel({ children }) {
  return (
    <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: '.07em', display: 'block' }}>
      {children}
    </Typography>
  );
}

function IssueRow({
  issue, expanded, onToggle, applicationId, applicationOwnerId, user, isSuperAdmin,
  onOpenTriage, onOpenAssign, onOpenResolve, onOpenReopen, onToggleVote, highlighted, rowRef,
}) {
  const navigate = useNavigate();
  const isOwner = !!applicationOwnerId && applicationOwnerId === user?.id;
  const canAct = isOwner || isSuperAdmin;
  const isAssignee = !!issue.assignee?.id && issue.assignee.id === user?.id;
  const isClosed = CLOSED_STATUSES.includes(issue.status);
  const goToChangeRequest = (e) => {
    e.stopPropagation();
    navigate(`/applications/${applicationId}/change-requests/${issue.changeRequest.id}`);
  };

  return (
    <Box
      ref={rowRef}
      id={`issue-${issue.id}`}
      sx={(theme) => ({
        border: 1, borderColor: 'divider', borderRadius: 1,
        bgcolor: highlighted ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
        transition: 'background-color 1.5s ease',
      })}
    >
      <Box
        role="button" tabIndex={0} aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        sx={{
          py: 1.5, px: 1.5, cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          {expanded
            ? <ExpandLessIcon fontSize="small" sx={{ color: 'text.secondary', mt: '2px' }} />
            : <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary', mt: '2px' }} />}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600}>{issue.title}</Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              <SeverityChip severity={issue.severity} />
              <Typography variant="caption" color="text.secondary">{issue.reporter?.name || 'Unknown'}</Typography>
              <Typography variant="caption" color="text.secondary">· {dayjs(issue.createdAt).fromNow()}</Typography>
              {issue.meTooCount > 1 && (
                <Typography variant="caption" color="text.secondary">· {issue.meTooCount} people hit this</Typography>
              )}
              {issue.assignee && (
                <Typography variant="caption" color="text.secondary">· Assigned to {issue.assignee.name}</Typography>
              )}
              {issue.duplicateOf && (
                <Typography variant="caption" color="text.secondary">· Duplicate of &quot;{issue.duplicateOf.title}&quot;</Typography>
              )}
              {issue.changeRequest && (
                <Typography
                  variant="caption" color="primary" role="button" tabIndex={0}
                  onClick={goToChangeRequest}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToChangeRequest(e); } }}
                  sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                >
                  · View change request
                </Typography>
              )}
            </Stack>
          </Box>
          <StatusBadge color={STATUS_META[issue.status]?.color} label={STATUS_META[issue.status]?.label} />
        </Stack>
      </Box>
      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ px: 1.5, pb: 2 }}>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={4}>
              <FieldLabel>Reported by</FieldLabel>
              <Typography variant="body2">{issue.reporter?.name || '—'}</Typography>
            </Grid>
            <Grid item xs={4}>
              <FieldLabel>Version</FieldLabel>
              <Typography variant="body2">{issue.affectedVersion || '—'}</Typography>
            </Grid>
            <Grid item xs={4}>
              <FieldLabel>Also hit by</FieldLabel>
              <Typography variant="body2">{issue.meTooCount > 0 ? `${issue.meTooCount} ${issue.meTooCount === 1 ? 'person' : 'people'}` : 'No one yet'}</Typography>
            </Grid>
          </Grid>

          {issue.description && (
            <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, mb: 2 }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{issue.description}</Typography>
            </Box>
          )}
          {issue.closureNote && (
            <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, mb: 2 }}>
              <FieldLabel>Closure note</FieldLabel>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{issue.closureNote}</Typography>
            </Box>
          )}

          <NotesThread
            entityType="issue" entityId={issue.id} title="Notes"
            disabled={isClosed}
            disabledReason="This issue is closed — reopen it to add a note."
          />

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            {canAct && issue.status === 'needs_triage' && (
              <>
                <Button size="small" variant="contained" onClick={() => onOpenTriage('accept')}>Accept and fix</Button>
                <Button size="small" variant="outlined" onClick={() => onOpenTriage('convert')}>Convert to change request</Button>
                <Button size="small" variant="outlined" onClick={() => onOpenTriage('known_limitation')}>Known limitation</Button>
                <Button size="small" variant="outlined" onClick={() => onOpenTriage('duplicate')}>Duplicate</Button>
                <Button size="small" variant="outlined" onClick={() => onOpenTriage('not_an_issue')}>Not an issue</Button>
              </>
            )}
            {canAct && (issue.status === 'acknowledged' || issue.status === 'being_fixed') && (
              issue.changeRequest ? (
                <Typography variant="body2" color="text.secondary">
                  Resolves automatically when its change request is implemented.
                </Typography>
              ) : (
                <>
                  <Button size="small" variant="outlined" onClick={onOpenAssign}>Assign</Button>
                  <Button size="small" variant="contained" onClick={onOpenResolve}>Mark resolved</Button>
                </>
              )
            )}
            {!canAct && isAssignee && issue.status === 'being_fixed' && (
              issue.changeRequest ? (
                <Typography variant="body2" color="text.secondary">
                  Resolves automatically when its change request is implemented.
                </Typography>
              ) : (
                <Button size="small" variant="contained" onClick={onOpenResolve}>Mark resolved</Button>
              )
            )}
            {canAct && isClosed && (
              <Button size="small" variant="outlined" onClick={onOpenReopen}>Reopen</Button>
            )}
            {!canAct && !(isAssignee && issue.status === 'being_fixed') && (
              <Button
                size="small" variant={issue.iHitThis ? 'contained' : 'outlined'}
                startIcon={issue.iHitThis ? <CheckIcon fontSize="small" /> : undefined}
                onClick={onToggleVote}
              >
                {issue.iHitThis ? 'You hit this too' : 'I hit this too'}
              </Button>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}

/**
 * Replaces the "Known Issues" accordion. Card chrome deliberately copies ChangeRequestsCard.jsx
 * exactly (plain Box, no Paper; bordered radius-1 rows; status chip top-right with reporter/date
 * beneath it; MAX_VISIBLE=5 with Show all/Show fewer) — see the Stage 0 answers, D6. Fetches the
 * full list once (like ChangeRequestsCard's own `{limit:100}`) and does tab filtering/counts/
 * show-all client-side, rather than a round trip per tab switch.
 */
export default function IssuesCard({ applicationId, applicationOwnerId }) {
  const user = useAppSelector((s) => s.auth.user);
  const isSuperAdmin = usePermission('*', 'manage');
  const { showSuccess, showError } = useToast();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [tab, setTab] = useState('open');
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);

  const [reportOpen, setReportOpen] = useState(false);
  const [triageState, setTriageState] = useState(null);
  const [assignState, setAssignState] = useState(null);
  const [noteState, setNoteState] = useState(null);

  const rowRefs = useRef({});
  const deepLinkAppliedRef = useRef(false);

  const reloadIssues = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await issuesApi.list(applicationId);
      setRows(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load issues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reloadIssues(); }, [applicationId]);
  useEffect(() => { setShowAll(false); }, [tab]);

  // Deep link: /applications/:id?issues=<tab>#issue-<issueId> — select the tab, expand and scroll
  // to the row, and flash a highlight. Waits for the first load so the target row actually exists.
  useEffect(() => {
    if (deepLinkAppliedRef.current || loading) return;
    const tabParam = searchParams.get('issues');
    const hashId = location.hash?.startsWith('#issue-') ? location.hash.slice('#issue-'.length) : null;
    if (!tabParam && !hashId) { deepLinkAppliedRef.current = true; return; }
    deepLinkAppliedRef.current = true;
    setAccordionOpen(true);
    if (tabParam && TABS.some((t) => t.key === tabParam)) setTab(tabParam);
    if (hashId) {
      setExpandedId(hashId);
      setTimeout(() => {
        rowRefs.current[hashId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedId(hashId);
        setTimeout(() => setHighlightedId(null), 2000);
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams, location.hash]);

  const handleReport = async (payload) => {
    await issuesApi.create(applicationId, payload);
    showSuccess('Issue reported');
    await reloadIssues();
  };
  const handleTriageSubmit = async (payload) => {
    // "Convert" isn't a triage outcome the backend understands — it's its own endpoint (Stage 3),
    // just presented as the 5th button in the same triage dialog set for a consistent UI.
    if (payload.outcome === 'convert') {
      await issuesApi.convert(applicationId, triageState.issue.id);
      showSuccess('Converted to a change request');
    } else {
      await issuesApi.triage(applicationId, triageState.issue.id, payload);
      showSuccess('Issue triaged');
    }
    await reloadIssues();
  };
  const handleAssignSubmit = async (payload) => {
    await issuesApi.assign(applicationId, assignState.issue.id, payload);
    showSuccess('Assignment updated');
    await reloadIssues();
  };
  const handleNoteSubmit = async (payload) => {
    if (noteState.mode === 'resolve') {
      await issuesApi.resolve(applicationId, noteState.issue.id, payload);
      showSuccess('Issue resolved');
    } else {
      await issuesApi.reopen(applicationId, noteState.issue.id, payload);
      showSuccess('Issue reopened');
    }
    await reloadIssues();
  };
  const handleVoteToggle = async (issue) => {
    try {
      await votesApi.toggle({ entityType: 'issue', entityId: issue.id, voteType: 'upvote' });
      await reloadIssues();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update');
    }
  };

  const openRows = rows.filter((r) => OPEN_STATUSES.includes(r.status));
  const knownLimitationRows = rows.filter((r) => r.status === 'known_limitation');
  const resolvedRows = rows.filter((r) => RESOLVED_TAB_STATUSES.includes(r.status));
  const rowsByTab = { open: openRows, known_limitation: knownLimitationRows, resolved: resolvedRows };
  const activeRows = rowsByTab[tab] || [];
  const visible = showAll ? activeRows : activeRows.slice(0, MAX_VISIBLE);

  const criticalOpenCount = openRows.filter((r) => r.severity === 'critical').length;
  const headerCount = criticalOpenCount > 0 ? `${openRows.length} open · ${criticalOpenCount} critical` : `${openRows.length} open`;

  return (
    <Box>
      <Accordion
        variant="outlined" disableGutters
        expanded={accordionOpen}
        onChange={(e, isExpanded) => setAccordionOpen(isExpanded)}
        sx={{ '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography variant="subtitle1" fontWeight={700}>Issues</Typography>
            {rows.length > 0 && <Typography variant="caption" color="text.secondary">{headerCount}</Typography>}
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setReportOpen(true)}>
              Report an issue
            </Button>
          </Stack>

          <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="standard" sx={{ mb: 1.5, minHeight: 36 }}>
            {TABS.map((t) => (
              <Tab key={t.key} value={t.key} label={`${t.label} (${rowsByTab[t.key].length})`} sx={{ minHeight: 36, py: 0.5 }} />
            ))}
          </Tabs>

          {loading ? (
            <LoadingBlock minHeight="80px" />
          ) : error ? (
            <ErrorBlock message={error} onRetry={reloadIssues} />
          ) : activeRows.length === 0 ? (
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 3, textAlign: 'center' }}>
              <Typography variant="body2" fontWeight={600}>{EMPTY_META[tab].title}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{EMPTY_META[tab].body}</Typography>
            </Box>
          ) : (
            <>
              <Stack spacing={1.5}>
                {visible.map((issue) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    expanded={expandedId === issue.id}
                    onToggle={() => setExpandedId((cur) => (cur === issue.id ? null : issue.id))}
                    applicationId={applicationId}
                    applicationOwnerId={applicationOwnerId}
                    user={user}
                    isSuperAdmin={isSuperAdmin}
                    onOpenTriage={(outcome) => setTriageState({ issue, outcome })}
                    onOpenAssign={() => setAssignState({ issue })}
                    onOpenResolve={() => setNoteState({ issue, mode: 'resolve' })}
                    onOpenReopen={() => setNoteState({ issue, mode: 'reopen' })}
                    onToggleVote={() => handleVoteToggle(issue)}
                    highlighted={highlightedId === issue.id}
                    rowRef={(el) => { rowRefs.current[issue.id] = el; }}
                  />
                ))}
              </Stack>
              {activeRows.length > MAX_VISIBLE && (
                <Typography
                  variant="caption" color="primary" role="button" tabIndex={0}
                  onClick={() => setShowAll((s) => !s)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAll((s) => !s); } }}
                  sx={{
                    display: 'block', mt: 1, textAlign: 'right', cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  {showAll ? 'Show fewer' : `Show all ${activeRows.length} →`}
                </Typography>
              )}
            </>
          )}
        </AccordionDetails>
      </Accordion>

      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} onSubmit={handleReport} />
      <TriageDialog
        open={!!triageState} outcome={triageState?.outcome} issue={triageState?.issue} applicationId={applicationId}
        onClose={() => setTriageState(null)} onSubmit={handleTriageSubmit}
      />
      <AssignDialog
        open={!!assignState} issue={assignState?.issue} applicationId={applicationId}
        onClose={() => setAssignState(null)} onSubmit={handleAssignSubmit}
      />
      <NoteDialog
        open={!!noteState} mode={noteState?.mode}
        onClose={() => setNoteState(null)} onSubmit={handleNoteSubmit}
      />
    </Box>
  );
}
