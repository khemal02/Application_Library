const { Op } = require('sequelize');
const { Application, Idea, ApplicationSuggestion, AuditLog, User } = require('../../models');

async function getSummary() {
  const [
    totalApplications, inProgressApplications, completedApplications,
    pendingIdeas, approvedIdeas, pendingReviewIdeas,
    openSuggestions, technicalReviewSuggestions,
    recentApplications, recentActivity,
  ] = await Promise.all([
    Application.count(),
    Application.count({ where: { status: { [Op.in]: ['development', 'testing'] } } }),
    Application.count({ where: { status: 'deployment' } }),
    Idea.count({ where: { status: 'submitted' } }),
    Idea.count({ where: { status: 'approved' } }),
    Idea.count({ where: { status: { [Op.in]: ['discussion', 'review'] } } }),
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
      pendingReviews: pendingReviewIdeas + technicalReviewSuggestions,
      pendingIdeas,
      approvedIdeas,
      openImprovements: openSuggestions,
    },
    recentApplications,
    recentActivity,
  };
}

module.exports = { getSummary };
