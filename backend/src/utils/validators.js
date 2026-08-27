const Joi = require('joi');

/**
 * Shared password policy: 10-72 chars (72 is bcrypt's real input limit — longer inputs are
 * silently truncated by bcrypt, which is worth capping explicitly rather than discovering later),
 * at least one letter and one number. Used by both login-adjacent (change-password) and user
 * management (create) validators so the policy only lives in one place.
 */
const passwordSchema = Joi.string()
  .min(10)
  .max(72)
  .pattern(/[A-Za-z]/, 'letter')
  .pattern(/[0-9]/, 'number')
  .messages({
    'string.min': 'Password must be at least 10 characters long',
    'string.max': 'Password must be at most 72 characters long',
    'string.pattern.name': 'Password must contain at least one letter and one number',
  });

/**
 * Stricter policy for the self-service "Change Password" action specifically (Profile & Settings
 * > Security) — uppercase + lowercase + number + special character, matching the strength
 * indicator shown there. Kept separate from `passwordSchema` (used by admin user creation/reset)
 * so tightening this doesn't change the policy for accounts an admin provisions elsewhere.
 */
const strongPasswordSchema = Joi.string()
  .min(10)
  .max(72)
  .pattern(/[a-z]/, 'lowercase')
  .pattern(/[A-Z]/, 'uppercase')
  .pattern(/[0-9]/, 'number')
  .pattern(/[^A-Za-z0-9]/, 'special character')
  .messages({
    'string.min': 'Password must be at least 10 characters long',
    'string.max': 'Password must be at most 72 characters long',
    'string.pattern.name': 'Password must contain at least one {#name}',
  });

/**
 * Shared enum option lists for the "Industry" / "Functional Area" fields used on both Ideas and
 * Applications, so the two modules can't silently drift apart on what values are valid.
 */
const INDUSTRIES = [
  'technology', 'financial_services', 'healthcare', 'retail', 'manufacturing', 'public_sector',
  'energy_utilities', 'consumer_products', 'life_sciences', 'telecommunications', 'other',
];
const FUNCTIONAL_AREAS = [
  'finance', 'procurement', 'sales_distribution', 'supply_chain', 'human_resources',
  'manufacturing_production', 'quality_management', 'plant_maintenance', 'project_systems',
  'customer_service', 'information_technology', 'analytics_reporting', 'other',
];

module.exports = {
  passwordSchema, strongPasswordSchema, INDUSTRIES, FUNCTIONAL_AREAS,
};
