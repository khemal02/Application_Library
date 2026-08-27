import { useNavigate } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import AppsIcon from '@mui/icons-material/AppsOutlined';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import RateReviewIcon from '@mui/icons-material/RateReviewOutlined';
import LightbulbIcon from '@mui/icons-material/LightbulbOutlined';
import ThumbUpIcon from '@mui/icons-material/ThumbUpOutlined';
import BuildIcon from '@mui/icons-material/BuildOutlined';
import dayjs from 'dayjs';
import { dashboardApi } from '../../services/domains';
import useResource from '../../hooks/useResource';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import { describeAuditAction } from '../../utils/activityText';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useResource(() => dashboardApi.summary(), []);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;

  const stats = data?.stats || {};

  const cards = [
    { label: 'Total Applications', value: stats.totalApplications, icon: AppsIcon, color: 'primary' },
    { label: 'Applications In Progress', value: stats.applicationsInProgress, icon: AutorenewIcon, color: 'info' },
    { label: 'Completed Applications', value: stats.completedApplications, icon: CheckCircleIcon, color: 'success' },
    { label: 'Pending Reviews', value: stats.pendingReviews, icon: RateReviewIcon, color: 'warning' },
    { label: 'Pending Ideas', value: stats.pendingIdeas, icon: LightbulbIcon, color: 'secondary' },
    { label: 'Approved Ideas', value: stats.approvedIdeas, icon: ThumbUpIcon, color: 'success' },
    { label: 'Open Improvements', value: stats.openImprovements, icon: BuildIcon, color: 'error' },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Dashboard</Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {cards.map((c) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={c.label}>
            <StatCard {...c} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Recently Updated Applications</Typography>
            <List dense>
              {(data?.recentApplications || []).map((app) => (
                <ListItemButton key={app.id} onClick={() => navigate(`/applications/${app.id}`)}>
                  <ListItemText
                    primary={app.name}
                    secondary={`Updated ${dayjs(app.updatedAt).format('MMM D, YYYY HH:mm')}`}
                  />
                  <StatusBadge value={app.status} />
                </ListItemButton>
              ))}
              {data && data.recentApplications.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No applications yet</Typography>
              )}
            </List>
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Recent Activity</Typography>
            <List dense>
              {(data?.recentActivity || []).map((log, idx) => (
                <Box key={log.id}>
                  <ListItemButton disableRipple sx={{ cursor: 'default' }}>
                    <ListItemText
                      primary={describeAuditAction(log)}
                      secondary={dayjs(log.createdAt).format('MMM D, YYYY HH:mm')}
                    />
                  </ListItemButton>
                  {idx < data.recentActivity.length - 1 && <Divider />}
                </Box>
              ))}
              {data && data.recentActivity.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No recent activity</Typography>
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
