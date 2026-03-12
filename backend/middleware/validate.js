/**
 * Validation middleware helpers
 */

function validateRequired(fields) {
  return (req, res, next) => {
    const missing = [];
    for (const field of fields) {
      const value = req.body[field];
      if (value === undefined || value === null || value === '') {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        fields: missing,
      });
    }
    next();
  };
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePositiveNumber(value) {
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0;
}

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.trim();
}

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    }
  }
  next();
}

module.exports = {
  validateRequired,
  validateEmail,
  validatePositiveNumber,
  sanitizeString,
  sanitizeBody,
};
