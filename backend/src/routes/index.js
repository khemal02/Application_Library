const express = require('express');

const router = express.Router();

// Auth & common
router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/profile', require('../modules/profile/profile.routes'));
router.use('/users', require('../modules/users/users.routes'));
router.use('/roles', require('../modules/roles/roles.routes'));
router.use('/departments', require('../modules/departments/departments.routes'));
router.use('/notifications', require('../modules/notifications/notifications.routes'));
router.use('/audit-logs', require('../modules/auditLogs/auditLogs.routes'));
router.use('/dashboard', require('../modules/dashboard/dashboard.routes'));
router.use('/search', require('../modules/search/search.routes'));
router.use('/comments', require('../modules/comments/comments.routes'));
router.use('/votes', require('../modules/votes/votes.routes'));
router.use('/tags', require('../modules/tags/tags.routes'));
router.use('/attachments', require('../modules/attachments/attachments.routes'));

// Module 1: Application Tracking & Documentation
router.use('/applications', require('../modules/applications/applications.routes'));
router.use('/applications/:applicationId/issues', require('../modules/issues/issues.routes'));
router.use('/applications/:applicationId/change-requests', require('../modules/changeRequests/changeRequests.routes'));
// Top-level, cross-application — backs the Dashboard's "My Development"/"My Testing"/
// "My Deployment" tiles. Not nested under /applications/:applicationId/ like the line above;
// see changeRequests/myStages.routes.js for why it can't be.
router.use('/change-requests/my-stages', require('../modules/changeRequests/myStages.routes'));

// Application Tracking — a track is an approved idea being built (Scoping/Development/Testing/
// Deployment), sitting between "idea approved" and "Application registered". Top-level, not
// nested under an application — a track precedes one, same reasoning as change-requests/my-stages
// just above.
router.use('/application-tracking', require('../modules/applicationTracking/applicationTracking.routes'));

// Module 2: New Application Ideas
router.use('/ideas', require('../modules/ideas/ideas.routes'));
// Module 2b: Modify Current Application (feature requests) — split out from Ideas into its own
// table/module/RBAC resource; see 20260130000035-split-feature-requests-from-ideas.js.
router.use('/feature-requests', require('../modules/featureRequests/featureRequests.routes'));

// Module 3: Existing Application Review & Improvement
router.use('/suggestions', require('../modules/suggestions/suggestions.routes'));

// Also expose application-scoped sub-resources for suggestions filed against a specific app
router.use('/applications/:applicationId/suggestions', (req, res, next) => {
  req.query.applicationId = req.params.applicationId;
  next();
}, require('../modules/suggestions/suggestions.routes'));

module.exports = router;
