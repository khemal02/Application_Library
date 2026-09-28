const { Op } = require('sequelize');
const { Application, Idea, FeatureRequest } = require('../../models');
const ideasService = require('../ideas/ideas.service');
const featureRequestsService = require('../featureRequests/featureRequests.service');
const changeRequestsService = require('../changeRequests/changeRequests.service');
const applicationTrackingService = require('../applicationTracking/applicationTracking.service');

async function getSummary(userId) {
  const [
    totalApplications, myApplications, inProgressApplications, completedApplications,
    pendingIdeas, approvedIdeas,
    pendingFeatureRequests, approvedFeatureRequests,
    myIdeaCounts, myFeatureRequestCounts, myChangeRequestStageCounts, myTrackStageCounts,
  ] = await Promise.all([
    Application.count(),
    Application.count({ where: { ownerId: userId } }),
    Application.count({ where: { status: { [Op.in]: ['development', 'testing'] } } }),
    Application.count({ where: { status: 'deployment' } }),
    // Split out of Ideas' formerly-shared counters — see 20260130000035-split-feature-requests-
    // from-ideas.js. 'under_review' is the live awaiting-decision status; 'submitted' (used here
    // pre-split) is retired and no live row ever holds it.
    Idea.count({ where: { status: 'under_review' } }),
    Idea.count({ where: { status: 'approved' } }),
    FeatureRequest.count({ where: { status: 'under_review' } }),
    FeatureRequest.count({ where: { status: 'approved' } }),
    // "My Review" / "My Approve" — the caller's own open panel rows across Ideas and Feature
    // Requests, split by kind (see ideas.service.js#myPendingCounts). Personalized, so this is the
    // one part of the summary that depends on who's asking.
    ideasService.myPendingCounts(userId),
    featureRequestsService.myPendingCounts(userId),
    // "My Development" / "My Testing" / "My Deployment" — stages assigned to the caller across
    // every application, still waiting on their action. Two sources, both counted: a feature
    // request's own change request (changeRequests.service.js#myStageCounts) AND an approved
    // idea's own track (applicationTracking.service.js#myStageCounts) — a tile's number used to
    // only ever count the former, silently missing every idea-sourced assignment.
    changeRequestsService.myStageCounts(userId),
    applicationTrackingService.myStageCounts(userId),
  ]);
  const myStageCounts = {
    development: myChangeRequestStageCounts.development + myTrackStageCounts.development,
    testing: myChangeRequestStageCounts.testing + myTrackStageCounts.testing,
    deployment: myChangeRequestStageCounts.deployment + myTrackStageCounts.deployment,
  };

  return {
    stats: {
      totalApplications,
      myApplications,
      applicationsInProgress: inProgressApplications,
      completedApplications,
      pendingIdeas,
      approvedIdeas,
      pendingFeatureRequests,
      approvedFeatureRequests,
      // Kept separate per module (not summed) — the Dashboard links each to its own list
      // (Ideas vs Feature Requests), not a combined view, so the count shown on each tile must
      // match exactly what that tile's own click-through will show.
      myReviewIdeas: myIdeaCounts.reviewer,
      myReviewFeatureRequests: myFeatureRequestCounts.reviewer,
      myApproveIdeas: myIdeaCounts.approver,
      myApproveFeatureRequests: myFeatureRequestCounts.approver,
      myDevelopmentStages: myStageCounts.development,
      myTestingStages: myStageCounts.testing,
      myDeploymentStages: myStageCounts.deployment,
    },
  };
}

module.exports = { getSummary };
