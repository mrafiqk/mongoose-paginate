var Promise = require('bluebird');

/**
 * @param {Object}              [query={}]
 * @param {Object}              [options={}]
 * @param {Object|String}         [options.select]
 * @param {Object|String}         [options.sort]
 * @param {Array|Object|String}   [options.populate]
 * @param {Boolean}               [options.lean=false]
 * @param {Boolean}               [options.leanWithId=true]
 * @param {Number}                [options.offset=0] - Use offset or page to set skip position
 * @param {Number}                [options.page=1]
 * @param {Number}                [options.limit=10]
 * @param {Function}            [callback]
 *
 * @returns {Promise}
 */
function paginate(query, options, callback) {
    query   = query || {};

    options = Object.assign({}, paginate.options, options);

    var select     = options.select;
    var sort       = options.sort;
    var populate   = options.populate;
    var lean       = options.lean || false;
    var leanWithId = options.hasOwnProperty('leanWithId') ? options.leanWithId : true;

    var limit = options.hasOwnProperty('limit') ? options.limit : 10;
    var skip, offset, page;
    if (options.hasOwnProperty('offset') && options.offset) {
        offset = options.offset;
        skip   = offset;
    } else if (options.hasOwnProperty('page') && options.page) {
        page = options.page;
        skip = (page - 1) * limit;
    } else {
        offset = 0;
        page   = 1;
        skip   = offset;
    }

    var promises = {
        docs:  Promise.resolve([]),
    };
    let idx = 1;
    if(options.aggregate === true) {
      let pagingQuery = []
      let hasNextQuery = []
      let flag = true;
      for(let i in query) {
        pagingQuery.push(query[i]);
        hasNextQuery.push(query[i]);
        if(query[i]['$match'] && flag) {
          pagingQuery = pagingQuery.concat([(sort ? { $sort: sort } : null), {$skip: skip}, {$limit: (limit)}].filter((el) => { return el != null }));
          hasNextQuery = hasNextQuery.concat([(sort ? { $sort: sort } : null), {$skip: skip}, {$limit: (limit + 1)}].filter((el) => { return el != null }));
          idx = parseInt(i) + 2;
          flag = false;
        }
      }
      query = pagingQuery;
      promises.hasNext = this.aggregate(hasNextQuery).exec();
    } else {
      promises.count = this.count(query).exec();
    }

    if (limit) {
      var query;
      if (options.aggregate === true) {
        query = this.aggregate(query)
      } else {
        query = this.find(query).select(select).lean(lean);
        if (sort) {
          query = query.sort(sort)
        }
        query = query.skip(skip).limit(limit)
      }

        if (populate) {
            [].concat(populate).forEach(function(item) {
                query.populate(item);
            });
        }
        promises.docs = query.exec();

        if (lean && leanWithId) {
            promises.docs = promises.docs.then(function(docs) {
                docs.forEach(function(doc) {
                    doc.id = String(doc._id);
                });

                return docs;
            });
        }
    }

    return Promise.props(promises)
        .then(function(data) {
            var count = Array.isArray(data.count) ? (data.count[0] || { count: 0 }) :  data;
            var result = {
                docs:  data.docs,
                total: count.count,
                limit: limit
            };

            if (offset !== undefined) {
                result.offset = offset;
            }

            if (data.hasNext) {
              result.hasNext = data.hasNext.length > limit ? true : false;
            }

            if (page !== undefined) {
                result.page  = parseInt(page || 1);
                if(result.total)
                  result.pages = parseInt(Math.ceil(result.total / limit) || 1);
            }

            return result;
        })
        .asCallback(callback);
}

/**
 * @param {Schema} schema
 */
module.exports = function(schema) {
    schema.statics.paginate = paginate;
};

module.exports.paginate = paginate;
