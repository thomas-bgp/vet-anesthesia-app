const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Erros que derrubam uma tela no frontend (errorElement do React Router) caem no log do container,
// pra não depender de print do usuário. Público porque o erro pode acontecer antes do login.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const clip = (value, max) => (typeof value === 'string' ? value.slice(0, max) : null);

router.post('/', limiter, (req, res) => {
  const body = req.body || {};
  console.error('[client-error]', JSON.stringify({
    message: clip(body.message, 500),
    stack: clip(body.stack, 4000),
    url: clip(body.url, 300),
    userAgent: clip(body.userAgent, 300),
    userId: Number.isInteger(body.userId) ? body.userId : null,
    lang: clip(body.lang, 20),
    translated: body.translated === true,
    at: new Date().toISOString(),
  }));
  res.status(204).end();
});

module.exports = router;
