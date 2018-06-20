const
  cheerio = require('cheerio'),
  fs = require('fs'),
  needle = require('needle'),
  path = require('path'),
  {promisify} = require('util'),
  //TODO use config
  URL = 'http://www.koleso-razmer.ru',
  db_option = {},
  //промисифицируем
  getAsync = promisify(needle.get),
  checkAccess = promisify(fs.access);

async function getBrands() {
  const res = await getAsync(URL);

  if (res.statusCode !== 200) {
    console.log(`${res.statusCode}:${res.statusMessage}`);
    return [];
  }

  const $ = cheerio.load(res.body);
  const brands = $('table.cols5 li a').map(function() {
    return {
      brand: $(this).text(),
      href: $(this).attr('href')
    }
  }).get();

  return brands;
};

function delay(max = 100) {
  return new Promise(resolve => setTimeout(resolve, ~~(Math.random() * max)));
}

async function getModels(brands) {
  let chain = Promise.resolve();
  brands.forEach((brand, index, brandsArray) => {
    chain = chain
      .then(() => {
        console.log(brand.href);
        return getAsync(URL + brand.href);
      })
      .then(res => {
        if (res.statusCode !== 200) {
          console.log(`${res.statusCode}:${res.statusMessage}`);
          brandsArray[index] = Object.assign({}, brand, {models: []});
          return;
        };

        const $ = cheerio.load(res.body);
        const models = $('table li a').map(function() {
          return {
            model: $(this).text(),
            href: $(this).attr('href')
          }
        }).get();

        brandsArray[index] = Object.assign({}, brand, {models});
      })
  });
  chain
    .then(() => {
      console.log('models>>', brands)
    })
    .catch(error => {
      console.log('ERROR>>>>>>>>>>');
      console.log(error);
    });
};



(async () => {
  const brands = await getBrands();
  console.log('brands', brands);
  getModels(brands);
})();
