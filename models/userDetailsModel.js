const db = require('../db.js');
console.log("server started succesfully from model");

const userDetails = {
    getall: (callback)=>{
        db.query('select * from user_details',callback);
    }
}

module.exports= userDetails;