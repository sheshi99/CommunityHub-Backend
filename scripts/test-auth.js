/**
 * Script manual para verificar que la infraestructura de JWT funciona
 * (generacion, verificacion y middleware de proteccion).
 *
 * Requiere que el servidor este corriendo (npm run dev) en otra terminal.
 * Uso: node scripts/test-auth.js
 */
require('dotenv').config();
const generateToken = require('../src/utils/generateToken');

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

const check = async (label, expectedStatus, headers = {}) => {
  const res = await fetch(`${BASE_URL}/api/auth/me`, { headers });
  const passed = res.status === expectedStatus;
  console.log(`${passed ? 'OK  ' : 'FAIL'} ${label} -> esperado ${expectedStatus}, obtuvo ${res.status}`);
};

const run = async () => {
  const validToken = generateToken('64f1a2b3c4d5e6f7a8b9c0d1', 'ADMIN');

  await check('Sin token', 401);
  await check('Token invalido', 401, { Authorization: 'Bearer token-invalido' });
  // 501 = paso el middleware y llego al controlador (que todavia es un stub)
  await check('Token valido', 501, { Authorization: `Bearer ${validToken}` });
};

run().catch((err) => {
  console.error('Error ejecutando las pruebas. Esta corriendo el servidor (npm run dev)?');
  console.error(err.message);
  process.exit(1);
});
