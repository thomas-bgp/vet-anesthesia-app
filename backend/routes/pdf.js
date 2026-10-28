const express = require('express');
const puppeteer = require('puppeteer-core');
const { queryRows } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// O update do iOS de 27/10/26 quebrou window.print() no app instalado (PWA standalone) — no
// Safari continua funcionando. Pra não depender do navegador do cliente, o PDF é renderizado
// aqui: o Chromium abre a própria FichaDetail servida pelo nginx do container, com o mesmo
// CSS @media print, então o arquivo sai idêntico ao da impressão no navegador.
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const RENDER_ORIGIN = process.env.PDF_RENDER_ORIGIN || 'http://127.0.0.1';
// Cada Chromium usa ~150 MB; limita o paralelismo pra não derrubar o container.
const MAX_CONCURRENT = 2;
let inFlight = 0;

router.get('/:id/pdf', authenticateToken, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });

  const rows = await queryRows(
    'SELECT id, patient_name FROM surgeries WHERE id = $1 AND user_id = $2',
    [id, req.user.id]
  ).catch((error) => {
    console.error('Erro ao buscar ficha para PDF:', { id, error });
    return null;
  });
  if (!rows) return res.status(500).json({ error: 'Não foi possível gerar o PDF.' });
  if (rows.length === 0) return res.status(404).json({ error: 'Surgery not found' });

  if (inFlight >= MAX_CONCURRENT) {
    return res.status(429).json({ error: 'Gerando outro PDF. Tente de novo em alguns segundos.' });
  }
  inFlight++;
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage();
    const token = req.headers.authorization.split(' ')[1];
    await page.evaluateOnNewDocument((t, u) => {
      localStorage.setItem('token', t);
      localStorage.setItem('user', u);
      window.print = () => {};
    }, token, JSON.stringify(req.user));
    await page.emulateMediaType('print');
    await page.goto(`${RENDER_ORIGIN}/fichas/${id}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction(
      () => /identifica/i.test(document.body.innerText),
      { timeout: 15000 }
    );
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });

    const safeName = (rows[0].patient_name || 'ficha').normalize('NFD').replace(/[^\w-]+/g, '_');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="ficha-${safeName}.pdf"`,
      'Cache-Control': 'no-store',
    });
    res.send(Buffer.from(pdf));
  } catch (error) {
    console.error('Erro ao gerar PDF da ficha:', { id, userId: req.user.id, error: error.message });
    res.status(500).json({ error: 'Não foi possível gerar o PDF.' });
  } finally {
    inFlight--;
    if (browser) await browser.close().catch((error) => console.error('Erro ao fechar Chromium:', error.message));
  }
});

module.exports = router;
