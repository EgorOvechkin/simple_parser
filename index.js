const cheerio = require('cheerio');
const fs = require('fs');
const needle = require('needle');
const path = require('path');
const {promisify} = require('util');

const getAsync = promisify(needle.get);
const checkAccess = promisify(fs.access);
//TODO config
// const wd = './';
const URL = 'http://www.koleso-razmer.ru/';

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
    delayHelper(50 + Math.random() * 100);
    const res = await getAsync(URL + brand.href.slice(1));
    if (res.statusCode !== 200) {
      console.log(`${res.statusCode}:${res.statusMessage}`);
      return Object.assign({}, brand, {models: []});
    };
    const $ = cheerio.load(res.body);
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

function getTables(models) {

};

/*строки парсятся в массив вида
  [год, размер диска, вылет диска, сверловка, размер шин, версия]
  ф-ия возвращает двумерный массив*/
function tableParser(tablePage) {
  const $ = cheerio.load(tablePage),
        $table = $('#paramstable') || $('table'),
        $tbody = $table.children('tbody'),
        $rows = $tbody.children('tr'),
        result = [];
  //TODO: side effect?
  let currentVersion = ''; 
  $rows.each((index, $tr) => {
    //выбрасываем загаловки
    if (index === 0) return;

    const $tdArray = $($tr).children('td');
    const $contentArray = $tdArray.map((index, $td) => {
      return $($td).text()
        .replace(/купить|перед|зад/igm, '')
        .trim();
    });
    //сохраняем версию во внешнюю преременную
    if ($contentArray.length === 1) {
      currentVersion = $contentArray[0];
      return;
    };
    
    const contentArray = [].slice.call($contentArray);
    contentArray.push(currentVersion);
    result.push(contentArray);
  });
  //к строкам, не содержащим год, добавляем значение из пред. строки
  result.forEach((row, index, array) => {
    if (row.length === 5) {
      row.unshift(array[index - 1][0]);
    }
  })
  return result;
};

(async function init() {
  fs.readFile(path.resolve(__dirname, 'table-example.html'), 'utf-8', (err, data) => {
    if (err) throw err;
    const result = tableParser(data);
    console.dir(result);
  });
  // const brands = await getBrands();
  // console.log(brands)
  // const brandsWithModels = await Promise.all(await getModels(brands));
  // console.log(brandsWithModels);

  // console.log(__dirname);
  // fs.access(path.resolve(__dirname, 'dir1'), fs.constants.F_OK , async (err) => {
  //   if (err) {
  //     return;
  //   }
  //   await fs.mkdir(path.resolve(__dirname, 'dir1'));
  // })

  // console.log(await checkAccess(path.resolve(__dirname, 'dir1')));
  // await fs.mkdir(path.resolve(__dirname, 'dir1'));
  // await fs.mkdir(path.resolve(__dirname, 'dir1'));
})();