const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/dashboard/stats - overview stats
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;

    // Surgery stats
    const surgeryStats = db
      .prepare(`
        SELECT
          COUNT(*) as total_surgeries,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_surgeries,
          SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled_surgeries,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_surgeries,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_surgeries,
          SUM(CASE WHEN status = 'completed' THEN revenue ELSE 0 END) as total_revenue,
          AVG(CASE WHEN status = 'completed' THEN revenue ELSE NULL END) as avg_revenue_per_surgery,
          AVG(CASE WHEN status = 'completed' AND duration_minutes IS NOT NULL THEN duration_minutes ELSE NULL END) as avg_duration_minutes
        FROM surgeries
        WHERE user_id = ?
      `)
      .get(userId);

    // This month stats
    const thisMonthStats = db
      .prepare(`
        SELECT
          COUNT(*) as surgeries_this_month,
          SUM(CASE WHEN status = 'completed' THEN revenue ELSE 0 END) as revenue_this_month
        FROM surgeries
        WHERE user_id = ?
          AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
      `)
      .get(userId);

    // Last month stats
    const lastMonthStats = db
      .prepare(`
        SELECT
          COUNT(*) as surgeries_last_month,
          SUM(CASE WHEN status = 'completed' THEN revenue ELSE 0 END) as revenue_last_month
        FROM surgeries
        WHERE user_id = ?
          AND strftime('%Y-%m', created_at) = strftime('%Y-%m', date('now', '-1 month'))
      `)
      .get(userId);

    // Stock stats
    const stockStats = db
      .prepare(`
        SELECT
          COUNT(*) as total_medicines,
          SUM(current_stock * cost_per_unit) as total_stock_value,
          SUM(CASE WHEN current_stock <= min_stock THEN 1 ELSE 0 END) as low_stock_count,
          SUM(CASE WHEN expiry_date <= date('now', '+30 days') AND expiry_date >= date('now') THEN 1 ELSE 0 END) as expiring_soon_count,
          SUM(CASE WHEN expiry_date < date('now') THEN 1 ELSE 0 END) as expired_count
        FROM medicines
        WHERE user_id = ? AND is_active = 1
      `)
      .get(userId);

    // Bottles expiring soon (opened, expiring within 2 days)
    const bottlesExpiring = db.prepare(`
      SELECT COUNT(*) as count
      FROM medicine_bottles
      WHERE user_id = ? AND status = 'opened'
        AND expires_at <= datetime('now', '+2 days')
        AND expires_at >= datetime('now')
    `).get(userId);

    // Opened bottles count
    const openedBottles = db.prepare(`
      SELECT COUNT(*) as count
      FROM medicine_bottles
      WHERE user_id = ? AND status = 'opened'
    `).get(userId);

    // Pending receivables total
    const pendingReceivables = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM receivables
      WHERE user_id = ? AND status = 'pending'
    `).get(userId);

    // Monthly expenses total (current month)
    const monthlyExpenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE user_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
    `).get(userId);

    // Calculate month-over-month changes
    const revenueChange = lastMonthStats.revenue_last_month > 0
      ? ((thisMonthStats.revenue_this_month - lastMonthStats.revenue_last_month) / lastMonthStats.revenue_last_month) * 100
      : null;

    const surgeriesChange = lastMonthStats.surgeries_last_month > 0
      ? ((thisMonthStats.surgeries_this_month - lastMonthStats.surgeries_last_month) / lastMonthStats.surgeries_last_month) * 100
      : null;

    res.json({
      surgeries: {
        ...surgeryStats,
        this_month: thisMonthStats.surgeries_this_month,
        last_month: thisMonthStats.surgeries_last_month,
        month_change_percent: surgeriesChange ? Math.round(surgeriesChange * 10) / 10 : null,
      },
      revenue: {
        total: surgeryStats.total_revenue || 0,
        this_month: thisMonthStats.revenue_this_month || 0,
        last_month: lastMonthStats.revenue_last_month || 0,
        avg_per_surgery: surgeryStats.avg_revenue_per_surgery || 0,
        month_change_percent: revenueChange ? Math.round(revenueChange * 10) / 10 : null,
      },
      stock: stockStats,
      bottles_expiring_soon: bottlesExpiring.count || 0,
      opened_bottles_count: openedBottles.count || 0,
      pending_receivables: pendingReceivables.total || 0,
      monthly_expenses: monthlyExpenses.total || 0,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/surgeries-by-month - monthly surgery count
router.get('/surgeries-by-month', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const months = parseInt(req.query.months) || 12;

    const data = db
      .prepare(`
        SELECT
          strftime('%Y-%m', created_at) as month,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
          SUM(CASE WHEN outcome = 'success' AND status = 'completed' THEN 1 ELSE 0 END) as successful
        FROM surgeries
        WHERE user_id = ?
          AND created_at >= date('now', '-' || ? || ' months')
        GROUP BY strftime('%Y-%m', created_at)
        ORDER BY month ASC
      `)
      .all(req.user.id, months);

    res.json({ data, months });
  } catch (err) {
    console.error('Surgeries by month error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/revenue-by-month - monthly revenue
router.get('/revenue-by-month', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const months = parseInt(req.query.months) || 12;

    const data = db
      .prepare(`
        SELECT
          strftime('%Y-%m', created_at) as month,
          SUM(CASE WHEN status = 'completed' THEN revenue ELSE 0 END) as revenue,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_surgeries,
          AVG(CASE WHEN status = 'completed' THEN revenue ELSE NULL END) as avg_revenue,
          (
            SELECT COALESCE(SUM(sm2.total_cost), 0)
            FROM stock_movements sm2
            WHERE sm2.user_id = ?
              AND sm2.type = 'usage'
              AND strftime('%Y-%m', sm2.created_at) = strftime('%Y-%m', s.created_at)
          ) as medicine_costs
        FROM surgeries s
        WHERE s.user_id = ?
          AND s.created_at >= date('now', '-' || ? || ' months')
        GROUP BY strftime('%Y-%m', s.created_at)
        ORDER BY month ASC
      `)
      .all(req.user.id, req.user.id, months);

    // Add profit calculation
    const dataWithProfit = data.map((row) => ({
      ...row,
      profit: (row.revenue || 0) - (row.medicine_costs || 0),
    }));

    res.json({ data: dataWithProfit, months });
  } catch (err) {
    console.error('Revenue by month error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/top-medicines - most used medicines
router.get('/top-medicines', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit) || 10;
    const days = parseInt(req.query.days) || 90;

    const data = db
      .prepare(`
        SELECT
          m.id,
          m.name,
          m.active_principle,
          m.unit,
          COUNT(sm.id) as usage_count,
          SUM(sm.quantity) as total_quantity_used,
          SUM(sm.total_cost) as total_cost,
          AVG(sm.quantity) as avg_dose
        FROM stock_movements sm
        JOIN medicines m ON sm.medicine_id = m.id
        WHERE sm.user_id = ?
          AND sm.type = 'usage'
          AND sm.created_at >= date('now', '-' || ? || ' days')
        GROUP BY m.id, m.name, m.active_principle, m.unit
        ORDER BY usage_count DESC
        LIMIT ?
      `)
      .all(req.user.id, days, limit);

    res.json({ data, days, limit });
  } catch (err) {
    console.error('Top medicines error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/species-distribution - surgeries by species
router.get('/species-distribution', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const days = parseInt(req.query.days) || 365;

    const data = db
      .prepare(`
        SELECT
          patient_species as species,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'completed' THEN revenue ELSE 0 END) as revenue,
          AVG(patient_weight) as avg_weight,
          AVG(duration_minutes) as avg_duration
        FROM surgeries
        WHERE user_id = ?
          AND created_at >= date('now', '-' || ? || ' days')
        GROUP BY patient_species
        ORDER BY total DESC
      `)
      .all(req.user.id, days);

    const total = data.reduce((sum, row) => sum + row.total, 0);
    const dataWithPercent = data.map((row) => ({
      ...row,
      percentage: total > 0 ? Math.round((row.total / total) * 1000) / 10 : 0,
    }));

    res.json({ data: dataWithPercent, total, days });
  } catch (err) {
    console.error('Species distribution error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/stock-alerts - combined low stock + expiring
router.get('/stock-alerts', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    const lowStock = db
      .prepare(`
        SELECT
          id, name, active_principle, unit,
          current_stock, min_stock,
          (min_stock - current_stock) as deficit,
          'low_stock' as alert_type
        FROM medicines
        WHERE user_id = ? AND is_active = 1 AND current_stock <= min_stock
        ORDER BY (current_stock / CASE WHEN min_stock = 0 THEN 1 ELSE min_stock END) ASC
      `)
      .all(req.user.id);

    const expiring = db
      .prepare(`
        SELECT
          id, name, active_principle, unit,
          current_stock, expiry_date,
          CAST(julianday(expiry_date) - julianday('now') AS INTEGER) as days_until_expiry,
          CASE
            WHEN expiry_date < date('now') THEN 'expired'
            ELSE 'expiring_soon'
          END as alert_type
        FROM medicines
        WHERE user_id = ? AND is_active = 1
          AND expiry_date IS NOT NULL
          AND expiry_date <= date('now', '+30 days')
        ORDER BY expiry_date ASC
      `)
      .all(req.user.id);

    res.json({
      low_stock: lowStock,
      expiring: expiring,
      total_alerts: lowStock.length + expiring.length,
      summary: {
        low_stock_count: lowStock.length,
        expiring_count: expiring.filter((m) => m.alert_type === 'expiring_soon').length,
        expired_count: expiring.filter((m) => m.alert_type === 'expired').length,
      },
    });
  } catch (err) {
    console.error('Stock alerts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/recent-activity - last 10 activities
router.get('/recent-activity', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit) || 10;

    // Combine surgeries and stock movements
    const surgeries = db
      .prepare(`
        SELECT
          'surgery' as type,
          id,
          created_at,
          ('Cirurgia: ' || procedure_name || ' - ' || patient_name) as description,
          status as extra,
          revenue as amount
        FROM surgeries
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(req.user.id, limit);

    const stockMovements = db
      .prepare(`
        SELECT
          'stock_' || sm.type as type,
          sm.id,
          sm.created_at,
          (m.name || ' (' || sm.quantity || ' ' || m.unit || ')') as description,
          sm.type as extra,
          sm.total_cost as amount
        FROM stock_movements sm
        JOIN medicines m ON sm.medicine_id = m.id
        WHERE sm.user_id = ?
        ORDER BY sm.created_at DESC
        LIMIT ?
      `)
      .all(req.user.id, limit);

    // Merge and sort by created_at, take top N
    const allActivity = [...surgeries, ...stockMovements]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);

    res.json({ activities: allActivity, count: allActivity.length });
  } catch (err) {
    console.error('Recent activity error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/asa-distribution - ASA classification breakdown
router.get('/asa-distribution', authenticateToken, (req, res) => {
  try {
    const db = getDb();

    const data = db
      .prepare(`
        SELECT
          COALESCE(asa_classification, 'Não classificado') as asa,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'completed' THEN revenue ELSE 0 END) as revenue
        FROM surgeries
        WHERE user_id = ?
        GROUP BY asa_classification
        ORDER BY asa ASC
      `)
      .all(req.user.id);

    res.json({ data });
  } catch (err) {
    console.error('ASA distribution error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
