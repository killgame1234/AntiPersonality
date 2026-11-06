/**
 * AddonManager: Base metadata parser and registry for BetterAntigravity Addons (Themes & Plugins).
 * Matches BetterDiscord's docblock metadata specification.
 */

function parseMetadata(content) {
  const meta = {
    name: 'Unnamed Addon',
    author: 'Unknown Author',
    version: '1.0.0',
    description: '',
    source: ''
  };

  const docblockMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
  if (!docblockMatch) return meta;

  const lines = docblockMatch[1].split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/@(\w+)\s+(.+)/);
    if (match) {
      const field = match[1].toLowerCase();
      const value = match[2].trim();
      if (field in meta) {
        meta[field] = value;
      }
    }
  }

  return meta;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseMetadata };
}
