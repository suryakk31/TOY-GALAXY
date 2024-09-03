// config/passport.js

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user')

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id).then(user => {
        done(null, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3900/auth/google/callback",
    passReqToCallback: true 
}, (req,token, tokenSecret, profile, done) => {
    User.findOne({ googleId: profile.id })
    .then( (user) => {
        if (user) {
            return done(null, user);
            
        } else {
           
            const newUser = new User({
                googleId: profile.id,
                email: profile._json.email,
                firstName: profile.displayName,
              
                image: profile.photos[0].value
            });
            newUser.save().then((user) => {
                return done(null, newUser);
            });
        }
    });
}));
