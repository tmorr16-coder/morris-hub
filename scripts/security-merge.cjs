// Called only after the lockfile candidate passes tests and the production build.
module.exports = async function mergeSecurityFix({ github, context, core }, number, expectedHead) {
  const repo = context.repo;
  const { data: pr } = await github.rest.pulls.get({ ...repo, pull_number: Number(number) });
  const { data: base } = await github.rest.repos.getBranch({ ...repo, branch: 'main' });
  const files = await github.paginate(github.rest.pulls.listFiles, { ...repo, pull_number: pr.number, per_page: 100 });
  if (pr.state !== 'open' || pr.draft || pr.head.ref !== 'security/compatible-dependency-fixes' || pr.head.repo.full_name !== `${repo.owner}/${repo.repo}` || pr.head.sha !== expectedHead || pr.base.ref !== 'main' || pr.base.sha !== context.sha || base.commit.sha !== context.sha || files.length !== 1 || files[0].filename !== 'package-lock.json' || files[0].status !== 'modified') {
    throw Error('Automatic merge stopped: candidate or main changed, or patch exceeds the validated lockfile. Review PR manually.');
  }
  const { data: merged } = await github.rest.pulls.merge({ ...repo, pull_number: pr.number, sha: expectedHead, merge_method: 'squash', commit_title: 'fix(security): apply validated compatible dependency fixes' });
  if (!merged.merged) throw Error('Automatic merge blocked by repository policy; review PR manually.');
  core.info('Compatible dependency fixes merged. Scheduling verification of main.');
  // GITHUB_TOKEN pushes do not trigger push workflows. Dispatch explicitly.
  await github.rest.actions.createWorkflowDispatch({ ...repo, workflow_id: 'security-review.yml', ref: 'main' });
};
