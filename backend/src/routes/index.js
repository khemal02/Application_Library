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
router.use('/applications/:applicationId/tech-stack', require('../modules/techStack/techStack.routes'));
router.use('/applications/:applicationId/features', require('../modules/features/features.routes'));
router.use('/applications/:applicationId/ai-prompts', require('../modules/aiPrompts/aiPrompts.routes'));
router.use('/applications/:applicationId/architecture-docs', require('../modules/architectureDocs/architectureDocs.routes'));
router.use('/applications/:applicationId/api-docs', require('../modules/apiDocs/apiDocs.routes'));
router.use('/applications/:applicationId/db-docs', require('../modules/dbDocs/dbDocs.routes'));
router.use('/applications/:applicationId/releases', require('../modules/releases/releases.routes'));
router.use('/applications/:applicationId/bugs', require('../modules/bugs/bugs.routes'));
router.use('/applications/:applicationId/known-issues', require('../modules/knownIssues/knownIssues.routes'));
router.use('/applications/:applicationId/roadmap', require('../modules/roadmap/roadmap.routes'));
router.use('/applications/:applicationId/timeline', require('../modules/timeline/timeline.routes'));
router.use('/applications/:applicationId/change-requests', require('../modules/changeRequests/changeRequests.routes'));

// Module 2: New Application Ideas
router.use('/ideas', require('../modules/ideas/ideas.routes'));

// Module 3: Existing Application Review & Improvement
router.use('/suggestions', require('../modules/suggestions/suggestions.routes'));

// Also expose application-scoped sub-resources for suggestions filed against a specific app
router.use('/applications/:applicationId/suggestions', (req, res, next) => {
  req.query.applicationId = req.params.applicationId;
  next();
}, require('../modules/suggestions/suggestions.routes'));

module.exports = router;
