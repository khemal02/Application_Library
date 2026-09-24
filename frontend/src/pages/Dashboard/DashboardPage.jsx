import { useNavigate } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import AppsIcon from '@mui/icons-material/AppsOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import ThumbUpIcon from '@mui/icons-material/ThumbUpOutlined';
import CodeIcon from '@mui/icons-material/CodeOutlined';
import FactCheckIcon from '@mui/icons-material/FactCheckOutlined';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunchOutlined';
import { dashboardApi } from '../../services/domains';
import useResource from '../../hooks/useResource';
import { LoadingBlock, ErrorBlock } from '../../components/common/AsyncState';
import StatCard from '../../components/common/StatCard';
import { useAppSelector } from '../../app/hooks';
import usePageMeta from '../../hooks/usePageMeta';

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  usePageMeta('Dashboard', 'Your application library overview.');
  const { data, loading, error, reload } = useResource(() => dashboardApi.summary(), []);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;

  const stats = data?.stats || {};

  // An org-wide count, four review/approve worklist tiles, and three delivery-stage tiles — each
  // links straight to where the work actually is. Ideas/Feature Requests each have their own list
  // page to filter into; change requests don't (they only ever live inside one application's
  // page), which is why their three tiles land on a dedicated page instead — see
  // MyAssignedStagesPage.jsx and dashboard.service.js#getSummary for where all seven personal
  // counts come from.
  const cards = [
    { label: 'Total Applications', value: stats.totalApplications, icon: AppsIcon, color: 'violet', path: '/applications' },
    { label: 'My Applications', value: stats.myApplications, icon: AppsIcon, color: 'info', path: `/applications?ownerId=${user?.id}` },
    { label: 'My Review for New Idea', value: stats.myReviewIdeas, icon: LightbulbOutlinedIcon, color: 'orange', path: '/ideas?awaitingMyReview=true&kind=reviewer' },
    { label: 'My Review for Feature Request', value: stats.myReviewFeatureRequests, icon: LightbulbOutlinedIcon, color: 'orange', path: '/feature-requests?awaitingMyReview=true&kind=reviewer' },
    { label: 'My Approve for New Idea', value: stats.myApproveIdeas, icon: ThumbUpIcon, color: 'success', path: '/ideas?awaitingMyReview=true&kind=approver' },
    { label: 'My Approve for Feature Request', value: stats.myApproveFeatureRequests, icon: ThumbUpIcon, color: 'success', path: '/feature-requests?awaitingMyReview=true&kind=approver' },
    { label: 'My Development', value: stats.myDevelopmentStages, icon: CodeIcon, color: 'info', path: '/my-stages?stage=development' },
    { label: 'My Testing', value: stats.myTestingStages, icon: FactCheckIcon, color: 'info', path: '/my-stages?stage=testing' },
    { label: 'My Deployment', value: stats.myDeploymentStages, icon: RocketLaunchIcon, color: 'success', path: '/my-stages?stage=deployment' },
  ];

  return (
    <Box>
      <Grid container spacing={2}>
        {cards.map(({ path, ...c }) => (
          <Grid item xs={12} sm={6} md={4} key={c.label}>
            <StatCard {...c} onClick={() => navigate(path)} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
