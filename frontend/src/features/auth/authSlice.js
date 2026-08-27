import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../../services/domains';

export const login = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const res = await authApi.login(email, password);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const fetchMe = createAsyncThunk('auth/fetchMe', async (_, { rejectWithValue }) => {
  try {
    const res = await authApi.me();
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load profile');
  }
});

const initialState = {
  token: localStorage.getItem('aams_token') || null,
  user: null,
  status: 'idle',
  error: null,
  bootstrapped: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.token = null;
      state.user = null;
      localStorage.removeItem('aams_token');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.bootstrapped = true;
        localStorage.setItem('aams_token', action.payload.token);
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.bootstrapped = true;
      })
      .addCase(fetchMe.rejected, (state) => {
        state.token = null;
        state.user = null;
        state.bootstrapped = true;
        localStorage.removeItem('aams_token');
      });
  },
});

export const { logout } = authSlice.actions;

export const selectPermissions = (state) => state.auth.user?.role?.permissions || [];
export const selectHasPermission = (state, resource, action) => selectPermissions(state).some(
  (p) => (p.resource === resource || p.resource === '*') && (p.action === action || p.action === 'manage'),
);

export default authSlice.reducer;
