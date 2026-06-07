// Test stub for the `server-only` package. In a real RSC build, importing
// `server-only` from a Client Component throws; under vitest (jsdom) we alias it
// to this no-op so server modules can be unit-tested in isolation with mocks.
export {}
