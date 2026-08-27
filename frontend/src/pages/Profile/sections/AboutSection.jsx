import { useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import SectionCard from './SectionCard';

// Deploy-time constants — an About page reflects the build that's running, not a live query.
const APP_INFO = {
  name: 'Application Library and Management System',
  shortName: 'ALMS',
  version: '1.0.0',
  frontendVersion: '1.0.0',
  backendVersion: '1.0.0',
  databaseVersion: 'PostgreSQL 18',
  buildNumber: 'B-1.0.0',
  releaseDate: 'Jul 28, 2026',
};

const LEGAL = {
  terms: {
    title: 'Terms & Conditions',
    body: 'This is an internal enterprise system provided for authorized use only. By using this application you agree to use it solely for legitimate business purposes and to comply with your organization\'s IT and data-handling policies.',
  },
  privacy: {
    title: 'Privacy Policy',
    body: 'This application stores the profile, account, and activity data needed to operate the platform (name, contact details, role, and an audit trail of actions taken). Data is used only to provide the service and is not shared outside the organization.',
  },
  licenses: {
    title: 'Open Source Licenses',
    body: 'This application is built with open-source software including React, Redux Toolkit, Material UI, Node.js, Express, and Sequelize, each distributed under their respective licenses (primarily MIT).',
  },
};

function ReadField({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Box>
  );
}

export default function AboutSection() {
  const [legalModal, setLegalModal] = useState(null);
  const environment = import.meta.env.MODE === 'production' ? 'Production' : import.meta.env.MODE === 'test' ? 'Testing' : 'Development';
  const envColor = environment === 'Production' ? 'success' : environment === 'Testing' ? 'warning' : 'info';

  return (
    <SectionCard title="About">
      <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={800}>{APP_INFO.name}</Typography>
        <Chip size="small" label={environment} color={envColor} />
      </Stack>

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}><ReadField label="Application Name" value={APP_INFO.shortName} /></Grid>
        <Grid item xs={12} sm={4}><ReadField label="Version" value={APP_INFO.version} /></Grid>
        <Grid item xs={12} sm={4}><ReadField label="Build Number" value={APP_INFO.buildNumber} /></Grid>
        <Grid item xs={12} sm={4}><ReadField label="Frontend Version" value={APP_INFO.frontendVersion} /></Grid>
        <Grid item xs={12} sm={4}><ReadField label="Backend Version" value={APP_INFO.backendVersion} /></Grid>
        <Grid item xs={12} sm={4}><ReadField label="Database Version" value={APP_INFO.databaseVersion} /></Grid>
        <Grid item xs={12} sm={4}><ReadField label="Release Date" value={APP_INFO.releaseDate} /></Grid>
      </Grid>

      <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap' }}>
        {Object.entries(LEGAL).map(([key, item]) => (
          <Link key={key} component="button" variant="body2" onClick={() => setLegalModal(key)}>{item.title}</Link>
        ))}
      </Stack>

      <Dialog open={!!legalModal} onClose={() => setLegalModal(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{legalModal && LEGAL[legalModal].title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{legalModal && LEGAL[legalModal].body}</DialogContentText>
        </DialogContent>
        <DialogActions><Button onClick={() => setLegalModal(null)}>Close</Button></DialogActions>
      </Dialog>
    </SectionCard>
  );
}
