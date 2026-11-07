// production entry point that works on Windows, macOS and Linux
// "NODE_ENV=production node ..." only works in unix shells, so it is set here instead
process.env.NODE_ENV = 'production';

await import('./index.js');
