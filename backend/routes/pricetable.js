const express = require('express');
const router = express.Router();
const { getSupabase } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/price-table - list procedures with prices
router.get('/', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();

    const { data: items, error } = await supabase
      .from('price_table')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .order('procedure_name', { ascending: true });

    if (error) throw error;

    const { data: margin } = await supabase
      .from('users')
      .select('profit_margin_percent')
      .eq('id', req.user.id)
      .single();

    res.json({
      items: items || [],
      profit_margin_percent: margin?.profit_margin_percent ?? 30,
    });
  } catch (err) {
    console.error('List price table error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/price-table - add procedure to price table
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { procedure_name, price_without_drugs, price_with_drugs, notes } = req.body;

    if (!procedure_name) {
      return res.status(400).json({ error: 'procedure_name is required' });
    }

    const supabase = getSupabase();

    const { data: item, error } = await supabase
      .from('price_table')
      .insert({
        user_id: req.user.id,
        procedure_name,
        price_without_drugs: parseFloat(price_without_drugs) || 0,
        price_with_drugs: parseFloat(price_with_drugs) || 0,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'Price table entry created', item });
  } catch (err) {
    console.error('Create price table error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/price-table/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('price_table')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Price table entry not found' });
    }

    const {
      procedure_name = existing.procedure_name,
      price_without_drugs = existing.price_without_drugs,
      price_with_drugs = existing.price_with_drugs,
      notes = existing.notes,
    } = req.body;

    await supabase
      .from('price_table')
      .update({
        procedure_name,
        price_without_drugs: parseFloat(price_without_drugs) || 0,
        price_with_drugs: parseFloat(price_with_drugs) || 0,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', req.user.id);

    const { data: item } = await supabase
      .from('price_table')
      .select('*')
      .eq('id', id)
      .single();

    res.json({ message: 'Price table entry updated', item });
  } catch (err) {
    console.error('Update price table error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/price-table/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from('price_table')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Price table entry not found' });
    }

    await supabase
      .from('price_table')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    res.json({ message: 'Price table entry deleted' });
  } catch (err) {
    console.error('Delete price table error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/price-table/margin - update profit margin
router.put('/margin', authenticateToken, async (req, res) => {
  try {
    const { profit_margin_percent } = req.body;

    if (profit_margin_percent === undefined || profit_margin_percent < 0) {
      return res.status(400).json({ error: 'profit_margin_percent must be >= 0' });
    }

    const supabase = getSupabase();

    await supabase
      .from('users')
      .update({ profit_margin_percent: parseFloat(profit_margin_percent) })
      .eq('id', req.user.id);

    res.json({ message: 'Margin updated', profit_margin_percent: parseFloat(profit_margin_percent) });
  } catch (err) {
    console.error('Update margin error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
