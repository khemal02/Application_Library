/**
 * For nested routes like /applications/:applicationId/tech-stack, injects the parent id into
 * both the query (so crudFactory's filterableFields picks it up on list) and the body (so
 * create/update persist the FK) without every sub-resource module re-implementing the same glue.
 */
function scopeToParent(paramName, field = 'applicationId') {
  return (req, res, next) => {
    const value = req.params[paramName];
    req.query[field] = value;
    if (req.body && typeof req.body === 'object') req.body[field] = value;
    next();
  };
}

module.exports = scopeToParent;
