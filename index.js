const needle = require('needle');
const cheerio = require('cheerio');
const fs = require('fs');
const {promisify} = require('util');

const URL = 'http://www.koleso-razmer.ru/';
const getAsync = promisify(needle.get);

function delayHelper(ms) {
  const d = Date.now() + ms;
  while (Date.now() < d) {};
};

async function getBrands() {
  const res = await getAsync(URL);
  if (res.statusCode !== 200) {
    console.log(`${res.statusCode}:${res.statusMessage}`);
    return []
  }
  const $ = cheerio.load(res.body);
  const brands = $('table.cols5 li a')
    .map(function() {
      return {
        brand: $(this).text(),
        href: $(this).attr('href')
      }
    }).get();
  return brands;
};

async function getModels(brands) {
  return brands.map(async function(brand) {
    delayHelper(5 + Math.random() * 10);
    console.log(Date(), ' - send request')
    const res = await getAsync(URL + brand.href.slice(1));
    if (res.statusCode !== 200) {
      console.log(`${res.statusCode}:${res.statusMessage}`);
      return Object.assign({}, brand, {models: []});
    };
    $ = cheerio.load(res.body);    
    const models = $('table li a')
    .map(function() {
      return {
        model: $(this).text(),
        href: $(this).attr('href')
      }
    }).get();
    return Object.assign({}, brand, {models});
  })
};

// async function saveSizes(brandsWithModels) {

// };

(async function init() {
  const brands = await getBrands();
  console.log(brands)
  const brandsWithModels = await Promise.all(await getModels(brands));
  console.log(brandsWithModels);
})();