const userModel = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.uploadProfileImage = (req, res) => {
    const user_id = req.user.user_id;
  
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/profiles/${req.file.filename}`;
  
    userModel.updateProfile(user_id, { profile_image: imageUrl }, (err, result) => {
      if (err) return res.status(500).json({ error: 'Failed to update profile image' });
  
      return res.json({
        message: 'Image uploaded successfully',
        image_url: imageUrl
      });
    });
};

exports.getProfileUser = async (req, res) => {
    const user_id = req.user.user_id;
    userModel.getProfileData(user_id, (err, results) => {
        if (err) return res.status(500).json({ error: 'Error Getting Profile Data' });

        if (results.length > 0) {
            console.log("Profile Fetched and the details are");
            console.log(results[0]);
            return res.status(200).json({results: results[0]});
        }
    });
};

exports.updateProfileUser = async (req, res) => {
    const user_id = req.user.user_id;
    console.log('inside the update controller');
    console.log(user_id);
    let { name, email, username, phone_number, is_online, status_message } = req.body;

    try {
        // Convert is_online to boolean
        if (is_online !== undefined) {
            is_online = Boolean(is_online);
        }

        // 1. Check user exists
        userModel.getProfileData(user_id, async (err, results) => {
            console.log(results);
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!Array.isArray(results) || results.length === 0) {
                return res.status(401).json({ error: `User not exists` });
            }

            // 2. Check duplicate fields
            const fieldsToCheck = { email, username, phone_number };
            userModel.checkDuplicateFields(user_id, fieldsToCheck, async (err, duplicates) => {
                if (err) return res.status(500).json({ error: 'Database error' });

                if (duplicates.length > 0) {
                    const duplicateKeys = duplicates.map(d => {
                        if (d.email === email) return 'email';
                        if (d.username === username) return 'username';
                        if (d.phone_number === phone_number) return 'phone_number';
                    }).filter(Boolean);

                    return res.status(409).json({
                        error: `The following fields are already in use: ${duplicateKeys.join(', ')}`,
                    });
                }

                // 3. Update fields
                const fieldsToUpdate = { name, email, username, phone_number, is_online, status_message };
                userModel.updateProfile(user_id, fieldsToUpdate, (err, result) => {
                    if (err) return res.status(500).json({ error: 'Failed to update user profile' });
                    return res.status(200).json({ message: 'User profile updated successfully' });
                });
            });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
};

exports.registerUser = async (req, res) => {
    const {username, password, name} = req.body;

    if (!name || !username || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    userModel.checkUserExists(username, (err, results) => {
        if(err){
            return res.status(500).send('error');
        }
        
        if(results.length>0){
            const duplicateFields = [];
            results.forEach(user => {
                if (user.username === username) duplicateFields.push('username');
            });
            return res.status(409).json({ error: `${duplicateFields.join(', ')} already exists` });
        }

        bcrypt.hash(password, 10, (err, password_hash) => {
            if (err) {
                return res.status(500).send('Password hashing failed');
            }
        
            userModel.register({name, username, password_hash}, (err, results) => {
                if (err) {
                    return res.status(500).send(err);
                }
                return res.json({message: "Registered Successfully"});
            });
        });
    });
}

exports.loginUser = async (req, res) => {
    const {username, password} = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    userModel.checkUserExists(username, (err, results) => {
        if(err){
            return res.status(500);
        }

        if(results.length==0){
            return res.status(401).json({ error: `User not exists`});
        }

        const user_id = results[0].id;

        bcrypt.compare(password, results[0].password_hash, (err, isMatch) => {
            if(err){
                return res.status(500);
            }

            if(!isMatch){
                return res.status(401).json({ error: 'Incorrect password' });
            }

            const token = generateAuthToken(results[0].username, user_id);
            
            if(!token){
                return res.status(403).json({ error: 'Token is Missing' });
            }

            userModel.updateToken(user_id, token, (err, results) => {
                if(err){
                    return res.status(403).json({ error: 'Failed to update Token to table' });
                }

                console.log(results);
                return res.json({ message: 'Login successful', token: token, user_id: user_id});
            });
        });
    });
}

function generateAuthToken(username, user_id) {
    const payload = {username, user_id};
    const secretKey = 'your_secret_key';
    const token = jwt.sign(payload, secretKey);
    return token;
}