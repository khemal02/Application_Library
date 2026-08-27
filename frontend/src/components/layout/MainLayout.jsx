import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Link from '@mui/material/Link';
import { useAppSelector } from '../../app/hooks';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import SidebarToggleHandle from './SidebarToggleHandle';

export default function MainLayout({ children }) {
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);

  return (
    <Box sx={{ display: 'flex' }}>
      <Link
        href="#main-content"
        sx={{
          position: 'absolute', left: -9999, top: 0, zIndex: 2000, p: 1.5, bgcolor: 'background.paper',
          '&:focus': { left: 8, top: 8 },
        }}
      >
        Skip to main content
      </Link>
      <Topbar />
      <Sidebar open={sidebarOpen} />
      <SidebarToggleHandle />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: '100vh',
          bgcolor: 'background.default',
          transition: (t) => t.transitions.create('margin', { duration: t.transitions.duration.short }),
        }}
      >
        <Toolbar />
        <Box
          id="main-content" tabIndex={-1}
          sx={{
            pt: { xs: 1, md: 1.5 }, px: { xs: 2, md: 3 }, pb: { xs: 2, md: 3 },
            maxWidth: 1400, mx: 'auto', outline: 'none',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
