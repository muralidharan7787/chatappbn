const db = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

exports.register = async (req, res)=>{
    const {email, password} = req.body;
    db.query('select * from users where email = ?',[email], async (err,results)=>{

        if(err){
            console.log(err);
            return res.status(500).json({message:"something went wrong"});
        }

        if(results.length==1){
            return res.status(409).json({message:"Email already exist"});
        }

        const hashedPassword = await bcrypt.hash(password,10);

        db.query('insert into users(email,password) values (?,?)',[email,hashedPassword],(err,results)=>{
            if(err){
                console.error('Insert error:', err);
                return res.status(500).json({ message: 'Database error during registration' });
            }

            return res.status(201).json({ message: 'User registered succesfully', result: results.insertId });
            
        });
    });
};


exports.login = async (req, res)=>{
    const {email, password} = req.body;
    db.query('select * from users where email= ?',[email], async (err, results)=>{
        if(err){
            console.log(err);
            return res.status(500).json({message:"something went wrong"});
        }
        if(results.length==0){
            return res.status(401).json({message:"User not found"});
        }

        const ismatch = await bcrypt.compare(password,results[0].password);

        if(ismatch){
            console.log(results[0].id);
            const token = generateAuthToken(results[0].id);
            db.query('insert into tokens (user_id, token, updated_at) values(?,?,?)',[results[0].id, token, new Date()], (err,results)=>{
                if(err){
                    console.log(err);
                    return res.status(500).json({message:"something went wrong"});
                }
                if(results.affectedRows>0){
                    console.log('Token updated to the table');
                    return res.status(200).json({message:"Login successfully",token:token});
                }
            });
        }
        else{
            return res.status(401).json({message:"Invalid credentials"});
        }
    });
};

function generateAuthToken(userId) {
    // Define the payload (user data to include in the token)
    const payload = { userId };

    // Define a secret key for signing the token
    const secretKey = 'your_secret_key';  // You should use a secure key here!

    // Define options for the JWT (e.g., expiration)
    // const options = { expiresIn: '1h' };  // Token will expire in 1 hour

    // Create the JWT token
    const token = jwt.sign(payload, secretKey);

    return token;
}