const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
console.log("Current server time:", new Date().toISOString());

const admin = require('./firebase');

// Configuring the PostgreSQL connection
// const dbConfig = {
//   user: 'your_username',
//   host: 'localhost',
//   database: 'your_database',
//   password: 'your_password',
//   port: 5432,
// };

const pool = require('./db.js');

app.use(cors());

const userRoutes = require('./routes/userRoutes');
const { log } = require('console');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/device-info', async (req, res) => {
  const {
    platform, model, manufacturer, version, sdkInt,
    device, brand, name, systemVersion, systemName
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO device_info (
        platform, model, manufacturer, version, sdk_int,
        device, brand, name, system_version, system_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        platform, model, manufacturer, version, sdkInt,
        device, brand, name, systemVersion, systemName
      ]
    );
    res.status(200).json({ message: 'Device info saved successfully' });
  } catch (error) {
    console.error('Error inserting device info:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ GET: Get all device info
app.get('/device-info', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM device_info ORDER BY created_at DESC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching device info:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/user/save-token', async (req, res) => {
  const { user_id, fcm_token } = req.body;

  if (!user_id || !fcm_token) {
    return res.status(400).json({ message: 'Missing user_id or fcm_token' });
  }

  try {
    await pool.query(
      'UPDATE users SET fcm_token = $1 WHERE id = $2',
      [fcm_token, user_id]
    );

    res.json({ message: 'Token saved successfully' });
  } catch (err) {
    console.error('Error saving token:', err);
    res.status(500).json({ message: 'Error saving token' });
  }
});

const userSocketMap = {}; 

app.post('/api/updateStatus', async (req, res) => {
  const {message_id, from } = req.body;
  console.log('indho to id -----', from);
  const targetSocket = userSocketMap[from];
  console.log('indho targetsocket id -----', targetSocket);

  if (!message_id) {
    return res.status(400).json({ message: 'Missing sender_id or receiver_id' });
  }

  try {
    await pool.query(
      `UPDATE messages
       SET status = 'delivered'
       WHERE id = $1`,
      [message_id]
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
                                WHEN sender_id < receiver_id THEN 
                                    CAST(sender_id AS TEXT) || '_' || CAST(receiver_id AS TEXT)
                                ELSE 
                                    CAST(receiver_id AS TEXT) || '_' || CAST(sender_id AS TEXT)
                            END
                        ORDER BY sent_at DESC
                    ) AS rn
                FROM messages
                WHERE sender_id = $1 OR receiver_id = $1
            ) AS temp
            JOIN users u 
                ON u.id = CASE 
                            WHEN temp.sender_id = $1 THEN temp.receiver_id 
                            ELSE temp.sender_id 
                        END
            WHERE temp.rn = 1
        ) AS latest_messages
        ORDER BY latest_messages.sent_at DESC;
      `;
      const result = await pool.query(query, [from]);
      console.log(from,result.rows,'latest Messages occur after sending msg');
      io.to(targetSocket).emit('latestMessages', result.rows);
      console.log('yeah its happening');
    }

    res.json({ message: 'Status updated to delivered successfully' });
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ message: 'Error updating status' });
  }
});

app.post('/api/updateStatusToRead', async (req, res) => {
  const {from, to } = req.body;
  console.log('indho to id -----', from);
  const targetSocket = userSocketMap[from];
  console.log('indho targetsocket id -----', targetSocket);

  try {
    await pool.query(
      `UPDATE messages
       SET status = 'read'
       WHERE sender_id = $1 AND receiver_id = $2 AND status != 'read'`,
      [from, to]
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
                                WHEN sender_id < receiver_id THEN 
                                    CAST(sender_id AS TEXT) || '_' || CAST(receiver_id AS TEXT)
                                ELSE 
                                    CAST(receiver_id AS TEXT) || '_' || CAST(sender_id AS TEXT)
                            END
                        ORDER BY sent_at DESC
                    ) AS rn
                FROM messages
                WHERE sender_id = $1 OR receiver_id = $1
            ) AS temp
            JOIN users u 
                ON u.id = CASE 
                            WHEN temp.sender_id = $1 THEN temp.receiver_id 
                            ELSE temp.sender_id 
                        END
            WHERE temp.rn = 1
        ) AS latest_messages
        ORDER BY latest_messages.sent_at DESC;
      `;
      const result = await pool.query(query, [from]);
      console.log(from,result.rows,'latest Messages occur after sending msg');
      io.to(targetSocket).emit('latestMessages', result.rows);
      console.log('yeah its happening');
    }

    res.json({ message: 'Status updated to delivered successfully' });
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ message: 'Error updating status' });
  }
});

app.use('/api/user', userRoutes);

app.get('/', (req, res) => {
  res.send('Hello from ChatApp! 09.44');
});

// Fetch messages between two users
app.get('/messages/:user1/:user2', async (req, res) => {
  const { user1, user2 } = req.params;

  try {
    // Step 1: Update messages from user2 to user1 to 'read'
    await pool.query(
      `UPDATE messages
       SET status = 'read'
       WHERE sender_id = $1 AND receiver_id = $2 AND status != 'read'`,
      [user2, user1]
    );

    // Step 2: Fetch all messages between user1 and user2
    const result = await pool.query(
      `SELECT * FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY sent_at ASC`,
      [user1, user2]
    );

    res.status(200).json(result.rows);
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
      ( SELECT *, ROW_NUMBER() OVER ( PARTITION BY receiver_id ORDER BY sent_at DESC ) AS rn
      FROM messages WHERE sender_id = $1 ) AS temp
    WHERE rn = 1;
  `;
  
  try {
    const result = await pool.query(query, [user1]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Find a user by username
app.get('/find/:user2', async (req, res) => {
  const { user2 } = req.params;
  const query = `SELECT * FROM users WHERE username = $1;`;
  
  try {
    const result = await pool.query(query, [user2]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }
    
    return res.status(200).json({ message: `User: ${user2} found`, result: result.rows });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Find all users
app.get('/findall', async (req, res) => {
  const query = `SELECT * FROM users;`;
  
  try {
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', socket => {
  console.log(`🔌 Connected: ${socket.id}`);

  socket.on('register', async userId => {
    console.log(userId);
    userSocketMap[userId] = socket.id;
    
    try {
      const result = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
      
      if (result.rows.length > 0) {
        await pool.query(
          "UPDATE messages SET status = 'delivered' WHERE receiver_id = $1 AND status = 'sent'",
          [userId]
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
                                  CAST(sender_id AS TEXT) || '_' || CAST(receiver_id AS TEXT)
                              ELSE 
                                  CAST(receiver_id AS TEXT) || '_' || CAST(sender_id AS TEXT)
                          END
                      ORDER BY sent_at DESC
                  ) AS rn
              FROM messages
              WHERE sender_id = $1 OR receiver_id = $1
          ) AS temp
          JOIN users u 
              ON u.id = CASE 
                          WHEN temp.sender_id = $1 THEN temp.receiver_id 
                          ELSE temp.sender_id 
                      END
          WHERE temp.rn = 1
      ) AS latest_messages
      ORDER BY latest_messages.sent_at DESC;
    `;
    
    try {
      const result = await pool.query(query, [senderId]);
      console.log('inside the getlatess messages only',senderId);
      console.log(result.rows);

      socket.emit('latestMessages', result.rows);

      const filteredMessages = result.rows.filter(msg =>
        msg.receiver_id === Number(senderId) &&
        (msg.status === 'delivered' || msg.status === 'sent')
      );

      if (filteredMessages.length > 0){
        for (const msg of filteredMessages) {
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
                                      CAST(sender_id AS TEXT) || '_' || CAST(receiver_id AS TEXT)
                                  ELSE 
                                      CAST(receiver_id AS TEXT) || '_' || CAST(sender_id AS TEXT)
                              END
                          ORDER BY sent_at DESC
                      ) AS rn
                  FROM messages
                  WHERE sender_id = $1 OR receiver_id = $1
              ) AS temp
              JOIN users u 
                  ON u.id = CASE 
                              WHEN temp.sender_id = $1 THEN temp.receiver_id 
                              ELSE temp.sender_id 
                          END
              WHERE temp.rn = 1
          ) AS latest_messages
          ORDER BY latest_messages.sent_at DESC;
        `;
      
        try {
          const latestResult = await pool.query(query, [msg.sender_id]);
      
          const targetSocket = userSocketMap[String(msg.sender_id)];

          if(targetSocket){
            io.to(targetSocket).emit('latestMessages', latestResult.rows);
          }
        } catch (err) {
          console.error(`Error fetching latest messages for sender_id ${msg.sender_id}:`, err);
        }
      }
      
      console.log(filteredMessages,'filtered messsagesss--- ');
      }
    } catch (err) {
      console.error('Error fetching latest messages:', err);
      socket.emit('error', 'Database error');
    }
  });

  socket.on('conversations', async data => {
    const { user1, user2 } = data;

    const targetSocket = userSocketMap[user2];

    try {
      // Step 1: Update messages from user2 to user1 to 'read'
      await pool.query(
        `UPDATE messages
         SET status = 'read'
         WHERE sender_id = $1 AND receiver_id = $2 AND status != 'read'`,
        [user2, user1]
      );

      // Step 2: Fetch all messages between user1 and user2
      const result = await pool.query(
        `SELECT * FROM messages
         WHERE (sender_id = $1 AND receiver_id = $2)
           OR (sender_id = $2 AND receiver_id = $1)
         ORDER BY sent_at ASC`,
        [user1, user2]
      );
      
      socket.emit('conversations', result.rows);
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
                                  WHEN sender_id < receiver_id THEN 
                                      CAST(sender_id AS TEXT) || '_' || CAST(receiver_id AS TEXT)
                                  ELSE 
                                      CAST(receiver_id AS TEXT) || '_' || CAST(sender_id AS TEXT)
                              END
                          ORDER BY sent_at DESC
                      ) AS rn
                  FROM messages
                  WHERE sender_id = $1 OR receiver_id = $1
              ) AS temp
              JOIN users u 
                  ON u.id = CASE 
                              WHEN temp.sender_id = $1 THEN temp.receiver_id 
                              ELSE temp.sender_id 
                          END
              WHERE temp.rn = 1
          ) AS latest_messages
          ORDER BY latest_messages.sent_at DESC;
        `;
        const result = await pool.query(query, [user2]);
        console.log('inside convo on');
        io.to(targetSocket).emit('latestMessages', result.rows);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  });

  socket.on('private_message', async data => {
    const { from, to, message } = data;
    console.log(typeof from, typeof to, typeof message);   
    console.log(from,to,message);
    const targetSocket = userSocketMap[to];
    const senderSocket = userSocketMap[from];

    console.log(userSocketMap, 'userSocketMappppp');

    try {
      const status = targetSocket ? 'delivered' : 'sent';
      const insert = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, message, status)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [from, to, message, status]
      );

      let insertedMessageId = null;

      if (insert.rows && insert.rows.length > 0) {
        insertedMessageId = insert.rows[0].id;
        console.log(insertedMessageId, 'InsertedMessaggeId');
      } else {
        console.error("Insert succeeded but no record returned");
      }

      console.log(from, to, 'latest Messages occur before sending msg');

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
                                  WHEN sender_id < receiver_id THEN 
                                      CAST(sender_id AS TEXT) || '_' || CAST(receiver_id AS TEXT)
                                  ELSE 
                                      CAST(receiver_id AS TEXT) || '_' || CAST(sender_id AS TEXT)
                              END
                          ORDER BY sent_at DESC
                      ) AS rn
                  FROM messages
                  WHERE sender_id = $1 OR receiver_id = $1
              ) AS temp
              JOIN users u 
                  ON u.id = CASE 
                              WHEN temp.sender_id = $1 THEN temp.receiver_id 
                              ELSE temp.sender_id 
                          END
              WHERE temp.rn = 1
          ) AS latest_messages
          ORDER BY latest_messages.sent_at DESC;
        `;
        const result = await pool.query(query, [to]);
        console.log(from,to,result.rows,'latest Messages occur after sending msg');
        io.to(targetSocket).emit('latestMessages', result.rows);
        io.to(targetSocket).emit('private_message', { from, message });
      }
      
      if (!targetSocket) {
        const tokenResult = await pool.query(
          'SELECT fcm_token FROM users WHERE id = $1',
          [to]
        );

        const fcmToken = tokenResult.rows[0]?.fcm_token;

        const fromName = await pool.query(
          'SELECT name, profile_image FROM users WHERE id = $1',
          [from]
        );

        const name = fromName.rows[0]?.name;
        const profile_image = fromName.rows[0]?.profile_image;

        if (fcmToken) {
          const payload = {
            data: {
              title: 'New message from '+ name,
              body: `${message}`,
              icon: 'noti_icon',
              message_id: insertedMessageId?.toString() ?? '',
              profile_image: '',
              sender_id: from?.toString() ?? ''
            },
            token: fcmToken
          };

          try {
            await admin.messaging().send(payload);
            console.log('📩 Push notification sent to offline user.');
          } catch (err) {
            console.error('❌ Error sending push notification:', err);
          }
        }
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
