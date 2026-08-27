import { createSlice } from '@reduxjs/toolkit';

const initialState = { open: false, message: '', severity: 'success', key: 0 };

const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    showToast: (state, action) => {
      state.open = true;
      state.message = action.payload.message;
      state.severity = action.payload.severity || 'success';
      // Bumped on every show so a new toast re-triggers the Snackbar's auto-hide timer even if
      // one was already open (MUI Snackbar keys off this to remount rather than just updating).
      state.key += 1;
    },
    hideToast: (state) => {
      state.open = false;
    },
  },
});

export const { showToast, hideToast } = toastSlice.actions;
export default toastSlice.reducer;
