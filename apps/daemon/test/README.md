# Harbourmaster Daemon Tests

This directory contains comprehensive unit tests for the Harbourmaster daemon backend.

## Test Structure

```
test/
├── setup.ts           # Global test setup and configuration
├── helpers.ts         # Test utility functions and mocks
└── README.md          # This file

src/
├── services/
│   └── __tests__/     # Service layer tests
├── routes/
│   └── __tests__/     # Route handler tests
├── middleware/
│   └── __tests__/     # Middleware tests
└── lib/
    └── __tests__/     # Utility and library tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test

# Run tests once
npm run test:run

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Test Coverage

The test suite aims for comprehensive coverage across:

- **Services**: AuthService, DockerService
- **Routes**: Health, Auth, Container routes
- **Middleware**: Authentication middleware
- **Utilities**: Logger, Error normalizer

### Coverage Targets

- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

## Testing Philosophy

### Unit Tests Focus

- **Isolated testing**: Each component is tested in isolation with mocked dependencies
- **Behavior verification**: Tests verify expected behavior rather than implementation details
- **Edge case coverage**: Comprehensive testing of error conditions and edge cases
- **Security testing**: Validation of authentication, authorization, and input sanitization

### Mock Strategy

- **External dependencies**: Docker, file system, crypto operations are mocked
- **Consistent mocking**: Mocks are defined in test setup and helpers for reusability
- **Realistic data**: Mock data closely resembles real-world scenarios

## Test Categories

### 1. Service Tests (`services/__tests__/`)

- **AuthService**: JWT generation, password validation, configuration management
- **DockerService**: Container operations, socket detection, event streaming

### 2. Route Tests (`routes/__tests__/`)

- **Health routes**: System status reporting
- **Auth routes**: Login endpoint, input validation
- **Container routes**: CRUD operations, authentication requirements

### 3. Middleware Tests (`middleware/__tests__/`)

- **Auth middleware**: Token validation, CSRF protection

### 4. Utility Tests (`lib/__tests__/`)

- **Logger**: Configuration, serialization, redaction
- **Error normalizer**: Error categorization, message standardization

## Key Testing Patterns

### Mocking External Dependencies

```typescript
// Mock file system operations
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

// Mock Docker service
const mockDocker = {
  ping: vi.fn(),
  listContainers: vi.fn(),
};
```

### Testing Async Operations

```typescript
it('should handle async operations', async () => {
  mockService.operation.mockResolvedValue(expectedResult);

  const result = await service.operation();

  expect(result).toEqual(expectedResult);
});
```

### Testing Error Conditions

```typescript
it('should handle service errors gracefully', async () => {
  mockService.operation.mockRejectedValue(new Error('Service error'));

  await expect(service.operation()).rejects.toThrow('Service error');
});
```

### Testing Route Handlers

```typescript
it('should return success response', async () => {
  const response = await fastify.inject({
    method: 'GET',
    url: '/endpoint',
  });

  expect(response.statusCode).toBe(200);
  assertApiResponse(response, { success: true, hasData: true });
});
```

## Security Test Coverage

### Authentication Tests

- Token validation (valid, invalid, expired)
- CSRF token verification
- Password validation and hashing
- JWT payload verification

### Input Validation Tests

- Container ID validation
- Request body validation
- SQL injection prevention
- XSS prevention

### Authorization Tests

- Protected route access
- Admin privilege verification
- Session management

## Environment Configuration

### Test Environment Variables

- `NODE_ENV=test`: Enables test-specific configurations
- `LOG_LEVEL=silent`: Reduces log noise during tests

### Mock Data

Test helpers provide realistic mock data:

- Container objects matching Docker API responses
- JWT tokens with proper structure
- Error objects with appropriate status codes

## Debugging Tests

### Running Individual Tests

```bash
# Run specific test file
npx vitest src/services/__tests__/auth.test.ts

# Run tests matching pattern
npx vitest --grep "authentication"
```

### Debug Output

```bash
# Enable debug logs
LOG_LEVEL=debug npm test

# Run with reporter for detailed output
npx vitest --reporter=verbose
```

## Best Practices

### Test Organization

- One test file per source file
- Descriptive test names
- Grouped related tests in `describe` blocks
- Setup and teardown in `beforeEach`/`afterEach`

### Assertions

- Use specific matchers (`toBe`, `toEqual`, `toContain`)
- Test both positive and negative cases
- Verify side effects (function calls, state changes)

### Maintainability

- Use test helpers for common operations
- Keep tests focused and atomic
- Avoid testing implementation details
- Regular cleanup of outdated tests

## Continuous Integration

Tests are designed to run reliably in CI environments:

- No external dependencies (Docker, network)
- Deterministic behavior
- Reasonable execution time
- Clear failure messages

## Future Enhancements

- Integration tests with real Docker instances
- Performance testing for container operations
- End-to-end API testing
- Security vulnerability scanning