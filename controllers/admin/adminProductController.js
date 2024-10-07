const Category = require('../../models/category');
const Product = require('../../models/product'); 

exports.getProductpage = async (req, res) => {
  try {
    const products = await Product.find().populate('category'); 
    const showDescription = false;
    res.render('admin/products', { products, showDescription }); 
    
  } catch (error) {
    res.status(500).send(error.message); 
  }
};


exports.addProductpage = async (req, res) => {
  try {
    const categories = await Category.find(); 
    res.render('admin/addProduct', { categories }); 
  } catch (error) {
    res.status(500).send(error.message); 
  }
};



exports.postAddProductpage = async (req, res) => {
  try {
    const { item, category, price, description, stock, discount } = req.body;
    const images = req.files.map(file => `/uploads/${file.filename}`);
    const newProduct = new Product({
      name: item,
      category,
      price,
      description,
      stock: parseInt(stock),
      discount,
      image:images,
    });

    await newProduct.save();
    res.redirect('/admin/products');
  } catch (error) {
    res.status(500).send(error.message); 
  }
};


exports.blockProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).send('Product not found');
    }

    product.isBlocked = !product.isBlocked;
    await product.save();

    res.redirect('/admin/products');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};




exports.getEditProductPage = async (req, res) => {
  const productId = req.params.id;

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send({ success: false, message: 'Product not found.' });
    }


    const categories = await Category.find();


    res.render('admin/editProduct', { product, categories });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};



exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const updates = req.body;

    if (req.files && req.files.length > 0) {
      updates.image = req.files.map(file => `/uploads/${file.filename}`);
    }

    await Product.findByIdAndUpdate(productId, updates, { new: true });
    res.status(200).json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred while updating the product' });
  }
};



