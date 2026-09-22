import { useId, useState } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/**
 * A +/- accordion section — built from scratch (not MUI's <Accordion>) per spec: a two-bar CSS
 * plus/minus mark instead of a rotating chevron icon, and a `grid-template-rows: 0fr -> 1fr`
 * open/close animation instead of a max-height hack (the latter breaks once content is longer than
 * whatever height was guessed). Sections are fully independent — each instance owns its own `open`
 * state, so any number can be open at once.
 *
 * Wrapped in a real `<Paper variant="outlined">` (not a hand-rolled border) specifically so the
 * border color/radius/shadow are the exact same theme-driven values every other outlined card
 * already uses (see theme.js's MuiPaper `outlined`/`rounded` overrides) — nothing shifts.
 *
 * Shared across every page that shows the same Problem Statement/Solution/Technologies fields —
 * originally built for IdeaDetailPage.jsx, then reused as-is (not forked) by
 * ApplicationTrackingDetailPage.jsx and ApplicationStagesPage.jsx's own read-only copies of the
 * same three sections.
 */
export default function AccordionSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <Paper variant="outlined" sx={{ mb: 1.5, overflow: 'hidden' }}>
      <Box
        component="button"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          m: 0,
          px: 2,
          py: 1.5,
          bgcolor: 'transparent',
          border: 0,
          borderRadius: 0,
          font: 'inherit',
          color: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: -2,
          },
        }}
      >
        {/* component="span" — headings/paragraphs aren't valid <button> content; subtitle2's own
            type styling is unaffected by which tag renders it. */}
        <Typography variant="subtitle2" component="span" fontWeight={700}>{title}</Typography>

        {/* The +/- mark: a horizontal bar that never moves, plus a vertical bar that rotates 90deg
            and fades out on open — two bars forming a "+", the vertical one disappearing to leave
            just the "-". aria-hidden since aria-expanded on the button already conveys state. */}
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            position: 'relative',
            width: 14,
            height: 14,
            flex: '0 0 auto',
          }}
        >
          <Box
            component="span"
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '100%',
              height: '2px',
              bgcolor: 'text.secondary',
              transform: 'translate(-50%, -50%)',
            }}
          />
          <Box
            component="span"
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '2px',
              height: '100%',
              bgcolor: 'text.secondary',
              transform: `translate(-50%, -50%) rotate(${open ? 90 : 0}deg)`,
              opacity: open ? 0 : 1,
              transition: 'transform 0.25s ease, opacity 0.25s ease',
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          />
        </Box>
      </Box>

      {/* grid-template-rows 0fr/1fr, not max-height — this animates correctly for content of any
          length, including a Problem Statement long enough that a guessed max-height would clip
          (or leave a jump) it. The inner div's overflow:hidden is what actually clips the content
          during the transition; the outer grid row is what's actually animating. */}
      <Box
        id={panelId}
        sx={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.25s ease',
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        }}
      >
        <Box sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: 2, pt: 1, pb: 2 }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
