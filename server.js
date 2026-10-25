process.env.TZ = process.env.TZ || 'Africa/Abidjan';
const path = require('path');
const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { init } = require('./src/db');
const { auth } = require('./src/util');

const app = express();
app.set('trust proxy', 1);
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

app.use('/api', require('./src/routes/auth'));
app.use('/api', auth, require('./src/routes/stock'));
app.use('/api', auth, require('./src/routes/ventes'));
app.use('/api', auth, require('./src/routes/creances'));
app.use('/api', auth, require('./src/routes/caisse'));
app.use('/api', auth, require('./src/routes/stats'));
app.use('/api/admin', auth, require('./src/routes/admin'));
app.use('/api/data', auth, require('./src/routes/data'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue' }));

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', setHeaders: (res, p) => { if (p.endsWith('.html') || p.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache'); } }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ LE REPOS DU FORESTIER démarré sur le port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Erreur lors de l’initialisation de la base de données :', err);
    process.exit(1);
  });