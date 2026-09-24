import Box from '@mui/material/Box';
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
      <Sidebar open={sidebarOpen} />
      <SidebarToggleHandle />
      {/* Topbar now lives in this column (sticky, not fixed-over-everything) so it starts at the
          sidebar's right edge instead of spanning the full viewport width above it — the sidebar
          carries its own brand mark at its own top now, matching the approved reference exactly. */}
      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <Topbar />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            bgcolor: 'background.default',
          }}
        >
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
    </Box>
  );
}
