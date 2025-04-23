const db = require('../db');

const login = {
    check: (callback) => {
        db.query('select * from users',callback);
    }
}

module.exports = login;