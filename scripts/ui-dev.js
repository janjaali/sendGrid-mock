const Bundler = require('parcel-bundler');
const app = require('express')();
const proxy = require('express-http-proxy');

const bundler = new Bundler('src/ui/index.html', {});

app.use('/api', proxy('http://localhost:3000'));
app.use(bundler.middleware());

app.listen(1234);
