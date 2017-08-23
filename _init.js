const fs = require('fs');
const parse = require('./index.js').parse;

function init() {
  fs.mkdir('./results', () => {
    parse();
  })
};

init();
