const { stripVTControlCharacters } = require('node:util');

function serverFailure(stderr, code, signal) {
  const lines = stripVTControlCharacters(stderr).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const cause = lines.find(line => /^(?:\w*Error|Error)\b/.test(line))
    || lines.find(line => /EADDRINUSE|ERR_|ENOENT|EACCES/.test(line));
  const runtime = lines.find(line => /^Node\.js v\d/.test(line));
  const detail = (cause || lines.slice(-3).join(' ') || 'No error output was reported.').slice(0,700);
  const hint = /EADDRINUSE/.test(stderr)
    ? 'Choose another PORT / ADMIN_PORT, or close the conflicting server.'
    : /node:sqlite/.test(stderr) && /export named ['"]backup['"]/.test(stderr)
      ? 'Update and rebuild the game, or select Node.js 22.16 or newer through NODE_BINARY for this older server build.'
      : /node:sqlite|ERR_UNKNOWN_BUILTIN_MODULE/.test(stderr)
      ? 'Check the selected Node runtime. Use Node.js 22.13 or newer with this game revision; NODE_BINARY can select another installation.'
      : 'Check the server error below and retry after correcting it.';
  return `The game server stopped (${signal ? 'signal '+signal : 'exit '+(code ?? 'unknown')}). ${hint}\n${detail}${runtime ? '\n'+runtime : ''}`;
}

module.exports = { serverFailure };
