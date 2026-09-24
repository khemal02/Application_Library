import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  sidebarOpen: true,
  // Maps a URL path -> human-readable label, so the breadcrumb can show "Internal AI code
  // review assistant" instead of a raw UUID for detail pages it has no other way to name.
  entityLabels: {},
  // The current top-level list page's own title + one-line subtitle — rendered in the Topbar
  // itself now (see usePageMeta), not inside each page's own body, per the approved reference.
  // Empty on a detail page (its crumb pill carries the full trail instead — see Breadcrumb.jsx).
  pageMeta: { title: '', subtitle: '' },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setEntityLabel(state, action) {
      const { path, label } = action.payload;
      state.entityLabels[path] = label;
    },
    setPageMeta(state, action) {
      state.pageMeta = action.payload;
    },
  },
});

export const { toggleSidebar, setEntityLabel, setPageMeta } = uiSlice.actions;
export default uiSlice.reducer;
