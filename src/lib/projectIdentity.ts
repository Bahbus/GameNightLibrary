export const TARGET_REPOSITORY = "Bahbus/GameNightLibrary";

const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export const parseGitHubRepository = (value: string | undefined) => {
  if (!value || !repositoryPattern.test(value)) return undefined;
  const [owner, name] = value.split("/");
  return { owner, name, fullName: value };
};

export const repositoryUrl = (repository: string) => `https://github.com/${repository}`;

export const pagesBasePath = (repository: string) => {
  const parsed = parseGitHubRepository(repository);
  if (!parsed) throw new Error("A valid GitHub owner/repository name is required.");
  return `/${parsed.name}/`;
};

export const pagesProjectUrl = (repository: string) => {
  const parsed = parseGitHubRepository(repository);
  if (!parsed) throw new Error("A valid GitHub owner/repository name is required.");
  return `https://${parsed.owner.toLowerCase()}.github.io/${parsed.name}/`;
};
