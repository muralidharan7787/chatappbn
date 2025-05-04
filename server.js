const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sql = require('mssql');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

// Configuring the MSSQL connection
const dbConfig = require('./db');

app.use(cors());


const userRoutes = require('./routes/userRoutes');

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/user', userRoutes);

app.get('/', (req, res) => {
  res.send('Hello from ChatApp!');
});

// Fetch messages between two users
app.get('/messages/:user1/:user2', async (req, res) => {
  const { user1, user2 } = req.params;

  try {
    // Connect to SQL Server
    let pool = await sql.connect(dbConfig);

    // SQL query to get messages between user1 and user2
    const result = await pool.request()
      .input('user1', sql.Int, user1)
      .input('user2', sql.Int, user2)
      .query(`
        SELECT * FROM messages
        WHERE (sender_id = @user1 AND receiver_id = @user2)
           OR (sender_id = @user2 AND receiver_id = @user1)
        ORDER BY timestamp ASC
      `);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});


// Fetch latest conversations for a user
app.get('/conversations/:user1', async (req, res) => {
  const { user1 } = req.params;
  const query = `
    SELECT * FROM 
      ( SELECT *, ROW_NUMBER() OVER ( PARTITION BY receiver_id ORDER BY timestamp DESC ) AS rn
      FROM messages WHERE sender_id = @user1 ) AS temp
    WHERE rn = 1;
  `;
  
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().input('user1', sql.Int, user1).query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Find a user by username
app.get('/find/:user2', async (req, res) => {
  const { user2 } = req.params;
  const query = `SELECT * FROM users WHERE username = @user2;`;
  
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().input('user2', sql.VarChar, user2).query(query);
    
    if (result.recordset.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }
    
    return res.status(200).json({ message: `User: ${user2} found`, result: result.recordset });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Find all users
app.get('/findall', async (req, res) => {
  const query = `SELECT * FROM users;`;
  
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const userSocketMap = {}; // userId -> socket.id

io.on('connection', socket => {
  console.log(`🔌 Connected: ${socket.id}`);

  socket.on('register', async userId => {
    console.log(userId);
    userSocketMap[userId] = socket.id;
    
    try {
      const pool = await sql.connect(dbConfig);
      
      const result = await pool.request().input('userId', sql.Int, userId).query('SELECT id FROM users WHERE id = @userId');
      
      if (result.recordset.length > 0) {
        await pool.request().input('userId', sql.Int, userId).query(
          "UPDATE messages SET status = 'delivered' WHERE receiver_id = @userId AND status = 'sent'"
        );
      } else {
        console.warn(`⚠️ User ID ${userId} not found in users table.`);
      }
      
      console.log(`✅ Registered user ${userId} with socket ${socket.id}`);
    } catch (err) {
      console.error('Error during registration:', err);
    }
  });

  socket.on('getLatestMessages', async senderId => {
    const query = `
      SELECT *
      FROM (
          SELECT 
              temp.*,
              u.id AS other_user_id,
              u.name AS other_user_name,
              u.profile_image AS other_user_image
          FROM (
              SELECT *, 
                  ROW_NUMBER() OVER (
                      PARTITION BY 
                          CASE 
                              WHEN sender_id < receiver_id THEN 
                                  CAST(sender_id AS VARCHAR) + '_' + CAST(receiver_id AS VARCHAR)
                              ELSE 
                                  CAST(receiver_id AS VARCHAR) + '_' + CAST(sender_id AS VARCHAR)
                          END
                      ORDER BY sent_at DESC
                  ) AS rn
              FROM messages
              WHERE sender_id = @senderId OR receiver_id = @senderId
          ) AS temp
          JOIN users u 
              ON u.id = CASE 
                          WHEN temp.sender_id = @senderId THEN temp.receiver_id 
                          ELSE temp.sender_id 
                      END
          WHERE temp.rn = 1
      ) AS latest_messages
      ORDER BY latest_messages.sent_at DESC;
    `;
    
    try {
      const pool = await sql.connect(dbConfig);
      const result = await pool.request().input('senderId', sql.Int, senderId).query(query);
      socket.emit('latestMessages', result.recordset);
    } catch (err) {
      console.error('Error fetching latest messages:', err);
      socket.emit('error', 'Database error');
    }
  });

  socket.on('conversations', async data => {
    const { from, to, message } = data;
    const targetSocket = userSocketMap[to];

    try {
      const pool = await sql.connect(dbConfig);
      await pool.request().input('from', sql.Int, from).input('to', sql.Int, to).input('message', sql.Text, message).query(
        'INSERT INTO messages (sender_id, receiver_id, message, delivered) VALUES (@from, @to, @message, @delivered)',
        { delivered: targetSocket ? 1 : 0 }
      );

      if (targetSocket) {
        io.to(targetSocket).emit('private_message', { from, message });
      }
      
      console.log(`📨 ${from} ➡️ ${to}: ${message}`);
    } catch (err) {
      console.error('Error handling conversation:', err);
    }
  });

  socket.on('private_message', async data => {
    const { from, to, message } = data;
    const targetSocket = userSocketMap[to];
    const senderSocket = userSocketMap[from];

    try {
      const pool = await sql.connect(dbConfig);
      const status = targetSocket ? 'delivered' : 'sent';
      await pool.request().input('from', sql.Int, from).input('to', sql.Int, to).input('message', sql.Text, message).input('status', sql.VarChar, status).query(
        'INSERT INTO messages (sender_id, receiver_id, message, status) VALUES (@from, @to, @message, @status)'
      );

      if (targetSocket) {
        const query = `
          SELECT *
          FROM (
              SELECT 
                  temp.*,
                  u.id AS other_user_id,
                  u.name AS other_user_name,
                  u.profile_image AS other_user_image
              FROM (
                  SELECT *, 
                      ROW_NUMBER() OVER (
                          PARTITION BY 
                              CASE 
                                  WHEN sender_id < receiver_id THEN CONCAT(sender_id, '_', receiver_id)
                                  ELSE CONCAT(receiver_id, '_', sender_id)
                              END
                          ORDER BY sent_at DESC
                      ) AS rn
                  FROM messages
                  WHERE sender_id = @to OR receiver_id = @to
              ) AS temp
              JOIN users u 
                  ON u.id = IF(temp.sender_id = @to, temp.receiver_id, temp.sender_id)
              WHERE temp.rn = 1
          ) AS latest_messages
          ORDER BY latest_messages.sent_at DESC;
        `;
        
        const result = await pool.request().input('to', sql.Int, to).query(query);
        io.to(targetSocket).emit('latestMessages', result.recordset);
        io.to(targetSocket).emit('private_message', { from, message });
      }
      
    } catch (err) {
      console.error('Error sending private message:', err);
    }
  });

  socket.on('disconnect', () => {
    const userId = Object.keys(userSocketMap).find(uid => userSocketMap[uid] === socket.id);
    if (userId) {
      delete userSocketMap[userId];
      console.log(`❌ User ${userId} disconnected`);
    }
  });
});

server.listen(8080, () => {
  console.log(`🚀 Server running at http://localhost:${8080}`);
});
