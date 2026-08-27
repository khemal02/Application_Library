import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import uiReducer from '../features/ui/uiSlice';
import notificationsReducer from '../features/notifications/notificationsSlice';
import toastReducer from '../features/toast/toastSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    notifications: notificationsReducer,
    toast: toastReducer,
  },
});
