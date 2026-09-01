const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCodeBlocks } = require('../src/extract-code');

test('parseCodeBlocks extracts fenced code blocks with language and filename', () => {
  const md = `
# Developer Notes

Here is some setup code:

\`\`\`bash:setup.sh
echo "Installing dependencies..."
npm install
\`\`\`

And some python code:

\`\`\`python
def hello():
    print("Hello world")
\`\`\`
`;

  const blocks = parseCodeBlocks(md);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].language, 'bash');
  assert.equal(blocks[0].filename, 'setup.sh');
  assert.equal(blocks[0].code, 'echo "Installing dependencies..."\nnpm install');

  assert.equal(blocks[1].language, 'python');
  assert.equal(blocks[1].filename, '');
  assert.ok(blocks[1].code.includes('print("Hello world")'));
});
