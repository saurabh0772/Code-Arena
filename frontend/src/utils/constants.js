export const DEFAULT_CPP_TEMPLATE = `#include <iostream>
using namespace std;

int main() {
    // Read input from standard input (cin)
    // Write output to standard output (cout)
    
    return 0;
}
`;

export const DEFAULT_PYTHON_TEMPLATE = `import sys

def main():
    # Read input from standard input
    input_data = sys.stdin.read()
    
    # Write output to standard output
    
if __name__ == '__main__':
    main()
`;

export const DEFAULT_JS_TEMPLATE = `const fs = require('fs');

function main() {
    // Read input from standard input
    const input = fs.readFileSync(0, 'utf-8');
    
    // Write output to standard output
    
}

main();
`;

export const STARTER_TEMPLATES = {
  CPP: DEFAULT_CPP_TEMPLATE,
  PYTHON: DEFAULT_PYTHON_TEMPLATE,
  JAVASCRIPT: DEFAULT_JS_TEMPLATE
};
