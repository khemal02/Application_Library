const { Op } = require('sequelize');
const {
  Application, Idea, FeatureRequest, ApplicationSuggestion, AuditLog, User,
} = require('../../models');

async function getSummary() {
  const [
    totalApplications, inProgressApplications, completedApplications,
    pendingIdeas, approvedIdeas,
    pendingFeatureRequests, approvedFeatureRequests,
    openSuggestions, technicalReviewSuggestions,
    recentApplications, recentActivity,
  ] = await Promise.all([
    Application.count(),
    Application.count({ where: { status: { [Op.in]: ['development', 'testing'] } } }),
    Application.count({ where: { status: 'deployment' } }),
    // Split out of Ideas' formerly-shared counters — see 20260130000035-split-feature-requests-
    // from-ideas.js. 'under_review' is the live awaiting-decision status; 'submitted' (used here
    // pre-split) is retired and no live row ever holds it.
    Idea.count({ where: { status: 'under_review' } }),
    Idea.count({ where: { status: 'approved' } }),
    FeatureRequest.count({ where: { status: 'under_review' } }),
    FeatureRequest.count({ where: { status: 'approved' } }),
    ApplicationSuggestion.count({ where: { status: { [Op.notIn]: ['closed', 'implemented'] } } }),
    ApplicationSuggestion.count({ where: { status: 'technical_review' } }),
    Application.findAll({ order: [['updatedAt', 'DESC']], limit: 5 }),
    AuditLog.findAll({
      order: [['createdAt', 'DESC']], limit: 10,
      include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
    }),
  ]);

  return {
    stats: {
      totalApplications,
      applicationsInProgress: inProgressApplications,
      completedApplications,
      // The old idea-review sub-status this also summed ('discussion'/'review') is retired — the
      // review chain (Team Lead/Manager/Reviewer-3) all runs while an idea stays 'under_review',
      // so there's no separate "in review" idea count distinct from pendingIdeas anymore.
      pendingReviews: technicalReviewSuggestions,
      pendingIdeas,
      approvedIdeas,
      pendingFeatureRequests,
      approvedFeatureRequests,
      openImprovements: openSuggestions,
    },
    recentApplications,
    recentActivity,
  };
}

module.exports = { getSummary };
