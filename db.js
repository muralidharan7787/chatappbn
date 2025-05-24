const { Pool } = require('pg');
require('dotenv').config();

// console.log(process.env.DB_CONSTR, '---- server');

const pool = new Pool({
  connectionString: process.env.DB_CONSTR,
    ssl: {
      rejectUnauthorized: false // required for Render
    }
});

pool.connect()
  .then(client => {
    console.log('PostgreSQL Connected ✅');
    client.release();
  })
  .catch(err => {
    console.error('❌ PostgreSQL Connection Error:', err);
  });

module.exports = pool;
