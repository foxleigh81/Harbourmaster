# Harbourmaster Daemon Testing

This document provides an overview of the comprehensive unit test suite for the Harbourmaster daemon backend.

## Test Setup Complete ✅

The testing infrastructure has been successfully implemented with the following components:

### Testing Framework Configuration
- **Test Runner**: Vitest v1.2.0
- **Coverage Provider**: @vitest/coverage-v8
- **UI**: @vitest/ui for interactive test running
- **Mock Strategy**: Comprehensive mocking of external dependencies

### Test Coverage

#### Services (`src/services/__tests__/`)
- **AuthService** (`auth.test.ts`): JWT authentication, password management, configuration
  - Singleton pattern testing
  - Configuration initialization (first run vs existing config)
  - Password hashing and validation
  - JWT token generation and validation
  - CSRF token handling
  - Error handling and edge cases

- **DockerService** (`docker.test.ts`): Docker operations and socket management
  - Socket detection across platforms (Linux, macOS, Docker Desktop, Colima)
  - Container lifecycle operations (start, stop, restart, delete)
  - Container listing and inspection
  - Event streaming
  - Concurrent operation locking
  - Error handling for Docker unavailability

#### Routes (`src/routes/__tests__/`)
- **Health Routes** (`health.test.ts`): System status endpoints
  - Docker connectivity status
  - Version reporting
  - Error handling
  - Response format validation

- **Auth Routes** (`auth.test.ts`): Authentication endpoints
  - Login endpoint testing
  - Input validation (Zod schema)
  - Password validation
  - Error handling and normalization
  - Request/response format validation

- **Container Routes** (`containers.test.ts`): Container management endpoints
  - CRUD operations for containers
  - Authentication middleware integration
  - Input validation and sanitization
  - Error handling and response formatting
  - Server-Sent Events for Docker events
  - Cache management

#### Middleware (`src/middleware/__tests__/`)
- **Auth Middleware** (`auth.test.ts`): Request authentication
  - JWT token validation
  - CSRF protection
  - Error responses
  - Request context injection

#### Utilities (`src/lib/__tests__/`)
- **Logger** (`logger.test.ts`): Structured logging
  - Configuration testing
  - Data redaction (passwords, tokens, secrets)
  - Environment-based transport configuration
  - Request serialization

- **Error Normalizer** (`errors.test.ts`): Error handling and categorization
  - Docker-specific error mapping
  - HTTP status code handling
  - Error message standardization
  - Request ID tracking

### Test Utilities (`test/`)
- **Setup** (`setup.ts`): Global test configuration
- **Helpers** (`helpers.ts`): Common test utilities and mock factories
- **Documentation** (`README.md`): Detailed testing guide

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (continuous)
npm run test

# Run tests once with coverage
npm run test:coverage

# Run with interactive UI
npm run test:ui

# Run specific test file
npm run test:run src/services/__tests__/auth.test.ts

# Run tests matching pattern
npx vitest --grep "authentication"
```

## Test Features

### Comprehensive Mocking
- **File System**: Mock `fs.promises` for configuration management
- **Docker**: Mock `dockerode` for container operations
- **Crypto**: Mock random generation for consistent testing
- **Network**: Mock external network calls
- **Authentication**: Mock JWT and bcrypt operations

### Security Testing
- **Authentication**: Token validation, expiration, CSRF protection
- **Input Validation**: Container ID validation, request sanitization
- **Data Protection**: Sensitive data redaction, secure configuration storage
- **Authorization**: Protected route access control

### Error Handling
- **Docker Errors**: Connection failures, container not found, permission denied
- **Authentication Errors**: Invalid tokens, expired sessions, CSRF failures
- **Validation Errors**: Invalid input, malformed requests
- **System Errors**: File system errors, network failures

### Edge Cases
- **Null/Undefined Handling**: Graceful degradation
- **Race Conditions**: Container operation locking
- **Cache Management**: TTL-based caching with invalidation
- **Event Streaming**: Long-running connections, cleanup

## Test Architecture

### Mock Strategy
- **Service Layer**: Mock external dependencies (Docker, filesystem)
- **Route Layer**: Mock service instances and middleware
- **Integration**: Use Fastify injection for HTTP testing
- **Utilities**: Mock logger and error handlers

### Data Management
- **Realistic Mocks**: Use helper functions for consistent test data
- **Isolation**: Reset mocks and state between tests
- **Deterministic**: Fixed random seeds and timestamps
- **Clean Environment**: Test-specific environment variables

## Coverage Targets

The test suite targets the following coverage thresholds:
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

## Key Testing Patterns

### Async Operations
```typescript
it('should handle async operations', async () => {
  mockService.operation.mockResolvedValue(expectedResult);
  const result = await service.operation();
  expect(result).toEqual(expectedResult);
});
```

### Error Conditions
```typescript
it('should handle errors gracefully', async () => {
  mockService.operation.mockRejectedValue(new Error('Test error'));
  await expect(service.operation()).rejects.toThrow('Test error');
});
```

### Route Testing
```typescript
it('should return success response', async () => {
  const response = await fastify.inject({
    method: 'GET',
    url: '/endpoint',
  });
  expect(response.statusCode).toBe(200);
});
```

## Benefits

### Development
- **Rapid Feedback**: Fast test execution in watch mode
- **Debugging**: Detailed error messages and stack traces
- **Confidence**: Comprehensive coverage of critical paths
- **Refactoring Safety**: Tests catch regressions during code changes

### Production
- **Reliability**: Thoroughly tested error handling
- **Security**: Validated authentication and authorization
- **Performance**: Tested caching and concurrent operations
- **Maintainability**: Well-documented test cases serve as living documentation

## Future Enhancements

### Integration Testing
- Real Docker containers for end-to-end testing
- Database integration tests
- Network connectivity tests

### Performance Testing
- Load testing for container operations
- Memory usage validation
- Response time benchmarks

### Security Testing
- Penetration testing automation
- Vulnerability scanning
- Authentication bypass attempts

The test suite provides a solid foundation for reliable, secure container management with comprehensive coverage of the Harbourmaster daemon's functionality.