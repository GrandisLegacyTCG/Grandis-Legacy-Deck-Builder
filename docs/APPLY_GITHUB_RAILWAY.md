# Apply to GitHub / Railway

1. Extract the v2.5.16 package.
2. Replace the repository contents from the package root.
3. Review changes in GitHub Desktop.
4. Commit using `docs/GITHUB_SUMMARY_v2.5.16.md`.
5. Push `origin/main`.
6. Wait for Railway deploy success, open `/health`, then hard refresh or use Incognito.

## Authorized Observer password

The package defaults to `GLObserver`. To use a different deployment password, add Railway variable `GL_OBSERVER_PASSWORD` and redeploy.
