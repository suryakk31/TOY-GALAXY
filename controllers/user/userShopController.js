const Product = require('../../models/product');
const User = require('../../models/user');
const Category = require('../../models/category');

exports.getShopPage = async (req, res) => {
  try {
    const isLoggedIn = !!req.session.email;
    let userDatabase = null;

    if (isLoggedIn) {
      userDatabase = await User.findOne({ email: req.session.email });

      if (userDatabase.isBlocked) {
        req.session.destroy();
        return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
      }
    }

    const categories = await Category.find({ isBlocked: false });

    let filters = req.query.filter ? req.query.filter.split(',') : [];
    let search = req.query.search || '';
    let categoryIds = req.query.category ? req.query.category.split(',') : [];

    let filterCriteria = { isBlocked: false };

    if (search) {
      filterCriteria.name = new RegExp(search, 'i');
    }

    if (categoryIds.length > 0) {
      filterCriteria.category = { $in: categoryIds };
    }

    let sortCriteria = {};

    filters.forEach(filter => {
      switch (filter) {
        case 'popularity':
          sortCriteria.popularity = -1;
          break;
        case 'price-asc':
          sortCriteria.price = 1;
          break;
        case 'price-desc':
          sortCriteria.price = -1;
          break;
        case 'ratings':
          sortCriteria.ratings = -1;
          break;
        case 'featured':
          filterCriteria.isFeatured = true;
          break;
        case 'new-arrivals':
          sortCriteria.createdAt = -1;
          break;
        case 'a-z':
          sortCriteria.name = 1;
          break;
        case 'z-a':
          sortCriteria.name = -1;
          break;
        default:
          // No specific sorting
      }
    });

    const products = await Product.find(filterCriteria).sort(sortCriteria);

    res.render('user/shop', {
      products,
      userDatabase,
      categories,
      isLoggedIn
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};

