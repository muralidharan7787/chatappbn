const userDetails = require('../models/userDetailsModel');
console.log("server started succesfully from controller");

exports.getUserDetailsAll = (req,res)=>{
    userDetails.getall((resutls,err)=>{
        if(err) return res.status(500).send(err);
        res.json(results);
    });
};