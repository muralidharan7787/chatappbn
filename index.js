const express = require('express');
const app = express();

const userDetailsRoutes = require('./routes/userDetailsRoutes');
const loginRoutes = require('./routes/loginRoutes');
const authRoutes = require('./routes/authRoutes');

app.use(express.json());
app.use('/api/login',loginRoutes);
app.use('/api/userDetials',userDetailsRoutes);
app.use('/api/auth',authRoutes);

app.listen(3000,()=>{
    console.log("server started succesfully");
});
