const cheerio = require('cheerio'),
      fs = require('fs'),
      mysql = require('mysql'),
      needle = require('needle'),
      path = require('path'),
      {promisify} = require('util');

//TODO use config
const URL = 'http://www.koleso-razmer.ru/',
      db_option = {
        host: 'localhost',
        user: 'root',
        password: '12345',
        database: 'wheel_sizes',
      };

//промисифицируем
const getAsync = promisify(needle.get),
      checkAccess = promisify(fs.access);

function promisifyAll(exemplar) {
  const proto = Object.getPrototypeOf(exemplar);
  const asyncExemplar = Object.create(exemplar);
  for (let prop in proto) {
    if (typeof proto[prop] === 'function') {
      asyncExemplar[`${prop}Async`] = promisify(proto[prop]);
    }
  };
  return asyncExemplar;
};
const connect = mysql.createConnection(db_option),
      aConnect = promisifyAll(connect);
      aConnect.q = async function(query) {
        console.log(query);
        return this.queryAsync(query);
      };

function delayHelper(ms) {
  // const d = Date.now() + ms;
  // while (Date.now() < d) {};
  return new Promise((res, rej) => {
    setTimeout(res, ms)
  });
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
    // delayHelper(50 + Math.random() * 100);
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

/*строки таблицы парсятся в массив вида
  [год, размер диска, вылет диска, сверловка, размер шин, версия]
  ф-ия возвращает двумерный массив*/
function pageParser(tablePage) {
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

///
class Sql {
  constructor(tableName) {
    this.tableName = tableName;
    this.id = 0;
  }

  createTable() {
    return `CREATE TABLE IF NOT EXISTS ${this.tableName} (` +
      'id INT, ' +
      'brand VARCHAR(255), ' +
      'model VARCHAR(255), ' +
      'year YEAR, ' +
      'disk_size VARCHAR(255), ' +
      'departure INT,' +
      'drill VARCHAR(255), ' +
      'tire_size VARCHAR(255), ' +
      'version VARCHAR(255), ' +
      'PRIMARY KEY (id))';
  }

  insertRow(model, paramsArray) {
    this.id++;
    return `INSERT INTO ${this.tableName} ` +
      '(id, brand, model, year, disk_size, departure, drill, tire_size, version) ' +
      `VALUES (${this.id}, "${this.tableName}", "${model}", ${paramsArray[0] || ""}, ` +
      `"${paramsArray[1] || ""}", ${paramsArray[2] || 0}, "${paramsArray[3] || ""}", "${paramsArray[4] || ""}", "${paramsArray[5] || ""}")`
  }
}

class Brand extends Sql {
  constructor(_name) {
    const name = _name.trim().replace(/\s|-/gm, '_');
    super(name);
    this.name = name;
  }
};

async function init() {
  // try {
    await aConnect.q('CREATE DATABASE IF NOT EXISTS wheel_sizes');
    const brands = await getBrands();
    console.log('brands > ', brands);
    const brandsWithModels = await Promise.all(await getModels(brands));
    console.log('brandsWithModels > ', brandsWithModels);

    await aConnect.connectAsync;
    //создаём таблицы
    await Promise.all(brandsWithModels.map(async function(brandInfo) {
      const brand = new Brand(brandInfo.brand);
      return aConnect.q(brand.createTable());
    }));
    //заполняем таблицы
    function insertSizes(brand, model, paramsArray) {
      let chain = Promise.resolve();
      paramsArray.forEach(function(params) {
        chain = chain
          .then(() => aConnect.q(brand.insertRow(model, params)));
      });
      return chain;
    }

    function getSizes(brandInfo) {
      const brand = new Brand(brandInfo.brand);
      let chain = Promise.resolve();
      brandInfo.models.forEach(function(modelInfo) {
        chain = chain
          .then(() => getAsync(URL + modelInfo.href.slice(1)))
          .then(function (res) {
            if (res.statusCode !== 200) {
              console.log(`${res.statusCode}:${res.statusMessage}_${URL + modelInfo.href.slice(1)}`);
              throw new Error(res.statusMessage)
            }
            return pageParser(res.body);
          })
          .then((paramsArray) => insertSizes(brand, modelInfo.model, paramsArray))
          .catch(err => console.log(err));
      });
      return chain;
    };

    let chain = Promise.resolve();
    

    brandsWithModels.forEach(function (brandInfo, index) {
      chain = chain
        .then(() => getSizes(brandInfo))
    });

    chain.then(() => {
      console.log('OK');
      aConnect.destroy();
    });

};

async function test() {
  fs.readFile('./table-example.html', 'utf-8', (err, data) => {
    if (err) throw err;
    console.log(pageParser(data));
  })
};

test();