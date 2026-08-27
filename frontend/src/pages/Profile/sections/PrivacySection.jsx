import { useEffect, useState } from 'react';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import { profileApi } from '../../../services/domains';
import useResource from '../../../hooks/useResource';
import useToast from '../../../hooks/useToast';
import { ErrorBlock } from '../../../components/common/AsyncState';
import SectionCard from './SectionCard';

const OPTIONS = [
  { key: 'showEmail', label: 'Show Email', description: 'Let others see your email address on your profile.' },
  { key: 'showPhone', label: 'Show Phone Number', description: 'Let others see your phone number on your profile.' },
  { key: 'showDepartment', label: 'Show Department', description: 'Let others see which department you belong to.' },
  { key: 'showDesignation', label: 'Show Designation', description: 'Let others see your job title.' },
  { key: 'allowProfileView', label: 'Allow Others to View Profile', description: 'Turn this off to hide your profile from other users entirely.' },
];

export default function PrivacySection() {
  const { data, loading, error, reload } = useResource(() => profileApi.getPrivacy());
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => { if (data) setSettings(data); }, [data]);

  if (loading) {
    return (
      <SectionCard title="Privacy">
        <Stack spacing={2}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="rounded" height={48} />)}
        </Stack>
      </SectionCard>
    );
  }
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!settings) return null;

  const toggle = (key) => setSettings((s) => ({ ...s, [key]: !s[key] }));

  const save = async () => {
    setSaving(true);
    try {
      await profileApi.updatePrivacy(settings);
      showSuccess('Privacy settings saved');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to save privacy settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Privacy">
      <Stack divider={<Divider />}>
        {OPTIONS.map((opt) => (
          <Box key={opt.key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
            <Box sx={{ pr: 2 }}>
              <Typography variant="body2" fontWeight={600}>{opt.label}</Typography>
              <Typography variant="caption" color="text.secondary">{opt.description}</Typography>
            </Box>
            <FormControlLabel
              sx={{ m: 0 }}
              control={<Switch checked={!!settings[opt.key]} onChange={() => toggle(opt.key)} />}
              label=""
            />
          </Box>
        ))}
      </Stack>

      <Button variant="contained" sx={{ mt: 3 }} disabled={saving} onClick={save}>Save</Button>
    </SectionCard>
  );
}
