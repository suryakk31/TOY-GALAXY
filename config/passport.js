const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');
const Wallet = require('../models/wallet')
const Wishlist = require('../models/wishlist')

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
    callbackURL: "http://localhost:3000/auth/google/callback",
    // "http://thetoygalaxy.shop/auth/google/callback",
    passReqToCallback: true 
}, async (req, token, tokenSecret, profile, done) => {
    try {
      
        let user = await User.findOne({ googleId: profile.id });
        
        if (user) {
            return done(null, user);
        }
        
       
        user = await User.findOne({ email: profile._json.email });
        
        if (user) {
        
            return done(null, false, { message: 'An account with this email already exists. Please log in with your email and password.' });
        }
        
      
        const newUser = new User({
            googleId: profile.id,
            email: profile._json.email,
            firstName: profile.displayName,
            image: profile.photos[0].value
        });

        await newUser.generateReferralCode();

        const newUserWallet = new Wallet({
            userId: newUser._id,
            balance: 0,
            transactions: []
        });

        const newUserWishlist = new Wishlist({
            userId: newUser._id,
            items: []
        });
        await Promise.all([
            newUser.save(),
            newUserWallet.save(),
            newUserWishlist.save()
        ]);
        return done(null, newUser);
    } catch (error) {
        return done(error);
    }
}));