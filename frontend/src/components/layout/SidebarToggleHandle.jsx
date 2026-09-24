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
          left: `${(open ? DRAWER_WIDTH : COLLAPSED_WIDTH) - 15}px`,
          transform: 'translateY(-50%)',
          zIndex: (t) => t.zIndex.drawer + 2,
          width: 30,
          height: 30,
          // SAR India Digital reference (sampled directly from its screenshot): the handle isn't a
          // solid blue circle with a white ring — it's a muted navy fill (between the sidebar's own
          // navy and the bright accent blue) with a thin bright-blue ring, so it reads as part of
          // the sidebar's own surface rather than a floating chip.
          bgcolor: '#163565',
          color: '#fff',
          border: '2px solid',
          borderColor: 'primary.light',
          transition: (t) => t.transitions.create('left', { duration: t.transitions.duration.short }),
          '&:hover': { bgcolor: '#1c4179' },
        }}
      >
        {open ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
