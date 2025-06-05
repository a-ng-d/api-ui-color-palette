![GitHub package.json version](https://img.shields.io/github/package-json/v/a-ng-d/figmug-utils?color=informational) ![GitHub last commit](https://img.shields.io/github/last-commit/a-ng-d/figmug-utils?color=informational) ![GitHub](https://img.shields.io/github/license/a-ng-d/figmug-utils?color=informational)

# Figmug Utils

A collection of lightweight, platform-agnostic utility modules designed to accelerate plugin development. These modules provide common functionalities that can be used across any JavaScript/TypeScript project, making them perfect for plugins, extensions, or any web application.

## Installation

```bash
npm install figmug-utils
# or
yarn add figmug-utils
```

## Available Modules

### Case Transformer

Convert strings between different case formats:

```typescript
import { Case } from 'figmug-utils'

const text = new Case('Hello World Example')
text.doSnakeCase() // 'hello_world_example'
text.doCamelCase() // 'helloWorldExample'
text.doPascalCase() // 'HelloWorldExample'
text.doKebabCase() // 'hello-world-example'
```

### Feature Status

Manage feature flags and access control:

```typescript
import { FeatureStatus } from 'figmug-utils'

const feature = new FeatureStatus({
  features: features,
  featureName: 'PREMIUM_FEATURE',
  planStatus: 'UNPAID',
  suggestion: 'Upgrade to access this feature',
})

if (feature.isBlocked()) {
  console.log(feature.isAvailableAndBlocked()) // 'Upgrade to access this feature'
}
```

### Class Names Utility

Clean conditional class name concatenation:

```typescript
import { doClassnames } from 'figmug-utils'

const classes = doClassnames([
  'button',
  isActive && 'active',
  isPrimary && 'primary',
  undefined,
  null,
]) // Returns: 'button active primary'
```

## Why Figmug Utils?

- 🎯 **Platform Agnostic**: Works anywhere JavaScript runs
- 🪶 **Lightweight**: Each module can be imported independently
- 📦 **Zero Dependencies**: Pure JavaScript implementations
- 🔒 **Type-Safe**: Written in TypeScript with full type definitions
- 🧪 **Well Tested**: Comprehensive test coverage

## Test Coverage

```
--------------------|---------|----------|---------|---------|-------------------
File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------------|---------|----------|---------|---------|-------------------
All files           |     100 |    98.59 |     100 |     100 |
 case               |     100 |      100 |     100 |     100 |
 do-classnames      |     100 |      100 |     100 |     100 |
 do-map             |     100 |      100 |     100 |     100 |
 do-scale           |     100 |    95.45 |     100 |     100 | 41
 feature-status     |     100 |      100 |     100 |     100 |
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the library
npm run build
```

## Contributing

We welcome contributions! Please see our contributing guidelines for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
