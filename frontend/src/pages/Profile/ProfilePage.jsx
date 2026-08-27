import { useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ProfileSection from './sections/ProfileSection';
import AccountSection from './sections/AccountSection';
import SecuritySection from './sections/SecuritySection';
import PrivacySection from './sections/PrivacySection';
import ActivitySection from './sections/ActivitySection';
import HelpSection from './sections/HelpSection';
import AboutSection from './sections/AboutSection';

const SECTIONS = [
  { key: 'profile', label: 'Profile', icon: PersonOutlineIcon, Component: ProfileSection },
  { key: 'account', label: 'Account', icon: BadgeOutlinedIcon, Component: AccountSection },
  { key: 'security', label: 'Security', icon: LockOutlinedIcon, Component: SecuritySection },
  { key: 'privacy', label: 'Privacy', icon: VisibilityOutlinedIcon, Component: PrivacySection },
  { key: 'activity', label: 'Activity', icon: HistoryOutlinedIcon, Component: ActivitySection },
  { key: 'help', label: 'Help', icon: HelpOutlineIcon, Component: HelpSection },
  { key: 'about', label: 'About', icon: InfoOutlinedIcon, Component: AboutSection },
];

const STORAGE_KEY = 'alms_profile_tab';

function getInitialTab() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return SECTIONS.some((s) => s.key === saved) ? saved : 'profile';
}

export default function ProfilePage() {
  const [active, setActive] = useState(getInitialTab);
  const current = SECTIONS.find((s) => s.key === active) || SECTIONS[0];
  const Content = current.Component;

  const selectTab = (key) => {
    setActive(key);
    localStorage.setItem(STORAGE_KEY, key);
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Profile & Settings</Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', position: { md: 'sticky' }, top: { md: 88 } }}>
            <List disablePadding>
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const selected = section.key === active;
                return (
                  <ListItemButton
                    key={section.key}
                    selected={selected}
                    onClick={() => selectTab(section.key)}
                    sx={{
                      py: 1.25,
                      borderLeft: '3px solid',
                      borderLeftColor: selected ? 'primary.main' : 'transparent',
                      '&.Mui-selected': { bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(79,70,229,0.18)' : 'rgba(79,70,229,0.08)') },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: selected ? 'primary.main' : 'inherit' }}>
                      <Icon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={section.label}
                      primaryTypographyProps={{ fontWeight: selected ? 700 : 500, color: selected ? 'primary.main' : 'text.primary' }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={9}>
          <Content />
        </Grid>
      </Grid>
    </Box>
  );
}
