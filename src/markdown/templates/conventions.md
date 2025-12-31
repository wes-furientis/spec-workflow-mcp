# Coding Conventions

## Overview
[Brief description of the coding standards philosophy for this project. Why these conventions matter and how they support the project goals.]

## Naming Conventions

### General Principles
- [e.g., Clarity over brevity - names should be self-documenting]
- [e.g., Consistency across the codebase]
- [e.g., Domain terminology preferred over technical jargon]

### Variables & Constants
| Type | Convention | Example |
|------|------------|---------|
| Local variables | [e.g., camelCase] | `userName`, `itemCount` |
| Constants | [e.g., UPPER_SNAKE_CASE] | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT` |
| Boolean variables | [e.g., is/has/can prefix] | `isValid`, `hasPermission`, `canEdit` |
| Private members | [e.g., underscore prefix] | `_internalState`, `_cache` |

### Functions & Methods
| Type | Convention | Example |
|------|------------|---------|
| Functions | [e.g., camelCase, verb prefix] | `calculateTotal()`, `fetchUserData()` |
| Getters | [e.g., get prefix or property] | `getConfig()`, `config` |
| Setters | [e.g., set prefix] | `setConfig()` |
| Event handlers | [e.g., on/handle prefix] | `onSubmit()`, `handleClick()` |
| Factory functions | [e.g., create prefix] | `createUser()`, `buildConfig()` |

### Classes & Types
| Type | Convention | Example |
|------|------------|---------|
| Classes | [e.g., PascalCase, noun] | `UserRepository`, `ConfigManager` |
| Interfaces | [e.g., PascalCase, I prefix or no prefix] | `IUserService` or `UserService` |
| Type aliases | [e.g., PascalCase] | `UserId`, `ConfigOptions` |
| Enums | [e.g., PascalCase] | `UserRole`, `ConnectionState` |

### Files & Directories
| Type | Convention | Example |
|------|------------|---------|
| Source files | [e.g., kebab-case or match class name] | `user-service.ts`, `UserService.ts` |
| Test files | [e.g., .test or .spec suffix] | `user-service.test.ts` |
| Config files | [e.g., lowercase with dots] | `tsconfig.json`, `.eslintrc` |
| Directories | [e.g., kebab-case] | `user-management/`, `api-clients/` |

## File Organization

### Project Structure
```
project-root/
├── src/                    # Source code
│   ├── components/         # [Purpose]
│   ├── services/          # [Purpose]
│   ├── utils/             # [Purpose]
│   ├── types/             # [Purpose]
│   └── index.ts           # Entry point
├── tests/                  # Test files
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests
├── docs/                   # Documentation
├── scripts/               # Build/utility scripts
└── config/                # Configuration files
```

### File Contents Order
[Define the expected order of elements within a file]

1. Imports (external, then internal, alphabetized)
2. Constants and type definitions
3. Main class/function/component
4. Helper functions
5. Exports

### Module Boundaries
- [Rule about what can import what]
- [Circular dependency policy]
- [Public API vs internal implementation]

## Code Style

### Formatting
| Aspect | Rule |
|--------|------|
| Indentation | [e.g., 2 spaces, 4 spaces, tabs] |
| Line length | [e.g., 80, 100, 120 characters max] |
| Trailing commas | [e.g., Always in multiline, ES5 compatible] |
| Semicolons | [e.g., Always, Never, ASI-safe] |
| Quotes | [e.g., Single quotes for strings, backticks for templates] |
| Braces | [e.g., Same line, K&R style, Allman] |

### Whitespace
- [e.g., Blank line between functions]
- [e.g., No trailing whitespace]
- [e.g., Single blank line at end of file]
- [e.g., Spaces around operators]

### Comments
| Type | When to Use | Format |
|------|-------------|--------|
| Doc comments | Public APIs, complex logic | [e.g., JSDoc, docstrings] |
| Inline comments | Non-obvious code | [e.g., // explanation] |
| TODO comments | Future work tracking | [e.g., // TODO(author): description] |
| FIXME comments | Known issues | [e.g., // FIXME: description] |

## Error Handling

### General Approach
[e.g., Fail fast, exceptions for exceptional cases, Result types for expected failures]

### Error Types
| Category | Handling Strategy |
|----------|------------------|
| Validation errors | [e.g., Return Result type, throw immediately] |
| External service errors | [e.g., Retry with backoff, circuit breaker] |
| Unexpected errors | [e.g., Log, propagate, crash gracefully] |

### Error Messages
- [e.g., Include context: what failed, why, and how to fix]
- [e.g., Use error codes for programmatic handling]
- [e.g., Localization requirements]

### Logging Errors
```
[Example of how to log errors in this project]
```

## Testing Conventions

### Test Organization
- [e.g., Tests mirror source structure]
- [e.g., One test file per source file]
- [e.g., Test utilities in separate directory]

### Test Naming
| Type | Pattern | Example |
|------|---------|---------|
| Test files | [e.g., `*.test.ts`] | `user-service.test.ts` |
| Test suites | [e.g., describe block] | `describe('UserService')` |
| Test cases | [e.g., should + behavior] | `it('should return user by id')` |

### Test Structure
```
[Example of AAA pattern, Given-When-Then, or preferred structure]
```

### Mocking & Fixtures
- [e.g., Prefer dependency injection over mocking]
- [e.g., Fixtures in `__fixtures__` directory]
- [e.g., Factory functions for test data]

## Git Conventions

### Branch Naming
| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/description` | `feature/user-authentication` |
| Bugfix | `fix/description` | `fix/login-validation` |
| Hotfix | `hotfix/description` | `hotfix/security-patch` |
| Release | `release/version` | `release/1.2.0` |

### Commit Messages
```
<type>(<scope>): <subject>

<body>

<footer>
```

| Type | Purpose |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Formatting (no code change) |
| `refactor` | Code restructuring |
| `test` | Adding/updating tests |
| `chore` | Maintenance tasks |

### Pull Request Guidelines
- [e.g., PR template requirements]
- [e.g., Required reviewers]
- [e.g., CI checks that must pass]
- [e.g., Squash vs merge commit policy]

## Language-Specific Conventions

### [Primary Language]
[Language-specific rules that go beyond the general conventions above]

- [e.g., Async/await preferred over callbacks]
- [e.g., Immutability preferred]
- [e.g., Specific linter rules]

## Tools & Enforcement

### Linting
- **Tool**: [e.g., ESLint, Pylint, golangci-lint]
- **Config**: [Location of config file]
- **Running**: [Command to run linter]

### Formatting
- **Tool**: [e.g., Prettier, Black, gofmt]
- **Config**: [Location of config file]
- **Running**: [Command to format]

### Pre-commit Hooks
[List of checks that run before commit]

### CI Checks
[List of checks that run in CI pipeline]

## Exceptions & Deviations
[Document any accepted deviations from these standards and their rationale]

| Deviation | Location | Rationale |
|-----------|----------|-----------|
| [Rule violated] | [Where] | [Why it's acceptable] |
