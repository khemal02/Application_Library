import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  sidebarOpen: true,
  // The current top-level list page's own title + one-line subtitle — rendered in the Topbar
  // itself now (see usePageMeta), not inside each page's own body, per the approved reference.
  // Empty on a detail page (its crumb pill just shows the module's own short label — see
  // Breadcrumb.jsx).
  pageMeta: { title: '', subtitle: '' },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setPageMeta(state, action) {
      state.pageMeta = action.payload;
    },
  },
});

export const { toggleSidebar, setPageMeta } = uiSlice.actions;
export default uiSlice.reducer;
