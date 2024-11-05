const User = require('../../models/user');
const Category = require('../../models/category');
const Product = require('../../models/product')
const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});

exports.getLandingPage = async (req, res) => {
    try {
        const isLoggedIn = req.session.email ? true : false;
    

        if (isLoggedIn) {
            
            userDatabase = await User.findOne({ email: req.session.email });
            return res.redirect('/auth/homepage');
        }

     

       
        const categories = await Category.find();

        const products = await Product.find({ isBlocked: false })
        .sort({ updatedAt: -1 })
        .limit(4); 

        const topOfferProducts = await Product.find({ isBlocked: false })
        .sort({ discount: -1 })
        .limit(4);

        res.render('user/homepage', { isLoggedIn, categories, products, topOfferProducts });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};



exports.getHomepage = async (req, res) => {
    try {
        const isLoggedIn = req.session.email ? true : false;
        let userDatabase = null;

        if (isLoggedIn) {
            userDatabase = await User.findOne({ email: req.session.email });

            if (!userDatabase) {
                req.session.destroy();
                return res.render('auth/login', { errorMessage: 'User not found. Please log in again.' });
            }

            if (userDatabase.isBlocked) {
                req.session.destroy(); 
                return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
            }
        }

        const categories = await Category.find({ isBlocked: false });
        
        // Get latest products
        const newProducts = await Product.find({ isBlocked: false })
            .sort({ updatedAt: -1 })
            .limit(4);

        // Get products with highest discounts
        const topOfferProducts = await Product.find({ isBlocked: false })
            .sort({ discount: -1 })
            .limit(4);

        res.render('user/homepage', {
            isLoggedIn, 
            userDatabase, 
            categories, 
            products: newProducts,
            topOfferProducts
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};

exports.getProfilepage = async (req,res) => {
    try { 
        
        const isLoggedIn = req.session.email ? true : false;
        let userDatabase = null;

        if (isLoggedIn) {
            userDatabase = await User.findOne({ email: req.session.email });

            if (userDatabase.isBlocked) {
                req.session.destroy(); 
                return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
            }
        }
        const user = await User.find()
        const categories = await Category.find();
        const products = await Product.find({ isBlocked: false });
         res.render('user/profile',{user, isLoggedIn, categories, products, userDatabase })
    }
    catch {
        console.err(error)
    }
}


exports.updateProfile = async (req, res) => {
    try {
       
        if (!req.session.email) {
            return res.status(400).json({ success: false, message: 'User is not logged in or session has expired.' });
        }

        const { firstName, lastName, email, phone } = req.body;
        console.log("The request.body from the backend function updateProfile",req.body); 
       
        


        const user = await User.findOne({ email: req.session.email });

        if (user) {
            user.firstName = firstName;
            user.lastName = lastName;
            user.email = email;
            user.phone = phone;

            await user.save();

   
            req.session.email = email;

            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


exports.subscribe = async(req,res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
       
        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: '🌟 Welcome to Toy Galaxy - Your Adventure Begins Here! 🚀',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
                    <div style="text-align: center; background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
                        <h1 style="color: #4a4a4a;">Welcome to the Toy Galaxy Universe! 🌟</h1>
                        <p style="font-size: 18px; color: #666;">Where imagination knows no age limit!</p>
                    </div>

                    <div style="margin: 30px 0;">
                        <h2 style="color: #ff6b6b;">🎁 Your Special Welcome Gifts:</h2>
                        <ul style="list-style: none; padding: 0;">
                            <li style="background: #fff3f3; margin: 10px 0; padding: 15px; border-radius: 5px;">
                                <strong style="color: #ff6b6b;">REFFERAL CODE</strong> Login using existing user refferal code to get cashback %.
                            </li>
                            <li style="background: #fff3f3; margin: 10px 0; padding: 15px; border-radius: 5px;">
                                <strong style="color: #ff6b6b;">FREE SHIPPING</strong> on orders above ₹ 500
                            </li>
                        </ul>
                    </div>

                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h2 style="color: #4a4a4a;">🎯 What's Coming Your Way:</h2>
                        
                        <div style="margin: 20px 0;">
                            <h3 style="color: #666;">For Kids 🎮</h3>
                            <ul>
                                <li>Exclusive sneak peeks at upcoming toy releases</li>
                                <li>Fun DIY craft ideas and toy hacks</li>
                                <li>Holiday wish list suggestions</li>
                                <li>Interactive toy guides by age group</li>
                                <li>Educational toy recommendations</li>
                            </ul>
                        </div>

                        <div style="margin: 20px 0;">
                            <h3 style="color: #666;">For Collectors & Adults 🏆</h3>
                            <ul>
                                <li>Limited edition collectible announcements</li>
                                <li>Investment-worthy vintage toy insights</li>
                                <li>Exclusive pre-order opportunities</li>
                                <li>Collector's corner features</li>
                                <li>Special adult LEGO® set releases</li>
                            </ul>
                        </div>

                        <div style="margin: 20px 0;">
                            <h3 style="color: #666;">Special Features 🌈</h3>
                            <ul>
                                <li>Monthly toy unboxing videos</li>
                                <li>Expert reviews and ratings</li>
                                <li>Seasonal buying guides</li>
                                <li>Flash sales alerts</li>
                                <li>Community showcase events</li>
                            </ul>
                        </div>
                    </div>

                    <div style="background-color: #e9ecef; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h2 style="color: #4a4a4a;">🎉 Upcoming Events & Exclusive Offers:</h2>
                        <ul>
                            <li>Monthly toy treasure hunts with prizes</li>
                            <li>Seasonal mystery boxes</li>
                            <li>Member-exclusive shopping events</li>
                            <li>Early access to holiday sales</li>
                            <li>Birthday month special surprises</li>
                        </ul>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="[Your-Store-URL]" 
                           style="background-color: #ff6b6b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                            Start Shopping Now 🛍️
                        </a>
                    </div>

                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h3 style="color: #4a4a4a;">Connect With Us! 🌐</h3>
                        <p>Follow us for daily toy inspiration:</p>
                        <div style="margin: 15px 0;">
                            [Social Media Links]
                        </div>
                    </div>

                    <div style="font-size: 12px; color: #666; margin-top: 20px; text-align: center;">
                        <p>You're receiving this email because you subscribed to Toy Galaxy's newsletter.</p>
                        <p>© ${new Date().getFullYear()} Toy Galaxy. All rights reserved.</p>
                        <p><a href="[Unsubscribe-URL]" style="color: #666;">Unsubscribe</a> | <a href="[Privacy-Policy-URL]" style="color: #666;">Privacy Policy</a></p>
                    </div>
                </div>
            `
        };

        // Send email
        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: 'Subscription successful!' });
    } catch (error) {
        console.error('Subscription error:', error);
        res.status(500).json({ message: 'Failed to subscribe. Please try again.' });
    }
};

