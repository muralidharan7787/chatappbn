const sql = require('mssql');
// require('dotenv').config();


const config = {
    user: "muralidharan@development-md",
    password: "9363509@Murali",  // 🔐 Replace with actual password
    server: "development-md.database.windows.net",
    database: "development",
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