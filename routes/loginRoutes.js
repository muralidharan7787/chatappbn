const login = require('../controllers/loginController');
const express = require('express');
const routes = express.Router();

routes.post('/',login.register);

module.exports = routes;