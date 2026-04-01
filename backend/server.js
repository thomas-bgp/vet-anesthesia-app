require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { getSupabase, ensurePermanentAdmin } = require('./db/database');
const { sanitizeBody } = require('./middleware/validate');

// Route imports
const authRoutes = require('./routes/auth');
const referralRoutes = require('./routes/referral');
const medicinesRoutes = require('./routes/medicines');
const stockRoutes = require('./routes/stock');
const surgeriesRoutes = require('./routes/surgeries');
const dashboardRoutes = require('./routes/dashboard');
const reportsRoutes = require('./routes/reports');
const priceTableRoutes = require('./routes/pricetable');
const bottlesRoutes = require('./routes/bottles');
const receivablesRoutes = require('./routes/receivables');
const expensesRoutes = require('./routes/expenses');
const controladoriaRoutes = require('./routes/controladoria');
const signatureRoutes = require('./routes/signature');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (nginx reverse proxy in front)
app.set('trust proxy', 1);

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://localhost:5174')
  .split(',')
  .map(s => s.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, same-origin via proxy)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

app.use(globalLimiter);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Sanitize inputs ──────────────────────────────────────────────────────────
app.use(sanitizeBody);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('users').select('id').limit(1);
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: error ? 'error' : 'connected',
      version: require('./package.json').version,
    });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/medicines', medicinesRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/surgeries', surgeriesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/price-table', priceTableRoutes);
app.use('/api/bottles', bottlesRoutes);
app.use('/api/receivables', receivablesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/controladoria', controladoriaRoutes);
app.use('/api/signatures', signatureRoutes);

// ─── API Info ─────────────────────────────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    name: 'Anestify API',
    version: require('./package.json').version,
    endpoints: {
      auth: '/api/auth',
      referrals: '/api/referrals',
      medicines: '/api/medicines',
      stock: '/api/stock',
      surgeries: '/api/surgeries',
      dashboard: '/api/dashboard',
    },
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
async function startServer() {
  try {
    // Initialize Supabase client and ensure admin exists
    getSupabase();
    await ensurePermanentAdmin();
    console.log('Database initialized successfully (Supabase)');

    app.listen(PORT, () => {
      console.log(`\nAnestify API running on http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/health`);
      console.log(`   API info:     http://localhost:${PORT}/api`);
      console.log(`   Environment:  ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

startServer();

module.exports = app;
