import { createTheme, alpha } from '@mui/material/styles';

/**
 * One shared enterprise design system for the whole app. Every page already builds on MUI's
 * Paper/Button/Chip/Table/Tabs/AppBar/Drawer primitives, so refining them here restyles every
 * module (dashboard, applications, ideas, suggestions, admin) consistently without touching any
 * page's markup or logic.
 */
export function getTheme(mode) {
  const isDark = mode === 'dark';

  const neutral = {
    50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
    400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
    800: '#1e293b', 900: '#0f172a',
  };

  const theme = createTheme({
    palette: {
      mode,
      primary: { main: '#4f46e5', light: '#818cf8', dark: '#3730a3', contrastText: '#fff' },
      secondary: { main: '#0ea5e9', light: '#38bdf8', dark: '#0369a1', contrastText: '#fff' },
      success: { main: '#059669' },
      warning: { main: '#d97706' },
      error: { main: '#dc2626' },
      info: { main: '#2563eb' },
      divider: isDark ? alpha('#e2e8f0', 0.09) : neutral[200],
      // Page background and card/Paper background were both pure white in light mode, so cards
      // had no visible separation from the page behind them. Paper stays white; the page itself
      // gets a light neutral gray so bordered/shadowed boxes actually read as boxes.
      background: isDark
        ? { default: '#0b0d13', paper: '#12151d' }
        : { default: neutral[100], paper: '#ffffff' },
      text: isDark
        ? { primary: '#e5e7eb', secondary: alpha('#e5e7eb', 0.62) }
        : { primary: neutral[900], secondary: neutral[600] },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: ['Inter', 'Roboto', 'Segoe UI', 'sans-serif'].join(','),
      h4: { fontWeight: 800, letterSpacing: -0.5 },
      h5: { fontWeight: 700, letterSpacing: -0.3 },
      h6: { fontWeight: 700 },
      subtitle1: { fontWeight: 700 },
      subtitle2: { fontWeight: 700 },
      button: { fontWeight: 600 },
    },
    shadows: Array(25).fill('none').map((_, i) => {
      if (i === 0) return 'none';
      // A softer, bluer shadow scale than MUI's default charcoal shadows — reads as "premium
      // SaaS card" rather than "material design elevation."
      const y = Math.min(1 + i, 24);
      const blur = Math.min(2 + i * 2, 48);
      const alphaVal = isDark ? 0.35 : 0.08;
      return `0 ${y}px ${blur}px ${alpha('#1e293b', alphaVal)}`;
    }),
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // Reserves the vertical scrollbar's width permanently, whether or not the page is
          // currently tall enough to need it. Without this, a page that fits in the viewport at
          // low content and overflows at high content (e.g. 10 vs 40 rows-per-page) gains/loses a
          // ~15-17px scrollbar and every fixed-width flex row on the page reflows around that —
          // which is why a filter bar sitting right at its wrap threshold would wrap only once
          // enough rows appear to trigger scrolling, with nothing about the filters themselves
          // having changed.
          html: { scrollbarGutter: 'stable' },
          body: { scrollbarColor: `${neutral[isDark ? 700 : 300]} transparent` },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          // Dialog content scrolls in its own box (separate from <body>), so it needs its own
          // visible scrollbar — otherwise a dialog with more fields than fit the viewport looks
          // like it simply ends, hiding whatever content is below the fold.
          root: { scrollbarColor: `${neutral[isDark ? 600 : 400]} transparent`, scrollbarWidth: 'thin' },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: {
            borderColor: isDark ? alpha('#e2e8f0', 0.1) : neutral[200],
            boxShadow: isDark ? 'none' : `0 1px 2px ${alpha('#1e293b', 0.04)}, 0 1px 3px ${alpha('#1e293b', 0.05)}`,
          },
          rounded: { borderRadius: 12 },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: `1px solid ${isDark ? alpha('#e2e8f0', 0.1) : neutral[200]}`,
            boxShadow: isDark ? 'none' : `0 1px 2px ${alpha('#1e293b', 0.04)}, 0 1px 3px ${alpha('#1e293b', 0.05)}`,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, borderRadius: 8, paddingInline: 16 },
          containedPrimary: {
            boxShadow: `0 1px 2px ${alpha('#3730a3', 0.24)}`,
            '&:hover': { boxShadow: `0 4px 12px ${alpha('#3730a3', 0.32)}` },
          },
          outlined: { borderColor: isDark ? alpha('#e2e8f0', 0.18) : neutral[300] },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, borderRadius: 6 },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: isDark
              ? `0 1px 0 ${alpha('#e2e8f0', 0.08)}`
              : `0 1px 0 ${neutral[200]}, 0 4px 12px ${alpha('#1e293b', 0.03)}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { borderRight: `1px solid ${isDark ? alpha('#e2e8f0', 0.08) : neutral[200]}`, backgroundImage: 'none' },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            fontSize: '0.72rem',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: isDark ? alpha('#e5e7eb', 0.55) : neutral[500],
            backgroundColor: isDark ? alpha('#e2e8f0', 0.03) : neutral[50],
            borderBottomColor: isDark ? alpha('#e2e8f0', 0.09) : neutral[200],
          },
          root: {
            borderBottomColor: isDark ? alpha('#e2e8f0', 0.07) : neutral[100],
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:last-of-type td': { borderBottom: 'none' },
          },
        },
      },
      MuiTablePagination: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? alpha('#e2e8f0', 0.03) : neutral[50],
            borderTop: `1px solid ${isDark ? alpha('#e2e8f0', 0.09) : neutral[200]}`,
          },
          toolbar: {
            minHeight: 40,
            paddingTop: 2,
            paddingBottom: 2,
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { height: 3, borderRadius: 3 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, minHeight: 48 },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            marginInline: 8,
            width: 'auto',
            '&.Mui-selected': {
              backgroundColor: alpha('#4f46e5', isDark ? 0.18 : 0.1),
              '&:hover': { backgroundColor: alpha('#4f46e5', isDark ? 0.24 : 0.14) },
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontSize: '0.7rem', fontWeight: 600 },
        },
      },
    },
  });

  return theme;
}
