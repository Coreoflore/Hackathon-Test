const GITHUB_API = 'https://api.github.com';

const MAX_TREE_ENTRIES = 500;
const MAX_KEY_FILE_SIZE = 4000;
const MAX_TOTAL_KEY_FILES_SIZE = 16000;

/**
 * File patterns to automatically fetch for code-level verification.
 * These reveal the real tech stack, dependencies, and architecture.
 */
const KEY_FILE_PATTERNS = [
  // Dependency manifests
  'package.json', 'requirements.txt', 'Pipfile', 'go.mod', 'Cargo.toml',
  'pom.xml', 'build.gradle', 'Gemfile', 'composer.json', 'pubspec.yaml',
  // Infrastructure & config
  'docker-compose.yml', 'docker-compose.yaml', 'Dockerfile',
  '.env.example', 'vercel.json', 'netlify.toml',
  // Common entry points (matched by basename)
  'server.js', 'server.ts', 'app.js', 'app.ts', 'app.py',
  'index.js', 'index.ts', 'main.js', 'main.ts', 'main.py', 'main.go',
  'manage.py', 'wsgi.py',
];

/**
 * Extended entry-point patterns matched by path suffix for files
 * nested inside common source directories.
 */
const ENTRY_POINT_SUFFIXES = [
  'src/index.js', 'src/index.ts', 'src/index.tsx',
  'src/main.js', 'src/main.ts', 'src/main.tsx',
  'src/app.js', 'src/app.ts', 'src/app.tsx',
  'src/App.js', 'src/App.ts', 'src/App.tsx', 'src/App.jsx',
  'backend/server.js', 'backend/app.js', 'backend/index.js',
  'api/index.js', 'api/index.ts',
  'cmd/main.go', 'cmd/server.go',
];

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

async function optionalGithubFetch(path, headers, fallback) {
  try {
    return await githubFetch(path, headers);
  } catch {
    return fallback;
  }
}

/**
 * Fetch the full recursive file tree for a repository.
 * Returns an array of file path strings, capped at MAX_TREE_ENTRIES.
 */
async function fetchFileTree(basePath, defaultBranch, headers) {
  try {
    const treePath = `${basePath}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`;
    const treeData = await githubFetch(treePath, headers);
    
    if (!Array.isArray(treeData.tree)) return [];

    return treeData.tree
      .filter(entry => entry.type === 'blob')
      .slice(0, MAX_TREE_ENTRIES)
      .map(entry => entry.path);
  } catch {
    return [];
  }
}

/**
 * Determine which files from the tree are worth fetching for code verification.
 * Matches against known dependency manifests, config files, and entry points.
 */
function selectKeyFiles(fileTree) {
  const selected = new Set();

  for (const filePath of fileTree) {
    const basename = filePath.split('/').pop().toLowerCase();
    const pathLower = filePath.toLowerCase();

    // Match exact basenames (e.g. package.json at any depth)
    if (KEY_FILE_PATTERNS.some(pattern => basename === pattern.toLowerCase())) {
      selected.add(filePath);
    }

    // Match known entry-point path suffixes
    if (ENTRY_POINT_SUFFIXES.some(suffix => pathLower.endsWith(suffix.toLowerCase()))) {
      selected.add(filePath);
    }
  }

  return [...selected];
}

/**
 * Fetch the raw contents of specific files from the repository.
 * Respects per-file and total size caps.
 */
async function fetchKeyFileContents(basePath, filePaths, headers) {
  const keyFiles = {};
  let totalSize = 0;

  const rawHeaders = { ...headers, Accept: 'application/vnd.github.raw+json' };

  const fetchPromises = filePaths.map(async (filePath) => {
    try {
      const response = await fetch(
        `${GITHUB_API}${basePath}/contents/${encodeURIComponent(filePath)}`,
        { headers: rawHeaders }
      );
      if (!response.ok) return null;

      const text = await response.text();
      return { path: filePath, content: text };
    } catch {
      return null;
    }
  });

  const results = await Promise.all(fetchPromises);

  for (const result of results) {
    if (!result) continue;
    
    const clipped = result.content.slice(0, MAX_KEY_FILE_SIZE);
    if (totalSize + clipped.length > MAX_TOTAL_KEY_FILES_SIZE) break;

    keyFiles[result.path] = clipped;
    totalSize += clipped.length;
  }

  return keyFiles;
}

export async function fetchRepoMetadata(repoUrl) {
  if (!repoUrl?.trim()) {
    return { repository: null, languages: {}, readme: '', fileTree: [], keyFiles: {} };
  }

  const parsed = parseRepositoryUrl(repoUrl.trim());
  if (!parsed) {
    return { error: 'Enter a valid public GitHub repository URL.' };
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'repovet'
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const basePath = `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`;
    const [repository, languages, readmeResponse, commits, contributors] = await Promise.all([
      githubFetch(basePath, headers),
      githubFetch(`${basePath}/languages`, headers),
      fetch(`${GITHUB_API}${basePath}/readme`, {
        headers: { ...headers, Accept: 'application/vnd.github.raw+json' }
      }).then(async (response) => {
        if (!response.ok) return '';
        return response.text();
      }),
      optionalGithubFetch(`${basePath}/commits?per_page=10`, headers, []),
      optionalGithubFetch(`${basePath}/contributors?per_page=10`, headers, [])
    ]);

    // Fetch the full file tree using the repo's default branch
    const defaultBranch = repository.default_branch || 'main';
    const fileTree = await fetchFileTree(basePath, defaultBranch, headers);

    // Identify and fetch key source files for code-level verification
    const keyFilePaths = selectKeyFiles(fileTree);
    const keyFiles = keyFilePaths.length > 0
      ? await fetchKeyFileContents(basePath, keyFilePaths, headers)
      : {};

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
      readme: readmeResponse.slice(0, 24000),
      fileTree,
      keyFiles,
      evidence: {
        submitted_url: repoUrl.trim(),
        hosted_on_github: true,
        repository_metadata_loaded: true,
        readme_available: Boolean(readmeResponse.trim()),
        recent_commit_count: Array.isArray(commits) ? commits.length : 0,
        contributor_count: Array.isArray(contributors) ? contributors.length : 0,
        file_count: fileTree.length,
        key_files_inspected: Object.keys(keyFiles)
      }
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

