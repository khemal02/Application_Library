const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');

async function globalSearch(q, limit = 8) {
  if (!q || !q.trim()) {
    return {
      applications: [], ideas: [], featureRequests: [], suggestions: [], aiPrompts: [],
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
  const suggestionQuery = `
    SELECT id, title, 'suggestion' AS entity_type, ts_rank(search_vector, plainto_tsquery('english', :q)) AS rank
    FROM application_suggestions WHERE search_vector @@ plainto_tsquery('english', :q)
    ORDER BY rank DESC LIMIT :limit
  `;
  const promptQuery = `
    SELECT id, title, 'ai_prompt' AS entity_type, ts_rank(search_vector, plainto_tsquery('english', :q)) AS rank
    FROM ai_prompts WHERE search_vector @@ plainto_tsquery('english', :q)
    ORDER BY rank DESC LIMIT :limit
  `;

  const replacements = { q, limit };
  const [applications, ideas, featureRequests, suggestions, aiPrompts] = await Promise.all([
    sequelize.query(query, { replacements, type: QueryTypes.SELECT }),
    sequelize.query(ideaQuery, { replacements, type: QueryTypes.SELECT }),
    sequelize.query(featureRequestQuery, { replacements, type: QueryTypes.SELECT }),
    sequelize.query(suggestionQuery, { replacements, type: QueryTypes.SELECT }),
    sequelize.query(promptQuery, { replacements, type: QueryTypes.SELECT }),
  ]);

  return {
    applications, ideas, featureRequests, suggestions, aiPrompts,
  };
}

module.exports = { globalSearch };
