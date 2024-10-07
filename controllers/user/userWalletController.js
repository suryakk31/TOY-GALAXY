const User = require('../../models/user');
const Category = require('../../models/category');
const Product = require('../../models/product');
const Wallet = require('../../models/wallet');
const Razorpay = require('razorpay');
const crypto = require('crypto');

require('dotenv').config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
})

exports.getWallet = async (req, res) => {
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

    if (!userDatabase) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const categories = await Category.find();
    const products = await Product.find({ isBlocked: false });

    // Fetch the wallet for the user
    let wallet = await Wallet.findOne({ userId: userDatabase._id });  
    // If wallet doesn't exist, create a new one
    if (!wallet) {
      const newWallet = new Wallet({ userId: userDatabase._id });
      await newWallet.save();
      wallet = newWallet;  // Now this reassignment is allowed
    }

    res.render('user/wallet', {
      isLoggedIn,        
      categories,          
      userDatabase, 
      products,       
      walletBalance: wallet.balance,
      transactions: wallet.transactions
    });
  } catch (error) {
    console.error('Error fetching wallet data:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};


exports.createRazorPayorder = async (req, res) => {
  try {
    const options = {
      amount: req.body.amount,
      currency: "INR",
      receipt: `wallet_${new Date().getTime()}`
    };
    const order = await razorpay.orders.create(options);
    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create Razorpay order' });
  }
};


exports.updateWallet = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_KEY_SECRET;

    // Create HMAC SHA256 digest for verification
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(req.body.razorpay_order_id + "|" + req.body.razorpay_payment_id);
    const digest = shasum.digest('hex');


    if (digest === req.body.razorpay_signature) {
    
      const email = req.session.email; 
      const user = await User.findOne({ email: email });

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const userId = user._id;
      const amount = req.body.amount;


      let wallet = await Wallet.findOne({ userId: userId });

      if (!wallet) {
        wallet = new Wallet({ userId: userId });
      }

   
      wallet.balance += parseFloat(amount);
      wallet.transactions.push({
        type: 'deposit',
        amount: parseFloat(amount),
        description: 'Added via Razorpay'
      });

      await wallet.save();
      console.log('Wallet updated successfully');

      res.json({ success: true });
    } else {
      console.log('Invalid signature');
      res.status(400).json({ success: false, error: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Error in updateWallet:', error);
    res.status(500).json({ success: false, error: 'Failed to update wallet' });
  }
};

exports.processWalletPayment = async (req, res) => {
  try {
    const { amount } = req.body;
    const isLoggedIn = req.session.email ? true : false;
    let userDatabase = null;

    if (isLoggedIn) {
      userDatabase = await User.findOne({ email: req.session.email });

      if (userDatabase.isBlocked) {
        req.session.destroy();
        return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
      }
    }

    let wallet = await Wallet.findOne({ userId: userDatabase._id });  
  

    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    wallet.balance -= parseFloat(amount);
    wallet.transactions.push({
      type: 'debit',
      amount: parseFloat(amount),
      description: 'Payment for order',
      timestamp: new Date()
    });

    await wallet.save();

    res.json({ success: true, message: 'Payment processed successfully', newBalance: wallet.balance, transactionId: wallet.transactions[wallet.transactions.length - 1]._id });
  } catch (error) {
    console.error('Error processing wallet payment:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
