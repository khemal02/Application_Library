import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  themeMode: localStorage.getItem('aams_theme') || 'light',
  sidebarOpen: true,
  // Maps a URL path -> human-readable label, so the breadcrumb can show "Internal AI code
  // review assistant" instead of a raw UUID for detail pages it has no other way to name.
  entityLabels: {},
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleThemeMode(state) {
      state.themeMode = state.themeMode === 'light' ? 'dark' : 'light';
      localStorage.setItem('aams_theme', state.themeMode);
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setEntityLabel(state, action) {
      const { path, label } = action.payload;
      state.entityLabels[path] = label;
    },
  },
});

export const { toggleThemeMode, toggleSidebar, setEntityLabel } = uiSlice.actions;
export default uiSlice.reducer;
