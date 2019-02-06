const Bundler = require('parcel-bundler');
const app = require('express')();
const proxy = require('http-proxy-middleware');

app.use('/api', proxy({ target: 'http://localhost:3000/api' }));

const bundler = new Bundler('src/ui/index.html', {});
app.use(bundler.middleware());

app.listen(1234);
