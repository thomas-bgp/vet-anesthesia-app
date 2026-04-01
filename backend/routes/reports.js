const express = require('express');
const router = express.Router();
const { queryRows } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/reports/financial - full financial report
router.get('/financial', authenticateToken, async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    // Purchase totals
    let purchaseSQL = `
      SELECT
        COALESCE(SUM(sm.total_cost), 0) as total_purchases,
        COUNT(*)::int as purchases_count
      FROM stock_movements sm
      WHERE sm.user_id = $1 AND sm.type = 'purchase'
    `;
    const purchaseParams = [req.user.id];
    let pIdx = 2;
    if (date_from) {
      purchaseSQL += ` AND sm.created_at::date >= $${pIdx}::date`;
      purchaseParams.push(date_from);
      pIdx++;
    }
    if (date_to) {
      purchaseSQL += ` AND sm.created_at::date <= $${pIdx}::date`;
      purchaseParams.push(date_to);
      pIdx++;
    }
    const purchaseSummaryRows = await queryRows(purchaseSQL, purchaseParams);
    const purchaseSummary = purchaseSummaryRows[0];

    // Revenue totals
    let revenueSQL = `
      SELECT
        COALESCE(SUM(revenue), 0) as total_revenue,
        COUNT(*)::int as surgeries_count
      FROM surgeries
      WHERE user_id = $1 AND status = 'completed'
    `;
    const revenueParams = [req.user.id];
    let rIdx = 2;
    if (date_from) {
      revenueSQL += ` AND created_at::date >= $${rIdx}::date`;
      revenueParams.push(date_from);
      rIdx++;
    }
    if (date_to) {
      revenueSQL += ` AND created_at::date <= $${rIdx}::date`;
      revenueParams.push(date_to);
      rIdx++;
    }
    const revenueSummaryRows = await queryRows(revenueSQL, revenueParams);
    const revenueSummary = revenueSummaryRows[0];

    // Usage cost
    let usageSQL = `
      SELECT COALESCE(SUM(sm.total_cost), 0) as total_usage_cost
      FROM stock_movements sm
      WHERE sm.user_id = $1 AND sm.type = 'usage'
    `;
    const usageParams = [req.user.id];
    let uIdx = 2;
    if (date_from) {
      usageSQL += ` AND sm.created_at::date >= $${uIdx}::date`;
      usageParams.push(date_from);
      uIdx++;
    }
    if (date_to) {
      usageSQL += ` AND sm.created_at::date <= $${uIdx}::date`;
      usageParams.push(date_to);
      uIdx++;
    }
    const usageSummaryRows = await queryRows(usageSQL, usageParams);
    const usageSummary = usageSummaryRows[0];

    // Purchases by medicine
    let pbmSQL = `
      SELECT
        m.name as medicine_name,
        m.unit,
        SUM(sm.quantity) as total_quantity,
        SUM(sm.total_cost) as total_cost,
        AVG(sm.unit_cost) as avg_unit_cost,
        COUNT(*)::int as purchase_count
      FROM stock_movements sm
      JOIN medicines m ON sm.medicine_id = m.id
      WHERE sm.user_id = $1 AND sm.type = 'purchase'
    `;
    const pbmParams = [req.user.id];
    let pbmIdx = 2;
    if (date_from) {
      pbmSQL += ` AND sm.created_at::date >= $${pbmIdx}::date`;
      pbmParams.push(date_from);
      pbmIdx++;
    }
    if (date_to) {
      pbmSQL += ` AND sm.created_at::date <= $${pbmIdx}::date`;
      pbmParams.push(date_to);
      pbmIdx++;
    }
    pbmSQL += ' GROUP BY m.id, m.name, m.unit ORDER BY total_cost DESC';
    const purchases_by_medicine = await queryRows(pbmSQL, pbmParams);

    // Revenue by surgery
    let rbsSQL = `
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
      WHERE s.user_id = $1 AND s.status = 'completed'
    `;
    const rbsParams = [req.user.id];
    let rbsIdx = 2;
    if (date_from) {
      rbsSQL += ` AND COALESCE(s.start_time, s.created_at)::date >= $${rbsIdx}::date`;
      rbsParams.push(date_from);
      rbsIdx++;
    }
    if (date_to) {
      rbsSQL += ` AND COALESCE(s.start_time, s.created_at)::date <= $${rbsIdx}::date`;
      rbsParams.push(date_to);
      rbsIdx++;
    }
    rbsSQL += ' ORDER BY COALESCE(s.start_time, s.created_at) DESC';
    const revenue_by_surgery = await queryRows(rbsSQL, rbsParams);

    res.json({
      total_purchases: parseFloat(purchaseSummary.total_purchases) || 0,
      purchases_count: purchaseSummary.purchases_count,
      total_revenue: parseFloat(revenueSummary.total_revenue) || 0,
      surgeries_count: revenueSummary.surgeries_count,
      total_usage_cost: parseFloat(usageSummary.total_usage_cost) || 0,
      purchases_by_medicine,
      revenue_by_surgery,
    });
  } catch (err) {
    console.error('Financial report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
