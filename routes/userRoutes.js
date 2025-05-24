const express = require('express');
const routes = express.Router();
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');
const multer = require('multer');
const path = require('path');
const { Pool } = require('pg');

const pool = require('../db');

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
        return res.status(400).json({ error: 'No image uploaded' });
    }
    console.log('containing file');
    const user_id = req.user.user_id;
    const imagePath = req.file.path;

    try {
        await pool.query(
            'UPDATE users SET profile_image = $1 WHERE id = $2',
            [imagePath, user_id]
        );
        
        res.status(200).json({ message: 'Profile image uploaded', image_url: imagePath });
    } catch (err) {
        console.error('Error updating profile image:', err);
        res.status(500).json({ error: 'Failed to save image path' });
    }
});

module.exports = routes;