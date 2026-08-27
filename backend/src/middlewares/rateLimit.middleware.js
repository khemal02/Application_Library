const rateLimit = require('express-rate-limit');

const jsonMessage = (message) => ({ success: false, message });

/** Tight limiter for the login endpoint — brute-force credential guessing. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Too many login attempts, please try again later'),
});

/** Tight limiter for account-sensitive actions (password change). */
const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Too many attempts, please try again later'),
});

/**
 * General-purpose limiter applied to every mutating API request (POST/PUT/PATCH/DELETE), so
 * comment/idea/suggestion spam or scripted abuse isn't limited to just the login route.
 * Generous enough not to bother real usage; GET requests are exempt.
 */
const apiWriteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
  message: jsonMessage('Too many requests, please slow down'),
});

module.exports = { loginLimiter, sensitiveActionLimiter, apiWriteLimiter };
