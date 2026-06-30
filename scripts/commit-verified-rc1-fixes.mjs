import { execFileSync } from 'node:child_process';

if (process.env.GITHUB_ACTIONS !== 'true') {
  console.log('RC1 verified commit is only performed in GitHub Actions.');
  process.exit(0);
}

const branch = exec('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
if (!['workshop-parity-rc1', 'release/workshop-parity-rc1'].includes(branch)) {
  console.log(`Skipping RC1 commit on branch ${branch}.`);
  process.exit(0);
}

const paths = [
  'src/core/destination-profiles.js',
  'src/ui/destination-controller.js',
  'src/ui/stixio-workshop-app-v2.js',
  'tests/e2e/parity-layout-refine-package.spec.js',
  'tests/e2e/parity-multisource-mask-review.spec.js'
];

exec('git', ['config', 'user.name', 'github-actions[bot]']);
exec('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
exec('git', ['add', ...paths]);

const staged = exec('git', ['diff', '--cached', '--name-only']).trim();
if (!staged) {
  console.log('No verified RC1 source changes to commit.');
  process.exit(0);
}

console.log(`Committing verified RC1 files:\n${staged}`);
exec('git', ['commit', '-m', 'Preserve Legacy output identities in RC1']);
exec('git', ['push', 'origin', `HEAD:${branch}`]);

function exec(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}
