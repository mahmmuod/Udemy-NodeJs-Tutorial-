const Tour = require('./../models/tourModels');
const APIFeatures = require('./../utils/apiFeatures.');
// const tours = JSON.parse(fs.readFileSync(`${__dirname}/../dev-data/data/tours-simple.json`));
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/AppError');

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

exports.getAllTours = catchAsync(async (req, res, next) => {
  try {
    //BUILD QUERY
    /*// 1A) Filtering
        const queryObj = {...req.query};
        const excludeFields = ['page', 'sort', 'limit', 'fields'];
        excludeFields.forEach(el => delete queryObj[el]);
        //console.log(req.query, queryObj);

        // 2) Advanced filtering
        let queryStr = JSON.stringify(queryObj);
        queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);//get, gt, lte, lt

        let query = Tour.find(JSON.parse(queryStr));
*/
    // // 1B) SORTING
    // if (req.query.sort) {
    //     const sortBy = req.query.sort.split(',').join(' ');
    //
    //     query = query.sort(sortBy);
    // } else {
    //     query = query.sort('-createdAt');
    // }
    /* //3) Field Filtering
         if (req.query.fields) {
             const fields = req.query.fields.split(',').join(' ');
             query = query.select(fields);
         } else {
             query = query.select('-__v');
         }*/

    /* // 4) Pagination
         const page = req.query.page * 1 || 1;
         const limit = req.query.limit * 1 || 100;
         const skip = (page - 1) * limit;

         query = query.skip(skip).limit(limit);
         if (req.query.page) {
             const numTours = await Tour.countDocuments();
             if (skip >= numTours) throw new Error('This Page does not exist');
         }*/
    //EXECUTE QUERY
    const features = new APIFeatures(Tour.find(), req.query)
      .filter()
      .sort()
      .limitsFields()
      .paginate();

    const tours = await features.query;

    //SEND RESPONSE
    res.status(200).json({
      status: 'success',
      results: tours.length,
      data: {
        tours
      }
    });
  } catch (e) {
    res.status(404).json({
      status: 'fail',
      message: e
    });
  }
});
exports.getTour = catchAsync(async (req, res, next) => {
  const tour = await Tour.findById(req.params.id).populate({
    path: 'guides',
    select: '-__v -passwordChangedAt'
  });
  if (!tour) {
    return next(new AppError('No tour found with that ID', 404));
  }
  res.status(200).json({
    status: 'success',
    data: {
      tour
    }
  });
});
exports.createTour = catchAsync(async (req, res, next) => {
  const newTour = await Tour.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      tour: newTour
    }
  });
});

exports.updateTour = catchAsync(async (req, res, next) => {
  const tour = await Tour.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!tour) {
    return next(new AppError('No tour found with that ID', 404));
  }
  res.status(200).json({
    status: 'success',
    data: {
      tour
    }
  });
});
exports.deleteTour = catchAsync(async (req, res, next) => {
  const tour = await Tour.findByIdAndDelete(req.params.id);

  if (!tour) {
    return next(new AppError('No tour found with that ID', 404));
  }

  try {
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (e) {
    res.status(404).json({
      status: 'fail',
      data: e
    });
  }
});

exports.getTourStats = catchAsync(async (req, res, next) => {
  try {
    const stats = await Tour.aggregate([
      {
        $match: { ratingsAverage: { $gte: 3 } }
      },
      {
        $group: {
          _id: { $toUpper: '$difficulty' },
          // _id: '$ratingsAverage',
          numTours: { $sum: 1 },
          numRatings: { $sum: '$ratingsQuantity' },
          avgRating: { $avg: '$ratingsAverage' },
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        }
      },
      {
        $sort: { avgPrice: 1 }
      }
      // ,
      // {
      //     $match: { _id: { $ne: 'EASY' } }
      // }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        stats
      }
    });
  } catch (e) {
    res.status(404).json({
      status: 'fail',
      data: e
    });
  }
});

exports.getMontlyPlan = catchAsync(async (req, res, next) => {
  try {
    const year = req.params.year * 1; //2021
    const plan = await Tour.aggregate([
      {
        $unwind: '$startDates'
      },
      {
        $match: {
          startDates: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`)
          }
        }
      },
      {
        $group: {
          _id: { $month: '$startDates' },
          numTourStarts: { $sum: 1 },
          tours: { $push: '$name' }
        }
      },
      {
        $addFields: { month: '$_id' }
      },
      {
        $project: {
          _id: 0
        }
      },
      {
        $sort: { numToursStarts: -1 }
      },
      {
        $limit: 12
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        plan
      }
    });
  } catch (e) {
    res.status(404).json({
      status: 'fail',
      data: e
    });
  }
});
