const mongoose = require('mongoose')
const Product = require('../../models/product');
const User = require('../../models/user');
const Category = require('../../models/category');
const Wishlist = require('../../models/wishlist'); 

exports.getShopPage = async (req, res) => {
  try {
    const isLoggedIn = !!req.session.email;
    let userDatabase = null;
    let userWishlist = [];

    const ITEMS_PER_PAGE = 12;
    const page = parseInt(req.query.page) || 1;
  
    if (isLoggedIn) {
      userDatabase = await User.findOne({ email: req.session.email });

      if (userDatabase.isBlocked) {
        req.session.destroy();
        return res.render('auth/login', { errorMessage: 'Your account has been blocked. Please contact support.' });
      }
      const wishlist = await Wishlist.findOne({ userId: userDatabase._id });
      userWishlist = wishlist ? wishlist.items : [];
    }

    const categories = await Category.find({ isBlocked: false });

    let search = req.query.search || '';
    let categoryIds = req.query.categories ? req.query.categories.split(',').filter(id => id.trim() !== '') : [];
    let priceRanges = req.query.price ? req.query.price.split(',') : [];
    let sort = req.query.sort || '';

    let filterCriteria = { isBlocked: false };

    if (search) {
      filterCriteria.name = new RegExp(search, 'i');
    }

    if (categoryIds.length > 0) {
      const validCategoryIds = categoryIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validCategoryIds.length > 0) {
        filterCriteria.category = { $in: validCategoryIds };
      }
    }

    if (priceRanges.length > 0) {
      let priceCriteria = [];
      priceRanges.forEach(range => {
        const [min, max] = range.split('-').map(Number);
        if (!isNaN(min) && !isNaN(max)) {
          priceCriteria.push({ price: { $gte: min, $lte: max } });
        } else if (!isNaN(min)) {
          priceCriteria.push({ price: { $gte: min } });
        }
      });

      if (priceCriteria.length > 0) {
        filterCriteria.$or = priceCriteria;
      }
    }

    let sortCriteria = {};
    switch (sort) {
      case 'popularity':
        sortCriteria.popularity = -1;
        break;
      case 'price-low-high':
        sortCriteria.price = 1;
        break;
      case 'price-high-low':
        sortCriteria.price = -1;
        break;
      case 'newest':
        sortCriteria.createdAt = -1;
        break;
      default:
        sortCriteria.createdAt = -1;
        break;
    }

 
    const totalProducts = await Product.countDocuments(filterCriteria);
    

    if (totalProducts === 0) {
      return res.render('user/shop', {
        products: [],
        userDatabase,
        categories,
        isLoggedIn,
        userWishlist,
        currentPage: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
        nextPage: 1,
        prevPage: 1,
        lastPage: 1,
        noProductsFound: true,
        appliedFilters: {
          search,
          categoryIds,
          priceRanges,
          sort,
        }
      });
    }

    const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);
   
    const validatedPage = page < 1 ? 1 : (page > totalPages ? totalPages : page);
    const skip = (validatedPage - 1) * ITEMS_PER_PAGE;

    const products = await Product.find(filterCriteria)
      .sort(sortCriteria)
      .populate('category')
      .skip(skip)
      .limit(ITEMS_PER_PAGE);

    const productsWithDiscounts = products.map(product => {
      const discountedPrice = product.price - (product.price * (product.discount || 0) / 100);
      return {
        ...product.toObject(),
        discountedPrice: Math.round(discountedPrice * 100) / 100
      };
    });

    res.render('user/shop', {
      products: productsWithDiscounts,
      userDatabase,
      categories,
      isLoggedIn,
      userWishlist,
      currentPage: validatedPage,
      totalPages,
      hasNextPage: validatedPage < totalPages,
      hasPrevPage: validatedPage > 1,
      nextPage: validatedPage + 1,
      prevPage: validatedPage - 1,
      lastPage: totalPages,
      noProductsFound: false,
      appliedFilters: {
        search,
        categoryIds,
        priceRanges,
        sort,
      }
    });
  } catch (error) {
    res.render('500');
  }
};