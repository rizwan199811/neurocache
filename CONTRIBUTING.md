# Contributing

Thanks for considering contributing to NeuroCache!

## Getting Started

Fork and clone:
```bash
git clone https://github.com/eneswritescode/neurocache.git
cd neurocache
npm install
```

Copy `.env.example` to `.env` and add your OpenAI API key if you want to run examples.

## Development

Start in watch mode:
```bash
npm run dev
```

Run tests:
```bash
npm test
npm run test:watch
```

Lint:
```bash
npm run lint
npm run lint:fix
```

## Making Changes

1. Create a branch: `git checkout -b fix-something`
2. Make your changes
3. Add tests
4. Run `npm test` and `npm run build`
5. Commit: `git commit -m "fix: description"`
6. Push and open a PR

Use conventional commits:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation
- `test:` for tests
- `refactor:` for refactoring

## Code Style

- TypeScript strict mode (no `any`)
- Prefer functional patterns
- Add JSDoc for public APIs
- Keep functions focused and small

## Testing

Add tests in `src/__tests__/`. We aim for good coverage but quality over quantity.

## Pull Requests

- Keep them focused
- Update docs if needed
- Make sure tests pass
- Describe what and why

## Questions?

Open an issue or discussion.
