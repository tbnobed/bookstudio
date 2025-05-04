// A simple HTTP server that listens on all interfaces and responds to any request
const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`Received request for ${req.url}`);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Test server running successfully');
});

const PORT = 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on http://0.0.0.0:${PORT}`);
  console.log('Environment variables:');
  console.log(`HOST: ${process.env.HOST}`);
  console.log(`PORT: ${process.env.PORT}`);
});