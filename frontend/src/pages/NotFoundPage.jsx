import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Box sx={{ textAlign: 'center', py: 10 }}>
      <Typography variant="h3" fontWeight={700} gutterBottom>404</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Page not found</Typography>
      <Button variant="contained" onClick={() => navigate('/')}>Back to Home</Button>
    </Box>
  );
}
