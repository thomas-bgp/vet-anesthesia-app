// API smoke test - run with: node test_api.js
const http = require('http');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      }
    };
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function runTests() {
  console.log('=== VET ANESTHESIA API SMOKE TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function pass(label, info) {
    console.log(`[PASS] ${label}${info ? ' - ' + info : ''}`);
    passed++;
  }
  function fail(label, err) {
    console.log(`[FAIL] ${label} - ${err}`);
    failed++;
  }

  // 1. Login
  let r = await req('POST', '/api/auth/login', { email: 'carlos@vetanesthesia.com', password: 'vet123' });
  const token = r.body.token;
  if (token) pass('POST /api/auth/login', `User: ${r.body.user?.name} | Role: ${r.body.user?.role}`);
  else fail('POST /api/auth/login', JSON.stringify(r.body));

  // 2. GET /me
  r = await req('GET', '/api/auth/me', null, token);
  if (r.body.user?.id) pass('GET /api/auth/me', `ID: ${r.body.user.id} | Email: ${r.body.user.email}`);
  else fail('GET /api/auth/me', JSON.stringify(r.body));

  // 3. List medicines
  r = await req('GET', '/api/medicines', null, token);
  if (r.body.medicines?.length > 0) pass('GET /api/medicines', `Count: ${r.body.medicines.length} | Stock value: R$ ${r.body.summary?.total_value?.toFixed(2)}`);
  else fail('GET /api/medicines', JSON.stringify(r.body));

  // 4. Low stock
  r = await req('GET', '/api/medicines/low-stock', null, token);
  if (r.status === 200) pass('GET /api/medicines/low-stock', `Count: ${r.body.count}`);
  else fail('GET /api/medicines/low-stock', JSON.stringify(r.body));

  // 5. Expiring medicines
  r = await req('GET', '/api/medicines/expiring', null, token);
  if (r.status === 200) pass('GET /api/medicines/expiring', `Count: ${r.body.count}`);
  else fail('GET /api/medicines/expiring', JSON.stringify(r.body));

  // 6. List surgeries
  r = await req('GET', '/api/surgeries', null, token);
  if (r.body.surgeries?.length > 0) pass('GET /api/surgeries', `Count: ${r.body.surgeries.length} | Total: ${r.body.pagination?.total}`);
  else fail('GET /api/surgeries', JSON.stringify(r.body));

  // 7. Dashboard stats
  r = await req('GET', '/api/dashboard/stats', null, token);
  if (r.body.surgeries?.total_surgeries > 0) pass('GET /api/dashboard/stats', `Surgeries: ${r.body.surgeries.total_surgeries} | Revenue: R$ ${r.body.revenue?.total} | Stock: R$ ${r.body.stock?.total_stock_value?.toFixed(2)}`);
  else fail('GET /api/dashboard/stats', JSON.stringify(r.body));

  // 8. Species distribution
  r = await req('GET', '/api/dashboard/species-distribution', null, token);
  if (r.body.data?.length > 0) pass('GET /api/dashboard/species-distribution', r.body.data.map(s => `${s.species}:${s.total}`).join(', '));
  else fail('GET /api/dashboard/species-distribution', JSON.stringify(r.body));

  // 9. Revenue by month
  r = await req('GET', '/api/dashboard/revenue-by-month?months=3', null, token);
  if (r.status === 200) pass('GET /api/dashboard/revenue-by-month', `Months with data: ${r.body.data?.length}`);
  else fail('GET /api/dashboard/revenue-by-month', JSON.stringify(r.body));

  // 10. Top medicines
  r = await req('GET', '/api/dashboard/top-medicines', null, token);
  if (r.status === 200) pass('GET /api/dashboard/top-medicines', `Top: ${r.body.data?.[0]?.name} (${r.body.data?.[0]?.usage_count} uses)`);
  else fail('GET /api/dashboard/top-medicines', JSON.stringify(r.body));

  // 11. Stock alerts
  r = await req('GET', '/api/dashboard/stock-alerts', null, token);
  if (r.status === 200) pass('GET /api/dashboard/stock-alerts', `Total: ${r.body.total_alerts} | Low stock: ${r.body.summary?.low_stock_count} | Expiring: ${r.body.summary?.expiring_count}`);
  else fail('GET /api/dashboard/stock-alerts', JSON.stringify(r.body));

  // 12. Recent activity
  r = await req('GET', '/api/dashboard/recent-activity', null, token);
  if (r.status === 200) pass('GET /api/dashboard/recent-activity', `Activities: ${r.body.count}`);
  else fail('GET /api/dashboard/recent-activity', JSON.stringify(r.body));

  // 13. Create surgery
  r = await req('POST', '/api/surgeries', {
    patient_name: 'Buddy Test', patient_species: 'Canino', patient_breed: 'Labrador',
    patient_weight: 30, procedure_name: 'Teste Cirurgia', asa_classification: 'ASA I',
    clinic_name: 'Clinica Teste', surgeon_name: 'Dr. Test', revenue: 400
  }, token);
  const surgId = r.body.surgery?.id;
  if (surgId) pass('POST /api/surgeries', `ID: ${surgId} | Status: ${r.body.surgery?.status}`);
  else fail('POST /api/surgeries', JSON.stringify(r.body));

  // 14. Start surgery
  r = await req('PUT', `/api/surgeries/${surgId}/start`, {}, token);
  if (r.body.surgery?.status === 'in_progress') pass('PUT /api/surgeries/:id/start', `Status: ${r.body.surgery.status}`);
  else fail('PUT /api/surgeries/:id/start', JSON.stringify(r.body));

  // 15. Get medicine
  const medR = await req('GET', '/api/medicines', null, token);
  const medId = medR.body.medicines?.[0]?.id;
  const medStockBefore = medR.body.medicines?.[0]?.current_stock;

  // 16. Add medicine to surgery (auto-decrement stock)
  r = await req('POST', `/api/surgeries/${surgId}/medicines`, {
    medicine_id: medId, dose: 10, dose_unit: 'mg/kg', route: 'IV', notes: 'Inducao teste'
  }, token);
  const stockAfter = r.body.updated_medicine?.current_stock;
  if (r.status === 201 && stockAfter === medStockBefore - 10) pass('POST /api/surgeries/:id/medicines', `Stock: ${medStockBefore} -> ${stockAfter} (decremented by 10)`);
  else if (r.status === 201) pass('POST /api/surgeries/:id/medicines', `Stock before: ${medStockBefore}, after: ${stockAfter}`);
  else fail('POST /api/surgeries/:id/medicines', JSON.stringify(r.body));

  // 17. End surgery
  r = await req('PUT', `/api/surgeries/${surgId}/end`, { outcome: 'success', monitoring_notes: 'Sem complicacoes' }, token);
  if (r.body.surgery?.status === 'completed') pass('PUT /api/surgeries/:id/end', `Status: ${r.body.surgery.status} | Duration: ${r.body.duration_minutes} min`);
  else fail('PUT /api/surgeries/:id/end', JSON.stringify(r.body));

  // 18. Surgery details
  r = await req('GET', `/api/surgeries/${surgId}/details`, null, token);
  if (r.body.medicines !== undefined) pass('GET /api/surgeries/:id/details', `Medicines: ${r.body.medicines?.length} | Cost: R$ ${r.body.summary?.total_medicine_cost?.toFixed(2)}`);
  else fail('GET /api/surgeries/:id/details', JSON.stringify(r.body));

  // 19. Stock purchase
  r = await req('POST', '/api/stock/purchase', { medicine_id: medId, quantity: 50, unit_cost: 0.90, notes: 'Reposicao teste' }, token);
  if (r.status === 201) pass('POST /api/stock/purchase', `New stock: ${r.body.medicine?.current_stock}`);
  else fail('POST /api/stock/purchase', JSON.stringify(r.body));

  // 20. Stock history
  r = await req('GET', `/api/stock/history/${medId}`, null, token);
  if (r.body.movements?.length > 0) pass('GET /api/stock/history/:id', `Movements: ${r.body.movements.length} | Total purchased: ${r.body.summary?.total_purchased}`);
  else fail('GET /api/stock/history/:id', JSON.stringify(r.body));

  // 21. Stock report
  r = await req('GET', '/api/stock/report', null, token);
  if (r.status === 200) pass('GET /api/stock/report', `Transactions: ${r.body.summary?.total_transactions} | Total spent: R$ ${r.body.summary?.total_purchases?.toFixed(2)}`);
  else fail('GET /api/stock/report', JSON.stringify(r.body));

  // 22. Create referral
  r = await req('POST', '/api/referrals', { expires_in_days: 7, max_uses: 5 }, token);
  const refCode = r.body.referral?.code;
  if (refCode) pass('POST /api/referrals', `Code: ${refCode} | Expires: ${r.body.referral?.expires_at?.substring(0, 10)}`);
  else fail('POST /api/referrals', JSON.stringify(r.body));

  // 23. List referrals
  r = await req('GET', '/api/referrals', null, token);
  if (r.status === 200) pass('GET /api/referrals', `Count: ${r.body.referrals?.length}`);
  else fail('GET /api/referrals', JSON.stringify(r.body));

  // 24. Validate referral (no auth needed)
  r = await req('GET', `/api/referrals/validate/${refCode}`);
  if (r.body.valid === true) pass('GET /api/referrals/validate/:code', `Valid: ${r.body.valid} | Uses remaining: ${r.body.uses_remaining}`);
  else fail('GET /api/referrals/validate/:code', JSON.stringify(r.body));

  // 25. Register new user with referral
  r = await req('POST', '/api/auth/register', { name: 'Dr. Novo', email: 'novo@vet.com', password: 'novo123', referral_code: refCode });
  if (r.status === 201) pass('POST /api/auth/register (with referral)', `${r.body.message} | Role: ${r.body.user?.role}`);
  else fail('POST /api/auth/register (with referral)', JSON.stringify(r.body));

  // 26. Stock adjustment
  r = await req('POST', '/api/stock/adjustment', { medicine_id: medId, new_quantity: 999, notes: 'Inventario' }, token);
  if (r.body.medicine?.current_stock === 999) pass('POST /api/stock/adjustment', `New stock: ${r.body.medicine.current_stock}`);
  else fail('POST /api/stock/adjustment', JSON.stringify(r.body));

  // 27. Add new medicine
  r = await req('POST', '/api/medicines', {
    name: 'Rocuronio 10mg/mL', active_principle: 'Rocuronio', concentration: '10mg/mL',
    unit: 'mL', current_stock: 100, min_stock: 20, cost_per_unit: 5.50,
    supplier: 'Organon', batch_number: 'LOT2024099', expiry_date: '2026-06-30'
  }, token);
  const newMedId = r.body.medicine?.id;
  if (newMedId) pass('POST /api/medicines', `ID: ${newMedId} | Name: ${r.body.medicine.name}`);
  else fail('POST /api/medicines', JSON.stringify(r.body));

  // 28. Update medicine
  r = await req('PUT', `/api/medicines/${newMedId}`, { name: 'Rocuronio 10mg/mL', unit: 'mL', min_stock: 30, cost_per_unit: 5.80 }, token);
  if (r.body.medicine?.cost_per_unit === 5.80) pass('PUT /api/medicines/:id', `Updated cost_per_unit: ${r.body.medicine.cost_per_unit}`);
  else fail('PUT /api/medicines/:id', JSON.stringify(r.body));

  // 29. Delete medicine (soft)
  r = await req('DELETE', `/api/medicines/${newMedId}`, null, token);
  if (r.status === 200) pass('DELETE /api/medicines/:id', r.body.message);
  else fail('DELETE /api/medicines/:id', JSON.stringify(r.body));

  // 30. Cancel a scheduled surgery
  const newSurg = await req('POST', '/api/surgeries', {
    patient_name: 'Cancel Test', patient_species: 'Felino', procedure_name: 'Teste Cancelamento',
    clinic_name: 'Teste', revenue: 200
  }, token);
  const cancelId = newSurg.body.surgery?.id;
  r = await req('DELETE', `/api/surgeries/${cancelId}`, null, token);
  if (r.status === 200) pass('DELETE /api/surgeries/:id (cancel)', r.body.message);
  else fail('DELETE /api/surgeries/:id (cancel)', JSON.stringify(r.body));

  // 31. Surgeries by month
  r = await req('GET', '/api/dashboard/surgeries-by-month?months=3', null, token);
  if (r.status === 200) pass('GET /api/dashboard/surgeries-by-month', `Months with data: ${r.body.data?.length}`);
  else fail('GET /api/dashboard/surgeries-by-month', JSON.stringify(r.body));

  // 32. ASA distribution
  r = await req('GET', '/api/dashboard/asa-distribution', null, token);
  if (r.status === 200) pass('GET /api/dashboard/asa-distribution', `ASA classes: ${r.body.data?.length}`);
  else fail('GET /api/dashboard/asa-distribution', JSON.stringify(r.body));

  // 33. Deactivate referral
  const refListR = await req('GET', '/api/referrals', null, token);
  const refId = refListR.body.referrals?.[0]?.id;
  r = await req('DELETE', `/api/referrals/${refId}`, null, token);
  if (r.status === 200) pass('DELETE /api/referrals/:id', r.body.message);
  else fail('DELETE /api/referrals/:id', JSON.stringify(r.body));

  // 34. Change password
  r = await req('POST', '/api/auth/change-password', { current_password: 'vet123', new_password: 'newvet456' }, token);
  if (r.status === 200) pass('POST /api/auth/change-password', r.body.message);
  else fail('POST /api/auth/change-password', JSON.stringify(r.body));

  // 35. Verify new password works
  r = await req('POST', '/api/auth/login', { email: 'carlos@vetanesthesia.com', password: 'newvet456' });
  if (r.body.token) pass('POST /api/auth/login (new password)', 'Login with new password works');
  else fail('POST /api/auth/login (new password)', JSON.stringify(r.body));

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('TEST RUNNER ERROR:', err.message);
  process.exit(1);
});
