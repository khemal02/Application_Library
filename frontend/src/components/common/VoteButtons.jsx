import { useEffect, useState } from 'react';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { votesApi } from '../../services/domains';

export default function VoteButtons({ entityType, entityId, showBookmark = true }) {
  const [summary, setSummary] = useState({ counts: {}, userVotes: [] });
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const res = await votesApi.summary(entityType, entityId);
      setSummary(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load votes');
    }
  };

  useEffect(() => { load(); }, [entityType, entityId]);

  const toggle = async (voteType) => {
    if (pending) return; // one in-flight toggle at a time — prevents double-click duplicate votes
    setPending(voteType);
    try {
      await votesApi.toggle({ entityType, entityId, voteType });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update vote');
    } finally {
      setPending(null);
    }
  };

  const hasUpvoted = summary.userVotes.includes('upvote');
  const hasBookmarked = summary.userVotes.includes('bookmark');

  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center">
        <Tooltip title={hasUpvoted ? 'Remove upvote' : 'Upvote'}>
          <span>
            <IconButton
              size="small" color={hasUpvoted ? 'primary' : 'default'} disabled={!!pending}
              aria-label={hasUpvoted ? 'Remove upvote' : 'Upvote'} onClick={() => toggle('upvote')}
            >
              {hasUpvoted ? <ThumbUpIcon fontSize="small" /> : <ThumbUpOutlinedIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
        <Typography variant="body2">{summary.counts.upvote || 0}</Typography>
        {showBookmark && (
          <Tooltip title={hasBookmarked ? 'Remove bookmark' : 'Bookmark'}>
            <span>
              <IconButton
                size="small" color={hasBookmarked ? 'primary' : 'default'} disabled={!!pending}
                aria-label={hasBookmarked ? 'Remove bookmark' : 'Bookmark'} onClick={() => toggle('bookmark')}
              >
                {hasBookmarked ? <BookmarkIcon fontSize="small" /> : <BookmarkBorderIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Stack>
      <Snackbar open={!!error} autoHideDuration={4000} onClose={() => setError(null)}>
        <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
      </Snackbar>
    </>
  );
}
