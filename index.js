const needle = require('needle');
const cheerio = require('cheerio');
const fs = require('fs');

const URL = 'http://www.koleso-razmer.ru/';

function parse() {
  //Get brands
  needle.get(URL, function(err, res) {
    if (err) throw err;
    if (res.statusCode !== 200) {
      console.log(`${res.statusCode}:${res.statusMessage}`);
      return false;
    };
    let $ = cheerio.load(res.body);
    const brands = $('table.cols5 li a')
    .map(function() {
      return {
        brand: $(this).text(),
        href: $(this).attr('href')
      }
    }).get();
    console.log(brands);
    const stream = fs.createWriteStream("./results/brands.txt");
    stream.once('open', () => {
      stream.write(JSON.stringify(brands));
    })
    //Get models
    brands.forEach((brand) => {
      setTimeout(() => {
        needle.get(URL + brand.href.slice(1), function(err, res) {
          if (err) throw err;
          if (res.statusCode !== 200) {
            console.log(`${res.statusCode}:${res.statusMessage}`);
            return false;
          };
          $ = cheerio.load(res.body);    
          brand.models = $('table li a')
          .map(function() {
            return {
              model: $(this).text(),
              href: $(this).attr('href')
            }
          }).get();
          console.log(brand.models);
          const bAndM = fs.createWriteStream("./results/bAndM.txt");
          bAndM.once('open', () => {
            bAndM.write(JSON.stringify(brands));
          })
          const modelStream = fs.createWriteStream(`./results/${brand.brand}.txt`);
          modelStream.once('open', () => {
            modelStream.write(JSON.stringify(brand.models));
          })
        })
      }, Math.random() * 10)
    });
    //Get sizes
    brands.forEach((brand) => {
      fs.mkdir(`./results/${brand.brand}`, function() {
        brand.models.forEach((model) => {
          model.versions = [];
          let currentIndex = 0;
          setTimeout(() => {
            needle.get(URL + model.href.slice(1), function(err, res) {
              if (err) throw err;
              if (res.statusCode !== 200) {
                console.log(`${res.statusCode}:${res.statusMessage}`);
                return false;
              };
              $ = cheerio.load(res.body);
              $('tbody')
            });
          }, Math.random() * 10)
          const sizesStream = fs
          .createWriteStream(`./results/${brand.brand}/${model.model}.txt`);
        })
      });
    })
    stream.close();
    bAndM.close();
    modelStream.close();
    // console.log(res.body);
    // console.log(res.statusCode);
  });
};

module.exports = {
  parse
}