const GITHUB_API = 'https://api.github.com';

function parseRepositoryUrl(repoUrl) {
  try {
    const url = new URL(repoUrl);
    if (url.hostname.toLowerCase() !== 'github.com') return null;

    const [owner, repoWithSuffix] = url.pathname.split('/').filter(Boolean);
    const repo = repoWithSuffix?.replace(/\.git$/, '');
    if (!owner || !repo) return null;

    return { owner, repo };
  } catch {
    return null;
  }
}

async function githubFetch(path, headers) {
  const response = await fetch(`${GITHUB_API}${path}`, { headers });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body.message || `GitHub returned HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return body;
}

export async function fetchRepoMetadata(repoUrl) {
  if (!repoUrl?.trim()) {
    return { repository: null, languages: {}, readme: '' };
  }

  const parsed = parseRepositoryUrl(repoUrl.trim());
  if (!parsed) {
    return { error: 'Enter a valid public GitHub repository URL.' };
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'grounded-interviewer'
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const basePath = `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`;
    const [repository, languages, readmeResponse] = await Promise.all([
      githubFetch(basePath, headers),
      githubFetch(`${basePath}/languages`, headers),
      fetch(`${GITHUB_API}${basePath}/readme`, {
        headers: { ...headers, Accept: 'application/vnd.github.raw+json' }
      }).then(async (response) => {
        if (!response.ok) return '';
        return response.text();
      })
    ]);

    return {
      repository: {
        name: repository.name,
        fullName: repository.full_name,
        description: repository.description,
        htmlUrl: repository.html_url,
        stars: repository.stargazers_count,
        forks: repository.forks_count,
        openIssues: repository.open_issues_count,
        defaultBranch: repository.default_branch,
        topics: repository.topics || []
      },
      languages,
      readme: readmeResponse.slice(0, 24000)
    };
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      return { error: 'GitHub rejected the request. Check the token or API rate limit.' };
    }

    if (error.status === 404) {
      return { error: 'Repository not found or it is private.' };
    }

    return { error: `GitHub lookup failed: ${error.message}` };
  }
}
