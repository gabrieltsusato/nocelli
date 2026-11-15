const path = require('path');
const { createApp } = require('./src/app');

const port = Number(process.env.PORT) || 3000;
const jwtSecret = process.env.JWT_SECRET || 'nocelli_local_development_secret_2026';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('Configure JWT_SECRET antes de iniciar o servidor em produção.');
}

const app = createApp({
  jwtSecret,
  uploadsDir: path.join(__dirname, 'uploads'),
  publicDir: path.join(__dirname, 'public')
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`[Nocelli Backend] Servidor rodando na porta ${port}`);
  });
}

module.exports = { app };
