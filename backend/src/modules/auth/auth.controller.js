const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const authService = require('./auth.service');

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, req);
  return ApiResponse.success(res, result, 'Login successful');
});

const logout = asyncHandler(async (req, res) => {
  const result = await authService.logout(req.user.id, req.user.jti);
  return ApiResponse.success(res, result, 'Logged out');
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.user.id);
  return ApiResponse.success(res, user);
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user.id, req.body);
  return ApiResponse.success(res, result, 'Password updated');
});

module.exports = { login, logout, me, changePassword };
