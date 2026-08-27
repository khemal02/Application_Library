import { useState } from 'react';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';

const SUPPORT_EMAIL = 'support@aams.local';
const ADMIN_EMAIL = 'admin@aams.local';

const GUIDE_STEPS = [
  { title: 'Application Tracking & Documentation', body: 'Track every internal application\'s tech stack, features, AI prompts, architecture, docs, releases, and roadmap from its detail page.' },
  { title: 'New Application Ideas', body: 'Submit an idea from the Ideas page — it moves through Submitted → Discussion → Review → Approved/Rejected → Development Ready.' },
  { title: 'Existing Application Review & Improvement', body: 'Submit a suggestion against any application (bug, feature, performance, etc.) from that application\'s Suggestions tab, or from the global Suggestions page.' },
  { title: 'Exporting data', body: 'Any list page (Applications, Ideas, Suggestions) has an Export button for PDF/Excel, respecting your current filters.' },
];

const FAQ_ITEMS = [
  { q: 'How do I submit a new application idea?', a: 'Go to Ideas in the sidebar and click "Submit Idea". Fill in the problem, proposed solution, and expected benefits.' },
  { q: 'How do I suggest an improvement to an existing application?', a: 'Open the application\'s detail page, go to its Suggestions tab, and click "New Suggestion" — or submit one from the global Suggestions page and pick the application.' },
  { q: 'Why can\'t I see the Administration menu?', a: 'Administration (Users, Roles & Permissions, Departments) is restricted to the Admin role.' },
  { q: 'How do I change my password?', a: 'Go to Profile & Settings > Security > Change Password.' },
  { q: 'How do I log out of other devices?', a: 'Go to Profile & Settings > Security > Active Sessions, and use "Logout All Other Devices".' },
];

function HelpCard({ icon: Icon, title, description, onClick, href }) {
  return (
    <Paper
      variant="outlined"
      component={href ? 'a' : 'div'}
      href={href}
      onClick={onClick}
      sx={{
        p: 2.5, borderRadius: 3, cursor: 'pointer', textDecoration: 'none', color: 'inherit',
        display: 'flex', gap: 2, alignItems: 'flex-start', height: '100%',
        transition: (t) => t.transitions.create(['box-shadow', 'transform']),
        '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' },
      }}
    >
      <Box sx={{ color: 'primary.main', display: 'flex' }}><Icon /></Box>
      <Box>
        <Typography variant="body2" fontWeight={700}>{title}</Typography>
        <Typography variant="caption" color="text.secondary">{description}</Typography>
      </Box>
    </Paper>
  );
}

export default function HelpSection() {
  const [modal, setModal] = useState(null);

  const items = [
    { icon: MenuBookOutlinedIcon, title: 'User Guide', description: 'A quick walkthrough of the three modules.', onClick: () => setModal('guide') },
    { icon: HelpOutlineIcon, title: 'Frequently Asked Questions', description: 'Answers to common questions.', onClick: () => setModal('faq') },
    { icon: SupportAgentOutlinedIcon, title: 'Contact Administrator', description: 'Reach out to your system administrator.', href: `mailto:${ADMIN_EMAIL}` },
    { icon: BugReportOutlinedIcon, title: 'Report a Bug', description: 'Let us know something is broken.', href: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Bug Report — ALMS')}` },
    { icon: LightbulbOutlinedIcon, title: 'Request a Feature', description: 'Suggest something new for the platform.', href: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Feature Request — ALMS')}` },
    { icon: EmailOutlinedIcon, title: 'Support Email', description: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` },
  ];

  return (
    <>
      <Grid container spacing={2.5}>
        {items.map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.title}>
            <HelpCard {...item} />
          </Grid>
        ))}
      </Grid>

      <Dialog open={modal === 'guide'} onClose={() => setModal(null)} maxWidth="sm" fullWidth>
        <DialogTitle>User Guide</DialogTitle>
        <DialogContent dividers>
          <List>
            {GUIDE_STEPS.map((step) => (
              <ListItem key={step.title} sx={{ display: 'block', px: 0 }}>
                <ListItemText
                  primary={step.title}
                  secondary={step.body}
                  primaryTypographyProps={{ fontWeight: 700 }}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions><Button onClick={() => setModal(null)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={modal === 'faq'} onClose={() => setModal(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Frequently Asked Questions</DialogTitle>
        <DialogContent dividers>
          <List>
            {FAQ_ITEMS.map((item) => (
              <ListItem key={item.q} sx={{ display: 'block', px: 0 }}>
                <ListItemText
                  primary={item.q}
                  secondary={item.a}
                  primaryTypographyProps={{ fontWeight: 700 }}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions><Button onClick={() => setModal(null)}>Close</Button></DialogActions>
      </Dialog>
    </>
  );
}
