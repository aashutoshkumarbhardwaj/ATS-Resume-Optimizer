module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.js'],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js',
        '!src/index.js',
        '!src/routes/**'
    ],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/Archive/'
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/Archive/'
    ],
    verbose: true,
    collectCoverage: false,
    coverageReporters: ['text', 'lcov', 'html'],
    setupFilesAfterEnv: [],
    transformIgnorePatterns: [
        '/node_modules/'
    ]
};
