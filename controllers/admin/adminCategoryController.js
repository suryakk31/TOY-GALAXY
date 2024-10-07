const Category = require('../../models/category');
const Product = require('../../models/product')



exports.getCategories = async (req, res) => {
  try {
    const perPage = 10; 
    const page = req.query.page || 1;

 
    const skip = (perPage * page) - perPage;
    const categories = await Category.find()
      .skip(skip)
      .limit(perPage);

    const count = await Category.countDocuments();
    res.render('admin/category', {
      categories,
      current: parseInt(page),
      pages: Math.ceil(count / perPage),
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};






exports.addCategory = (req, res) => {
  res.render('admin/addCategory', {
    errorMessage: req.flash('errorMessage'),
    successMessage: req.flash('successMessage')
  });
};

exports.postAddCategoryPage = async (req, res) => {
  try {
    const { name, description, offer } = req.body;

    let errors = [];

    if (!name || name.trim().length < 3 || name.trim().length > 50) {
      errors.push('Category name must be between 3 and 50 characters.');
    }
    if (!/^[a-zA-Z0-9\s-]+$/.test(name)) {
      errors.push('Category name can only contain letters, numbers, spaces, and hyphens.');
    }

 
    if (offer !== undefined && offer !== '') {
      const offerNum = parseFloat(offer);
      if (isNaN(offerNum) || offerNum < 0 || offerNum > 100) {
        errors.push('Offer must be a number between 0 and 100.');
      }
    }

   
    if (!description || description.trim().length < 10 || description.trim().length > 500) {
      errors.push('Description must be between 10 and 500 characters.');
    }

    if (errors.length > 0) {
      req.flash('errorMessage', errors);
      return res.redirect('/admin/category/addCategory');
    }

     const existingCategory = await Category.findOne({ name: { $regex: new RegExp('^' + name.trim() + '$', 'i') } });
    if (existingCategory) {
      req.flash('errorMessage', 'Category already exists');
      return res.redirect('/admin/category/addCategory');
    }

    const newCategory = new Category({
      name: name.trim(),
      description: description.trim(),
      offer: offer ? parseFloat(offer) : 0,
    });

    await newCategory.save();

    req.flash('successMessage', 'Category added successfully');
    res.redirect('/admin/category');
  } catch (error) {
    console.error('Error adding category:', error);
    req.flash('errorMessage', 'An error occurred while adding the category');
    res.redirect('/admin/category/addCategory');
  }
};

exports.blockCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).send('Category not found');
    }

    category.isBlocked = !category.isBlocked;
    await category.save();
    await Product.updateMany({ category: categoryId }, { isBlocked: category.isBlocked });


    res.redirect('/admin/category');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};




exports.editCategory = async(req,res) => {
  const categoryId = req.params.id;
  try {
    const category = await Category.findById(categoryId);
    
    if(!category) {
      res.staus(404).send('internal server error')
    }
    res.render('admin/editCategory',{category})
  }catch {
     console.log(error)
  }

}

exports.updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { name, description, offer } = req.body;
    

    let errors = [];

    if (!name || name.trim().length < 3 || name.trim().length > 50) {
      errors.push('Category name must be between 3 and 50 characters.');
    }
    if (!/^[a-zA-Z0-9\s-]+$/.test(name)) {
      errors.push('Category name can only contain letters, numbers, spaces, and hyphens.');
    }


    if (name && name.trim()) {
      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: categoryId }
      });
      
      if (existingCategory) {
        errors.push('A category with this name already exists.');
      }
    }

    if (offer !== undefined && offer !== '') {
      const offerNum = parseFloat(offer);
      if (isNaN(offerNum) || offerNum < 0 || offerNum > 100) {
        errors.push('Offer must be a number between 0 and 100.');
      }
    }

    if (!description || description.trim().length < 10 || description.trim().length > 500) {
      errors.push('Description must be between 10 and 500 characters.');
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const updates = {
      name: name.trim(),
      description: description.trim(),
      offer: offer ? parseFloat(offer) : 0,
    };

    const updatedCategory = await Category.findByIdAndUpdate(categoryId, updates, { new: true });

    if (updatedCategory) {
      res.status(200).json({ success: true, category: updatedCategory });
    } else {
      res.status(404).json({ success: false, message: 'Category not found' });
    }
  } catch (error) {
    console.error('Error during category update:', error);
    res.status(500).json({ success: false, message: 'An error occurred while updating the category' });
  }
};
