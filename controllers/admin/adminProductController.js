const Category = require('../../models/category');
const Product = require('../../models/product'); 
const path = require('path');
const fs = require('fs');

exports.getProductpage = async (req, res) => {
  try {
    const perPage = 10;
    const page = req.query.page || 1;

    const skip = (perPage * page) - perPage;
    const products = await Product.find()
    .sort({ createdAt: -1 })
      .populate('category')
      .skip(skip)
      .limit(perPage);

    const count = await Product.countDocuments();

    res.render('admin/products', {
      products,
      showDescription: false,
      current: 1,
      pages: 1
      
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
};


exports.addProductpage = async (req, res) => {
  try {
    const categories = await Category.find();
    res.render('admin/addProduct', { 
      categories,
      errorMessage: req.flash('errorMessage'),
      successMessage: req.flash('successMessage')
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

exports.postAddProductpage = async (req, res) => {
  try {
    const { item, category, price, description, stock, discount } = req.body;
    
    const existingProduct = await Product.findOne({ name: { $regex: new RegExp(`^${item}$`, 'i') }});
    
    if (existingProduct) {
      req.flash('errorMessage', 'A product with this name already exists');
      return res.redirect('/admin/products/addproduct');
    }

    const images = req.files.map(file => `/uploads/${file.filename}`);
    const newProduct = new Product({
      name: item,
      category,
      price,
      description,
      stock: parseInt(stock),
      discount,
      image: images,
    });

    await newProduct.save();
    req.flash('successMessage', 'Product added successfully');
    res.redirect('/admin/products');
  } catch (error) {
    req.flash('errorMessage', error.message);
    res.redirect('/admin/products/addproduct');
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

    res.render('admin/editProduct', {
      product,
      categories,
      errorMessage: req.flash('errorMessage'),
      successMessage: req.flash('successMessage')
    });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, description, price, category, stock, deletedImages } = req.body;
    
    let errors = [];


      const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }


    if (!name || name.trim().length < 3 || name.trim().length > 50) {
      errors.push('Product name must be between 3 and 50 characters.');
    }
    if (!/^[a-zA-Z0-9\s-]+$/.test(name)) {
      errors.push('Product name can only contain letters, numbers, spaces, and hyphens.');
    }


    if (name && name.trim()) {
      const existingProduct = await Product.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: productId }
      });
      
      if (existingProduct) {
        errors.push('A product with this name already exists.');
      }
    }


    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      errors.push('Price must be a positive number.');
    }

    const stockNum = parseInt(stock);
    if (isNaN(stockNum) || stockNum < 0) {
      errors.push('Stock must be a non-negative number.');
    }


    if (!description || description.trim().length < 10 || description.trim().length > 5000) {
      errors.push('Description must be between 10 and 5000 characters.');
    }

    if (!category) {
      errors.push('Category is required.');
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    let updatedImages = [...existingProduct.image];


    if (deletedImages) {
      const imagesToDelete = JSON.parse(deletedImages);
      updatedImages = updatedImages.filter(img => !imagesToDelete.includes(img));
      
      
      imagesToDelete.forEach(async (imagePath) => {
        try {
         
          const filename = imagePath.split('/').pop(); 
          const filePath = path.join(__dirname, '..', '..', 'uploads', filename);
          
         
          
          if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        
          } else {
           
          }
        } catch (err) {
          console.error('Error deleting image file:', err);
        }
      });
    }


    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => `/uploads/${file.filename}`);
      updatedImages = [...updatedImages, ...newImages];
    }

    
    if (updatedImages.length === 0) {
      return res.status(400).json({ 
        success: false, 
        errors: ['Product must have at least one image'] 
      });
    }

    const updates = {
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      category,
      stock: parseInt(stock),
      image: updatedImages
    };

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updates,
      { new: true }
    );

    if (updatedProduct) {
      res.status(200).json({ success: true, product: updatedProduct });
    } else {
      res.status(404).json({ success: false, message: 'Product not found' });
    }

  } catch (error) {
    console.error('Error during product update:', error);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred while updating the product' 
    });
  }
};