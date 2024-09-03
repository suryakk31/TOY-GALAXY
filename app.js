const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes')
const authRoutes = require('./routes/auth');
const flash = require('connect-flash')
const noCache = require('nocache')

dotenv.config();

const app = express();

app.use(express.urlencoded({ extended: true })); 

// Database connection
mongoose.connect('mongodb://localhost/Kids_Kastle', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));




app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie:{secure:false}
}));


app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());
app.use(flash());
app.use(noCache())

app.use('/',userRoutes)

app.use('/auth', authRoutes);

app.use('/auth',userRoutes)

app.use('/admin', adminRoutes);




app.use(flash())




app.listen(3900, () => {
    console.log('http://localhost:3900');
});
