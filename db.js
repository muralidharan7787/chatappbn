const mysql = require('mysql');
console.log("server started succesfully from db");

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'test',
});

db.connect((err)=>{
    if(err) throw err;
    console.log('MySql Connected');
});

module.exports = db;