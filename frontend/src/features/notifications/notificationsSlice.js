import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { notificationsApi } from '../../services/domains';

export const fetchUnreadCount = createAsyncThunk('notifications/unreadCount', async () => {
  const res = await notificationsApi.unreadCount();
  return res.data.count;
});

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: { unreadCount: 0 },
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchUnreadCount.fulfilled, (state, action) => {
      state.unreadCount = action.payload;
    });
  },
});

export default notificationsSlice.reducer;
