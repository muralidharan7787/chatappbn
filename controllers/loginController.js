const login = require('../models/loginModel');

exports.register = (req,res) =>{

    // const { email, password } = req.body;
    const email = req.body;
    console.log(email['email']);

  // No database check, just return what was sent
    res.status(200).json({
      message: 'Login data received successfully',
      data: email.email,
    });
};