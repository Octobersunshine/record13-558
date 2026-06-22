const express = require('express');
const buildRoutes = require('./routes/build');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/build', buildRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Build API: POST http://localhost:${PORT}/api/build`);
});
