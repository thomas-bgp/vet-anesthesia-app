const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/reports/financial - full financial report
router.get('/financial', authenticateToken, (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const db = getDb();

    let dateFilter = '';
    const params = [req.user.id];

    if (date_from) {
      dateFilter += ' AND date(created_at) >= date(?)';
      params.push(date_from);
    }
    if (date_to) {
      dateFilter += ' AND date(created_at) <= date(?)';
      params.push(date_to);
    }

    // Purchase totals
    const purchaseParams = [req.user.id];
    let purchaseDateFilter = '';
    if (date_from) { purchaseDateFilter += " AND date(sm.created_at) >= date(?)"; purchaseParams.push(date_from); }
    if (date_to) { purchaseDateFilter += " AND date(sm.created_at) <= date(?)"; purchaseParams.push(date_to); }

    const purchaseSummary = db
      .prepare(`
        SELECT
          COALESCE(SUM(sm.total_cost), 0) as total_purchases,
          COUNT(*) as purchases_count
        FROM stock_movements sm
        WHERE sm.user_id = ? AND sm.type = 'purchase' ${purchaseDateFilter}
      `)
      .get(...purchaseParams);

    // Revenue totals
    const revenueSummary = db
      .prepare(`
        SELECT
          COALESCE(SUM(revenue), 0) as total_revenue,
          COUNT(*) as surgeries_count
        FROM surgeries
        WHERE user_id = ? AND status = 'completed' ${dateFilter}
      `)
      .get(...params);

    // Usage cost (actual drugs consumed)
    const usageSummary = db
      .prepare(`
        SELECT COALESCE(SUM(sm.total_cost), 0) as total_usage_cost
        FROM stock_movements sm
        WHERE sm.user_id = ? AND sm.type = 'usage' ${purchaseDateFilter}
      `)
      .get(...purchaseParams);

    // Purchases by medicine
    const purchases_by_medicine = db
      .prepare(`
        SELECT
          m.name as medicine_name,
          m.unit,
          SUM(sm.quantity) as total_quantity,
          SUM(sm.total_cost) as total_cost,
          AVG(sm.unit_cost) as avg_unit_cost,
          COUNT(*) as purchase_count
        FROM stock_movements sm
        JOIN medicines m ON sm.medicine_id = m.id
        WHERE sm.user_id = ? AND sm.type = 'purchase' ${purchaseDateFilter}
        GROUP BY m.id, m.name, m.unit
        ORDER BY total_cost DESC
      `)
      .all(...purchaseParams);

    // Revenue by surgery
    const revenueParams = [req.user.id];
    let revDateFilter = '';
    if (date_from) { revDateFilter += " AND date(COALESCE(s.start_time, s.created_at)) >= date(?)"; revenueParams.push(date_from); }
    if (date_to) { revDateFilter += " AND date(COALESCE(s.start_time, s.created_at)) <= date(?)"; revenueParams.push(date_to); }

    const revenue_by_surgery = db
      .prepare(`
        SELECT
          s.id,
          COALESCE(s.start_time, s.created_at) as date,
          s.patient_name,
          s.procedure_name as procedure,
          s.patient_species as species,
          s.clinic_name,
          s.revenue,
          (
            SELECT COALESCE(SUM(sm2.total_cost), 0)
            FROM stock_movements sm2
            WHERE sm2.surgery_id = s.id AND sm2.type = 'usage'
          ) as medicines_cost
        FROM surgeries s
        WHERE s.user_id = ? AND s.status = 'completed' ${revDateFilter}
        ORDER BY COALESCE(s.start_time, s.created_at) DESC
      `)
      .all(...revenueParams);

    res.json({
      total_purchases: purchaseSummary.total_purchases,
      purchases_count: purchaseSummary.purchases_count,
      total_revenue: revenueSummary.total_revenue,
      surgeries_count: revenueSummary.surgeries_count,
      total_usage_cost: usageSummary.total_usage_cost,
      purchases_by_medicine,
      revenue_by_surgery,
    });
  } catch (err) {
    console.error('Financial report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
