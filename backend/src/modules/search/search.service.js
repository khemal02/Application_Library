const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');

async function globalSearch(q, limit = 8) {
  if (!q || !q.trim()) {
    return {
      applications: [], ideas: [], featureRequests: [],
    };
  }

  const query = `
    SELECT id, name AS title, 'application' AS entity_type, ts_rank(search_vector, plainto_tsquery('english', :q)) AS rank
    FROM applications WHERE search_vector @@ plainto_tsquery('english', :q)
    ORDER BY rank DESC LIMIT :limit
  `;
  const ideaQuery = `
    SELECT id, title, 'idea' AS entity_type, ts_rank(search_vector, plainto_tsquery('english', :q)) AS rank
    FROM ideas WHERE search_vector @@ plainto_tsquery('english', :q)
    ORDER BY rank DESC LIMIT :limit
  `;
  // Split out of the idea query above — see 20260130000035-split-feature-requests-from-ideas.js.
  const featureRequestQuery = `
    SELECT id, title, 'feature_request' AS entity_type, ts_rank(search_vector, plainto_tsquery('english', :q)) AS rank
    FROM feature_requests WHERE search_vector @@ plainto_tsquery('english', :q)
    ORDER BY rank DESC LIMIT :limit
  `;

  const replacements = { q, limit };
  const [applications, ideas, featureRequests] = await Promise.all([
    sequelize.query(query, { replacements, type: QueryTypes.SELECT }),
    sequelize.query(ideaQuery, { replacements, type: QueryTypes.SELECT }),
    sequelize.query(featureRequestQuery, { replacements, type: QueryTypes.SELECT }),
  ]);

  return {
    applications, ideas, featureRequests,
  };
}

module.exports = { globalSearch };
