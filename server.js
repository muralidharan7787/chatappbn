const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql');
const cors = require('cors');
const app = express();
const db = require('./db');
app.use(cors());

const userDetailsRoutes = require('./routes/userDetailsRoutes');
const loginRoutes = require('./routes/loginRoutes');
const authRoutes = require('./routes/authRoutes');

app.use(express.json());
app.use('/api/login',loginRoutes);
app.use('/api/userDetials',userDetailsRoutes);
app.use('/api/auth',authRoutes);


app.get('/messages/:user1/:user2', (req, res) => {
    const { user1, user2 } = req.params;
    const query = `
      SELECT * FROM messages
      WHERE (sender_id = ? AND receiver_id = ?)
         OR (sender_id = ? AND receiver_id = ?)
      ORDER BY timestamp ASC
    `;
    db.query(query, [user1, user2, user2, user1], (err, results) => {
      if (err) return res.status(500).json({ error: err });
      res.json(results);
    });
  });

  app.get('/conversations/:user1', (req, res) => {
    const { user1} = req.params;
    const query = `
      SELECT *  FROM 
        ( SELECT *, ROW_NUMBER() OVER ( PARTITION BY receiver_id  ORDER BY timestamp DESC ) AS rn
        FROM messages  WHERE sender_id = ?
        ) AS temp
        WHERE rn = 1;
    `;
    db.query(query, [user1], (err, results) => {
      if (err) return res.status(500).json({ error: err });
      res.json(results);
    });
  });

  app.get('/find/:user2', (req, res) => {
    const { user2 } = req.params;
    const query = `select * from users where email = ?;`;
    db.query(query, [user2], (err, results) => {
      if (err) return res.status(500).json({ error: err });
      if(results.length==0){
        return res.status(401).json({message:"User not found"});
      }
      else{
        return res.status(200).json({message:`User:${user2} found`});
      }
      
    });
  });

  app.get('/findall', (req, res) => {
    const query = `select * from users;`;
    db.query(query, (err, results) => {
      if (err) return res.status(500).json({ error: err });
      res.json(results);
      // if(results.length==0){
      //   return res.status(401).json({message:"User not found"});
      // }
      // else{
      //   return res.status(200).json({message:`Users found`});
      // }
      
    });
  });


const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const userSocketMap = {}; // userId -> socket.id

io.on('connection', socket => {
  console.log(`🔌 Connected: ${socket.id}`);

  socket.on('register', userId => {
    userSocketMap[userId] = socket.id;

    // db.query('INSERT IGNORE INTO users (user_id) VALUES (?)', [userId]);
    console.log(`✅ Registered user ${userId} with socket ${socket.id}`);
  });


  socket.on('getLatestMessages', (senderId) => {
    // const query = `
    //   SELECT * FROM (
    //     SELECT *, ROW_NUMBER() OVER (
    //       PARTITION BY receiver_id ORDER BY timestamp DESC
    //     ) AS rn
    //     FROM messages
    //     WHERE sender_id = ?
    //   ) AS temp
    //   WHERE rn = 1

    // `;
    const query = `
        SELECT * FROM (
            SELECT *, 
                ROW_NUMBER() OVER (
                    PARTITION BY 
                        CASE 
                        WHEN sender_id < receiver_id THEN CONCAT(sender_id, '_', receiver_id)
                        ELSE CONCAT(receiver_id, '_', sender_id)
                        END
                    ORDER BY timestamp DESC
                ) AS rn
            FROM messages
            WHERE (sender_id = ? OR receiver_id = ?)
        ) AS temp
        WHERE rn = 1;
    `;

    db.query(query, [senderId,senderId], (err, results) => {
      if (err) {
        console.error('Query error:', err);
        socket.emit('error', 'Database error');
        return;
      }
      // Emit the results to the client
      socket.emit('latestMessages', results);
    });
  });


  socket.on('conversations', data => {
    const { from, to, message } = data;
    const targetSocket = userSocketMap[to];

    // 💾 Store in MySQL
    db.query(
      'INSERT INTO messages (sender_id, receiver_id, message, delivered) VALUES (?, ?, ?, ?)',
      [from, to, message, targetSocket ? 1 : 0]
    );

    // 🔁 Send if recipient is online
    if (targetSocket) {
      io.to(targetSocket).emit('private_message', { from, message });
    }

    console.log(`📨 ${from} ➡️ ${to}: ${message}`);
  });

  socket.on('private_message', data => {
    const { from, to, message } = data;
    const targetSocket = userSocketMap[to];
    const senderSocket = userSocketMap[from];

    // 💾 Store in MySQL
    db.query(
      'INSERT INTO messages (sender_id, receiver_id, message, delivered) VALUES (?, ?, ?, ?)',
      [from, to, message, targetSocket ? 1 : 0]
    );

    // 🔁 Send if recipient is online
    if (targetSocket) {
      const query = `
        SELECT * FROM (
            SELECT *, 
                ROW_NUMBER() OVER (
                    PARTITION BY 
                        CASE 
                        WHEN sender_id < receiver_id THEN CONCAT(sender_id, '_', receiver_id)
                        ELSE CONCAT(receiver_id, '_', sender_id)
                        END
                    ORDER BY timestamp DESC
                ) AS rn
            FROM messages
            WHERE sender_id = 'demo2' OR receiver_id = 'demo2'
        ) AS temp
        WHERE rn = 1;
    `;

    db.query(query, [to], (err, results) => {
      if (err) {
        console.error('Query error:', err);
        socket.emit('error', 'Database error');
        return;
      }
      // Emit the results to the client
      io.to(targetSocket).emit('latestMessages', results);
    });
      io.to(targetSocket).emit('private_message', { from, message });
    }

    console.log(`📨 ${from} ➡️ ${to}: ${message}`);
  });

  socket.on('disconnect', () => {
    const userId = Object.keys(userSocketMap).find(uid => userSocketMap[uid] === socket.id);
    if (userId) {
      delete userSocketMap[userId];
      console.log(`❌ User ${userId} disconnected`);
    }
  });
});

server.listen(3000, () => {
  console.log(`🚀 Server running at http://localhost:${3000}`);
});
