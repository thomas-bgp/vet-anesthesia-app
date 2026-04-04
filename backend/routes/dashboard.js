const express = require('express');
const router = express.Router();
const { queryRows } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/dashboard - summary for Resumo page
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const surgeryStatsRows = await queryRows(`
      SELECT
        COUNT(*)::int as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::int as completed,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END)::int as scheduled,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END)::int as in_progress,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)::int as cancelled
      FROM surgeries
      WHERE user_id = $1
    `, [userId]);
    const surgeryStats = surgeryStatsRows[0];

    const now = new Date().toISOString().split('T')[0];
    const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const stockAlertsRows = await queryRows(`
      SELECT
        SUM(CASE
          WHEN m.min_stock > 0 AND active_bottles.cnt <= m.min_stock THEN 1
          WHEN active_bottles.cnt = 0 AND total_bottles.cnt > 0 THEN 1
          ELSE 0
        END)::int as low_stock_count,
        SUM(CASE WHEN m.expiry_date IS NOT NULL AND m.expiry_date <= $2 AND m.expiry_date >= $3 THEN 1 ELSE 0 END)::int as expiring_soon_count
      FROM medicines m
      LEFT JOIN (
        SELECT medicine_id, COUNT(*)::int as cnt FROM medicine_bottles WHERE status IN ('sealed','opened') GROUP BY medicine_id
      ) active_bottles ON active_bottles.medicine_id = m.id
      LEFT JOIN (
        SELECT medicine_id, COUNT(*)::int as cnt FROM medicine_bottles GROUP BY medicine_id
      ) total_bottles ON total_bottles.medicine_id = m.id
      WHERE m.user_id = $1 AND m.is_active = true
    `, [userId, in30days, now]);
    const stockAlerts = stockAlertsRows[0];

    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 86400000).toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    const monthlyRevenue = await queryRows(`
      SELECT
        to_char(COALESCE(start_time, created_at), 'YYYY-MM') as month,
        COUNT(*)::int as count,
        COALESCE(SUM(revenue), 0)::numeric as total_revenue,
        COALESCE(SUM(CASE WHEN paid = true THEN revenue ELSE 0 END), 0)::numeric as paid_revenue,
        COALESCE(SUM(CASE WHEN COALESCE(paid, false) = false AND revenue > 0 THEN revenue ELSE 0 END), 0)::numeric as pending_revenue,
        SUM(CASE WHEN paid = true THEN 1 ELSE 0 END)::int as paid_count,
        SUM(CASE WHEN COALESCE(paid, false) = false AND revenue > 0 THEN 1 ELSE 0 END)::int as pending_count
      FROM surgeries
      WHERE user_id = $1
        AND status != 'cancelled'
        AND created_at >= $2
      GROUP BY to_char(COALESCE(start_time, created_at), 'YYYY-MM')
      ORDER BY month ASC
    `, [userId, sixMonthsAgo]);

    // Monthly stock costs (from bottle_usages — actual mL used)
    const monthlyCosts = await queryRows(`
      SELECT
        to_char(bu.used_at, 'YYYY-MM') as month,
        COALESCE(SUM(bu.cost), 0)::numeric as stock_cost
      FROM bottle_usages bu
      WHERE bu.user_id = $1
        AND bu.used_at >= $2
      GROUP BY to_char(bu.used_at, 'YYYY-MM')
      ORDER BY month ASC
    `, [userId, sixMonthsAgo]);

    // Merge costs into monthly revenue and ensure current month exists
    const costMap = {};
    for (const c of monthlyCosts) costMap[c.month] = parseFloat(c.stock_cost || 0);

    const revenueMap = {};
    for (const r of monthlyRevenue) revenueMap[r.month] = r;

    // Ensure current month is present
    if (!revenueMap[currentMonth]) {
      revenueMap[currentMonth] = {
        month: currentMonth, count: 0, total_revenue: 0, paid_revenue: 0,
        pending_revenue: 0, paid_count: 0, pending_count: 0,
      };
    }

    // Build final array with costs
    const mergedMonthly = Object.values(revenueMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(r => ({
        ...r,
        stock_cost: costMap[r.month] || 0,
        margin: parseFloat(r.total_revenue || 0) - (costMap[r.month] || 0),
      }));

    // Revenue by clinic (with stock cost from movements linked to surgeries)
    const byClinic = await queryRows(`
      SELECT
        COALESCE(s.clinic_name, 'Sem clínica') as clinic,
        COUNT(DISTINCT s.id)::int as count,
        COALESCE(SUM(DISTINCT s.revenue), 0)::numeric as total_revenue,
        COALESCE(SUM(DISTINCT CASE WHEN s.paid = true THEN s.revenue ELSE 0 END), 0)::numeric as paid_revenue,
        COALESCE(SUM(DISTINCT CASE WHEN COALESCE(s.paid, false) = false AND s.revenue > 0 THEN s.revenue ELSE 0 END), 0)::numeric as pending_revenue,
        COALESCE(SUM(sm.total_cost), 0)::numeric as stock_cost
      FROM surgeries s
      LEFT JOIN stock_movements sm ON sm.surgery_id = s.id AND sm.type = 'usage'
      WHERE s.user_id = $1 AND s.status != 'cancelled'
      GROUP BY COALESCE(s.clinic_name, 'Sem clínica')
      ORDER BY total_revenue DESC
    `, [userId]);

    // Monthly revenue by clinic (last 6 months, top 5 clinics)
    const monthlyByClinic = await queryRows(`
      SELECT
        to_char(COALESCE(start_time, created_at), 'YYYY-MM') as month,
        COALESCE(clinic_name, 'Sem clínica') as clinic,
        COALESCE(SUM(revenue), 0)::numeric as revenue
      FROM surgeries
      WHERE user_id = $1 AND status != 'cancelled' AND created_at >= $2
      GROUP BY to_char(COALESCE(start_time, created_at), 'YYYY-MM'), COALESCE(clinic_name, 'Sem clínica')
      ORDER BY month ASC
    `, [userId, sixMonthsAgo]);

    // Low stock detail list — uses actual bottle count, not current_stock
    const lowStockItems = await queryRows(`
      SELECT m.id, m.name, m.concentration, m.min_stock,
             COALESCE(ab.cnt, 0)::int as current_stock,
             COALESCE(tb.cnt, 0)::int as total_bottles
      FROM medicines m
      LEFT JOIN (
        SELECT medicine_id, COUNT(*)::int as cnt FROM medicine_bottles WHERE status IN ('sealed','opened') GROUP BY medicine_id
      ) ab ON ab.medicine_id = m.id
      LEFT JOIN (
        SELECT medicine_id, COUNT(*)::int as cnt FROM medicine_bottles GROUP BY medicine_id
      ) tb ON tb.medicine_id = m.id
      WHERE m.user_id = $1 AND m.is_active = true
        AND (
          (m.min_stock > 0 AND COALESCE(ab.cnt, 0) <= m.min_stock)
          OR (COALESCE(ab.cnt, 0) = 0 AND COALESCE(tb.cnt, 0) > 0)
        )
      ORDER BY COALESCE(ab.cnt, 0) ASC
    `, [userId]);

    res.json({
      surgery_stats: surgeryStats,
      stock_alerts: { ...stockAlerts, items: lowStockItems },
      monthly_revenue: mergedMonthly,
      by_clinic: byClinic,
      monthly_by_clinic: monthlyByClinic,
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/stats - overview stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date().toISOString().split('T')[0];
    const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const in2days = new Date(Date.now() + 2 * 86400000).toISOString();
    const nowISO = new Date().toISOString();

    // Surgery stats
    const surgeryStatsRows = await queryRows(`
      SELECT
        COUNT(*)::int as total_surgeries,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::int as completed_surgeries,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END)::int as scheduled_surgeries,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END)::int as in_progress_surgeries,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)::int as cancelled_surgeries,
        SUM(CASE WHEN status = 'completed' THEN revenue ELSE 0 END) as total_revenue,
        AVG(CASE WHEN status = 'completed' THEN revenue ELSE NULL END) as avg_revenue_per_surgery,
        AVG(CASE WHEN status = 'completed' AND duration_minutes IS NOT NULL THEN duration_minutes ELSE NULL END) as avg_duration_minutes
      FROM surgeries
      WHERE user_id = $1
    `, [userId]);
    const surgeryStats = surgeryStatsRows[0];

    // This month stats
    const thisMonthRows = await queryRows(`
      SELECT
        COUNT(*)::int as surgeries_this_month,
        SUM(CASE WHEN status = 'completed' THEN revenue ELSE 0 END) as revenue_this_month
      FROM surgeries
      WHERE user_id = $1
        AND to_char(created_at, 'YYYY-MM') = to_char(NOW(), 'YYYY-MM')
    `, [userId]);
    const thisMonthStats = thisMonthRows[0];

    // Last month stats
    const lastMonthRows = await queryRows(`
      SELECT
        COUNT(*)::int as surgeries_last_month,
        SUM(CASE WHEN status = 'completed' THEN revenue ELSE 0 END) as revenue_last_month
      FROM surgeries
      WHERE user_id = $1
        AND to_char(created_at, 'YYYY-MM') = to_char(NOW() - INTERVAL '1 month', 'YYYY-MM')
    `, [userId]);
    const lastMonthStats = lastMonthRows[0];

    // Stock stats
    const stockStatsRows = await queryRows(`
      SELECT
        COUNT(*)::int as total_medicines,
        SUM(current_stock * cost_per_unit) as total_stock_value,
        SUM(CASE WHEN (min_stock > 0 AND current_stock <= min_stock)
                   OR (current_stock = 0 AND EXISTS (SELECT 1 FROM stock_movements sm WHERE sm.medicine_id = m.id AND sm.type = 'purchase'))
             THEN 1 ELSE 0 END)::int as low_stock_count,
        SUM(CASE WHEN expiry_date <= $2 AND expiry_date >= $3 THEN 1 ELSE 0 END)::int as expiring_soon_count,
        SUM(CASE WHEN expiry_date < $3 THEN 1 ELSE 0 END)::int as expired_count
      FROM medicines m
      WHERE m.user_id = $1 AND m.is_active = true
    `, [userId, in30days, now]);
    const stockStats = stockStatsRows[0];

    // Bottles expiring soon
    const bottlesExpiringRows = await queryRows(`
      SELECT COUNT(*)::int as count
      FROM medicine_bottles
      WHERE user_id = $1 AND status = 'opened'
        AND expires_at <= $2
        AND expires_at >= $3
    `, [userId, in2days, nowISO]);
    const bottlesExpiring = bottlesExpiringRows[0];

    // Opened bottles count
    const openedBottlesRows = await queryRows(`
      SELECT COUNT(*)::int as count
      FROM medicine_bottles
      WHERE user_id = $1 AND status = 'opened'
    `, [userId]);
    const openedBottles = openedBottlesRows[0];

    // Pending receivables total
    const pendingReceivablesRows = await queryRows(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM receivables
      WHERE user_id = $1 AND status = 'pending'
    `, [userId]);
    const pendingReceivables = pendingReceivablesRows[0];

    // Monthly expenses total (current month)
    const monthlyExpensesRows = await queryRows(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = to_char(NOW(), 'YYYY-MM')
    `, [userId]);
    const monthlyExpenses = monthlyExpensesRows[0];

    // Calculate month-over-month changes
    const revenueChange = parseFloat(lastMonthStats.revenue_last_month) > 0
      ? ((parseFloat(thisMonthStats.revenue_this_month) - parseFloat(lastMonthStats.revenue_last_month)) / parseFloat(lastMonthStats.revenue_last_month)) * 100
      : null;

    const surgeriesChange = lastMonthStats.surgeries_last_month > 0
      ? ((thisMonthStats.surgeries_this_month - lastMonthStats.surgeries_last_month) / lastMonthStats.surgeries_last_month) * 100
      : null;

    res.json({
      surgeries: {
        ...surgeryStats,
        this_month: thisMonthStats.surgeries_this_month,
        last_month: lastMonthStats.surgeries_last_month,
        month_change_percent: surgeriesChange ? Math.round(surgeriesChange * 10) / 10 : null,
      },
      revenue: {
        total: parseFloat(surgeryStats.total_revenue) || 0,
        this_month: parseFloat(thisMonthStats.revenue_this_month) || 0,
        last_month: parseFloat(lastMonthStats.revenue_last_month) || 0,
        avg_per_surgery: parseFloat(surgeryStats.avg_revenue_per_surgery) || 0,
        month_change_percent: revenueChange ? Math.round(revenueChange * 10) / 10 : null,
      },
      stock: stockStats,
      bottles_expiring_soon: bottlesExpiring.count || 0,
      opened_bottles_count: openedBottles.count || 0,
      pending_receivables: parseFloat(pendingReceivables.total) || 0,
      monthly_expenses: parseFloat(monthlyExpenses.total) || 0,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/surgeries-by-month - monthly surgery count
router.get('/surgeries-by-month', authenticateToken, async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const cutoff = new Date(Date.now() - months * 30 * 86400000).toISOString().split('T')[0];

    const data = await queryRows(`
      SELECT
        to_char(created_at, 'YYYY-MM') as month,
        COUNT(*)::int as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::int as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END)::int as cancelled,
        SUM(CASE WHEN outcome = 'success' AND status = 'completed' THEN 1 ELSE 0 END)::int as successful
      FROM surgeries
      WHERE user_id = $1
        AND created_at >= $2
      GROUP BY to_char(created_at, 'YYYY-MM')
      ORDER BY month ASC
    `, [req.user.id, cutoff]);

    res.json({ data, months });
  } catch (err) {
    console.error('Surgeries by month error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/revenue-by-month - monthly revenue
router.get('/revenue-by-month', authenticateToken, async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const cutoff = new Date(Date.now() - months * 30 * 86400000).toISOString().split('T')[0];

    const data = await queryRows(`
      SELECT
        to_char(s.created_at, 'YYYY-MM') as month,
        SUM(CASE WHEN s.status = 'completed' THEN s.revenue ELSE 0 END) as revenue,
        COUNT(CASE WHEN s.status = 'completed' THEN 1 END)::int as completed_surgeries,
        AVG(CASE WHEN s.status = 'completed' THEN s.revenue ELSE NULL END) as avg_revenue,
        (
          SELECT COALESCE(SUM(sm2.total_cost), 0)
          FROM stock_movements sm2
          WHERE sm2.user_id = $1
            AND sm2.type = 'usage'
            AND to_char(sm2.created_at, 'YYYY-MM') = to_char(s.created_at, 'YYYY-MM')
        ) as medicine_costs
      FROM surgeries s
      WHERE s.user_id = $1
        AND s.created_at >= $2
      GROUP BY to_char(s.created_at, 'YYYY-MM')
      ORDER BY month ASC
    `, [req.user.id, cutoff]);

    // Add profit calculation
    const dataWithProfit = data.map((row) => ({
      ...row,
      revenue: parseFloat(row.revenue) || 0,
      medicine_costs: parseFloat(row.medicine_costs) || 0,
      avg_revenue: parseFloat(row.avg_revenue) || 0,
      profit: (parseFloat(row.revenue) || 0) - (parseFloat(row.medicine_costs) || 0),
    }));

    res.json({ data: dataWithProfit, months });
  } catch (err) {
    console.error('Revenue by month error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/top-medicines - most used medicines
router.get('/top-medicines', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const days = parseInt(req.query.days) || 90;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const data = await queryRows(`
      SELECT
        m.id,
        m.name,
        m.active_principle,
        m.unit,
        COUNT(sm.id)::int as usage_count,
        SUM(sm.quantity) as total_quantity_used,
        SUM(sm.total_cost) as total_cost,
        AVG(sm.quantity) as avg_dose
      FROM stock_movements sm
      JOIN medicines m ON sm.medicine_id = m.id
      WHERE sm.user_id = $1
        AND sm.type = 'usage'
        AND sm.created_at >= $2
      GROUP BY m.id, m.name, m.active_principle, m.unit
      ORDER BY usage_count DESC
      LIMIT $3
    `, [req.user.id, cutoff, limit]);

    res.json({ data, days, limit });
  } catch (err) {
    console.error('Top medicines error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/species-distribution - surgeries by species
router.get('/species-distribution', authenticateToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 365;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const data = await queryRows(`
      SELECT
        patient_species as species,
        COUNT(*)::int as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::int as completed,
        SUM(CASE WHEN status = 'completed' THEN revenue ELSE 0 END) as revenue,
        AVG(patient_weight) as avg_weight,
        AVG(duration_minutes) as avg_duration
      FROM surgeries
      WHERE user_id = $1
        AND created_at >= $2
      GROUP BY patient_species
      ORDER BY total DESC
    `, [req.user.id, cutoff]);

    const total = data.reduce((sum, row) => sum + row.total, 0);
    const dataWithPercent = data.map((row) => ({
      ...row,
      revenue: parseFloat(row.revenue) || 0,
      avg_weight: parseFloat(row.avg_weight) || null,
      avg_duration: parseFloat(row.avg_duration) || null,
      percentage: total > 0 ? Math.round((row.total / total) * 1000) / 10 : 0,
    }));

    res.json({ data: dataWithPercent, total, days });
  } catch (err) {
    console.error('Species distribution error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/stock-alerts - combined low stock + expiring
router.get('/stock-alerts', authenticateToken, async (req, res) => {
  try {
    const now = new Date().toISOString().split('T')[0];
    const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const lowStock = await queryRows(`
      SELECT
        m.id, m.name, m.active_principle, m.unit,
        m.current_stock, m.min_stock,
        (m.min_stock - m.current_stock) as deficit,
        'low_stock' as alert_type
      FROM medicines m
      WHERE m.user_id = $1 AND m.is_active = true
        AND ((m.min_stock > 0 AND m.current_stock <= m.min_stock)
          OR (m.current_stock = 0 AND EXISTS (SELECT 1 FROM stock_movements sm WHERE sm.medicine_id = m.id AND sm.type = 'purchase')))
      ORDER BY (current_stock / CASE WHEN min_stock = 0 THEN 1 ELSE min_stock END) ASC
    `, [req.user.id]);

    const expiring = await queryRows(`
      SELECT
        id, name, active_principle, unit,
        current_stock, expiry_date,
        (expiry_date::date - CURRENT_DATE)::int as days_until_expiry,
        CASE
          WHEN expiry_date < $2 THEN 'expired'
          ELSE 'expiring_soon'
        END as alert_type
      FROM medicines
      WHERE user_id = $1 AND is_active = true
        AND expiry_date IS NOT NULL
        AND expiry_date <= $3
      ORDER BY expiry_date ASC
    `, [req.user.id, now, in30days]);

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
router.get('/recent-activity', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Combine surgeries and stock movements
    const surgeries = await queryRows(`
      SELECT
        'surgery' as type,
        id,
        created_at,
        ('Cirurgia: ' || procedure_name || ' - ' || patient_name) as description,
        status as extra,
        revenue as amount
      FROM surgeries
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [req.user.id, limit]);

    const stockMovements = await queryRows(`
      SELECT
        'stock_' || sm.type as type,
        sm.id,
        sm.created_at,
        (m.name || ' (' || sm.quantity || ' ' || m.unit || ')') as description,
        sm.type as extra,
        sm.total_cost as amount
      FROM stock_movements sm
      JOIN medicines m ON sm.medicine_id = m.id
      WHERE sm.user_id = $1
      ORDER BY sm.created_at DESC
      LIMIT $2
    `, [req.user.id, limit]);

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
router.get('/asa-distribution', authenticateToken, async (req, res) => {
  try {
    const data = await queryRows(`
      SELECT
        COALESCE(asa_classification, 'Não classificado') as asa,
        COUNT(*)::int as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::int as completed,
        SUM(CASE WHEN status = 'completed' THEN revenue ELSE 0 END) as revenue
      FROM surgeries
      WHERE user_id = $1
      GROUP BY asa_classification
      ORDER BY asa ASC
    `, [req.user.id]);

    res.json({ data });
  } catch (err) {
    console.error('ASA distribution error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
