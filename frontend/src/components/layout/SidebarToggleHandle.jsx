import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { toggleSidebar } from '../../features/ui/uiSlice';
import { DRAWER_WIDTH, COLLAPSED_WIDTH } from './sidebarConstants';

/** A small floating handle that sits right on the border between the sidebar and the main
 * content — rather than a button living inside either one — so it reads as controlling the
 * boundary itself. Fixed positioning + vertical centering keeps it reachable at any scroll
 * position; its `left` tracks the sidebar's current width so it always sits on the seam. */
export default function SidebarToggleHandle() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((state) => state.ui.sidebarOpen);

  return (
    <Tooltip title={open ? 'Collapse sidebar' : 'Expand sidebar'} placement="right">
      <IconButton
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
        onClick={() => dispatch(toggleSidebar())}
        size="small"
        sx={{
          position: 'fixed',
          top: '50%',
          left: `${(open ? DRAWER_WIDTH : COLLAPSED_WIDTH) - 14}px`,
          transform: 'translateY(-50%)',
          zIndex: (t) => t.zIndex.drawer + 2,
          width: 28,
          height: 28,
          bgcolor: 'background.paper',
          color: 'text.secondary',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 2,
          transition: (t) => t.transitions.create('left', { duration: t.transitions.duration.short }),
          '&:hover': { bgcolor: 'background.paper', color: 'primary.main' },
        }}
      >
        {open ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
