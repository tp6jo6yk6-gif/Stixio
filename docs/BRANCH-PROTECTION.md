# Main Branch Protection

Stixio 1.0.0 must not be merged or published until protection is enabled for `main` and verified.

## Apply

Run from an administrator workstation authenticated with GitHub CLI:

```bash
bash scripts/apply-branch-protection.sh tp6jo6yk6-gif/Stixio main
```

The script applies `.github/branch-protection-main.json` through the GitHub API and immediately reads the protection settings back for verification.

## Required checks

- `test-build`
- `smoke`
- `release-readiness`
- `rollback-rehearsal`
- `real-user-signoff`

`real-user-signoff` remains intentionally failing until `docs/USER-TEST-SIGNOFF.md` contains completed tester records and the final decision is `APPROVED`.

## Protection policy

- Pull requests are required for changes to `main`.
- Required checks must run against the latest base branch.
- Administrators are also subject to the protection rules.
- Stale reviews are dismissed after new commits.
- All conversations must be resolved.
- Linear history is required.
- Force pushes and branch deletion are disabled.

The repository currently has one primary administrator, so the initial protection payload uses zero mandatory approving reviews while still requiring a pull request and all automated and human sign-off checks. Increase the approval count when another maintainer is available.

## Verify

```bash
gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  repos/tp6jo6yk6-gif/Stixio/branches/main/protection
```

Confirm that required status checks are strict, administrator enforcement is enabled, force pushes and deletion are disabled, and conversation resolution and linear history are required.

## Release evidence

Record the date, operator, and returned protection summary in PR #20 before changing the pull request from Draft to Ready for review.
