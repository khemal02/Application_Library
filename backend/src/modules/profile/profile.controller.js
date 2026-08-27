const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const service = require('./profile.service');

const getProfile = asyncHandler(async (req, res) => {
  const profile = await service.getProfile(req.user.id);
  return ApiResponse.success(res, profile);
});

const updateProfile = asyncHandler(async (req, res) => {
  const profile = await service.updateProfile(req.user.id, req.body);
  return ApiResponse.success(res, profile, 'Profile updated');
});

const getAccount = asyncHandler(async (req, res) => {
  const account = await service.getAccount(req.user.id);
  return ApiResponse.success(res, account);
});

const getPrivacy = asyncHandler(async (req, res) => {
  const privacy = await service.getPrivacy(req.user.id);
  return ApiResponse.success(res, privacy);
});

const updatePrivacy = asyncHandler(async (req, res) => {
  const privacy = await service.updatePrivacy(req.user.id, req.body);
  return ApiResponse.success(res, privacy, 'Privacy settings updated');
});

const listSessions = asyncHandler(async (req, res) => {
  const sessions = await service.listSessions(req.user.id, req.user.jti);
  return ApiResponse.success(res, sessions);
});

const revokeSession = asyncHandler(async (req, res) => {
  const result = await service.revokeSession(req.user.id, req.params.id, req.user.jti);
  return ApiResponse.success(res, result, 'Session logged out');
});

const revokeOtherSessions = asyncHandler(async (req, res) => {
  const result = await service.revokeOtherSessions(req.user.id, req.user.jti);
  return ApiResponse.success(res, result, 'All other sessions logged out');
});

const getActivity = asyncHandler(async (req, res) => {
  const { items, pagination } = await service.getActivity(req.user.id, req.query);
  return ApiResponse.paginated(res, items, pagination);
});

module.exports = {
  getProfile, updateProfile, getAccount, getPrivacy, updatePrivacy,
  listSessions, revokeSession, revokeOtherSessions, getActivity,
};
