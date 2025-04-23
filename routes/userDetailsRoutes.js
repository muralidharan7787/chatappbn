const express = require('express');
const routes = express.Router();
const userDetailsController = require('../controllers/userDetailsController');

console.log("server started succesfullyyyyys");

routes.get('/',userDetailsController.getUserDetailsAll);
module.exports = routes;
