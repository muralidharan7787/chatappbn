const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,  // 🔐 Replace with actual password
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: 1433,
    options: {
        encrypt: true, // ✅ for Azure
        trustServerCertificate: false,
    }
};

sql.connect(config)
  .then(pool => {
    console.log('SQL Server Connected ✅');
    // You can use pool.request() to run queries now
    return pool;
  })
  .catch(err => {
    console.error('❌ SQL Connection Error:', err);
  });

module.exports = sql;
