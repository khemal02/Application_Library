const { Op } = require('sequelize');
const {
  Application, Idea, FeatureRequest, ApplicationSuggestion, AuditLog, User,
} = require('../../models');
const ideasService = require('../ideas/ideas.service');
const featureRequestsService = require('../featureRequests/featureRequests.service');

async function getSummary(userId) {
  const [
    totalApplications, inProgressApplications, completedApplications,
    pendingIdeas, approvedIdeas,
    pendingFeatureRequests, approvedFeatureRequests,
    openSuggestions, technicalReviewSuggestions,
    recentApplications, recentActivity,
    myIdeaCounts, myFeatureRequestCounts,
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
    // "My Review" / "My Approve" — the caller's own open panel rows across Ideas and Feature
    // Requests, split by kind (see ideas.service.js#myPendingCounts). Personalized, so this is the
    // one part of the summary that depends on who's asking.
    ideasService.myPendingCounts(userId),
    featureRequestsService.myPendingCounts(userId),
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
      // Kept separate per module (not summed) — the Dashboard links each to its own list
      // (Ideas vs Feature Requests), not a combined view, so the count shown on each tile must
      // match exactly what that tile's own click-through will show.
      myReviewIdeas: myIdeaCounts.reviewer,
      myReviewFeatureRequests: myFeatureRequestCounts.reviewer,
      myApproveIdeas: myIdeaCounts.approver,
      myApproveFeatureRequests: myFeatureRequestCounts.approver,
    },
    recentApplications,
    recentActivity,
  };
}

module.exports = { getSummary };
