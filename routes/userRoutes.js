const express = require('express');
const routes = express.Router();
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');
const userModel = require('../models/userModel');
const multer = require('multer');
const path = require('path');
const sql = require('../db'); // Use the db connection from the config file

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profiles/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, req.user.user_id + ext);
  }
});

const upload = multer({ storage });

routes.post('/register', userController.registerUser);
routes.post('/login', userController.loginUser);
routes.post('/update-profile', authenticate, userController.updateProfileUser);
routes.get('/get-profile', authenticate, userController.getProfileUser);
routes.post('/upload-profile', authenticate, upload.single('image'), async (req, res) => {
  if (!req.file) {
    // console.log('containing file');
    return res.status(400).json({ error: 'No image uploaded' });
  }
  console.log('containing file');
  const user_id = req.user.user_id; // from token
  const imagePath = req.file.path; // e.g. 'uploads/168...jpg'

  try {
    const request = new sql.Request();
      request.input('user_id', sql.Int, user_id)
      request.input('profile_image', sql.NVarChar, imagePath)
      request.query('UPDATE users SET profile_image = @profile_image WHERE id = @user_id');
    
    res.status(200).json({ message: 'Profile image uploaded', image_url: imagePath });
  } catch (err) {
    console.error('Error updating profile image:', err);
    res.status(500).json({ error: 'Failed to save image path' });
  }
});

module.exports = routes;
