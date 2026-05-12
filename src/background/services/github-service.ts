import type { Settings, GitHubFile } from '../../shared/types';

export async function fetchFilesFromRepo(settings: Settings): Promise<GitHubFile[]> {
  const headers = {
    Authorization: `Bearer ${settings.accessToken}`,
    Accept: 'application/vnd.github.v3+json',
  };

  let files: GitHubFile[] = [];

  try {
    const outputResponse = await fetch(
      `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/output`,
      { headers }
    );
    if (outputResponse.ok) {
      files = await outputResponse.json();
    }
    if (files.length === 0) {
      throw new Error('No files found in output directory');
    }
  } catch (e) {
    const rootResponse = await fetch(
      `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/contents/`,
      { headers }
    );
    if (rootResponse.ok) {
      const allFiles = await rootResponse.json();
      files = allFiles.filter((file: GitHubFile) => file.name.endsWith('.js'));
    }
  }

  return files;
}

export async function fetchFileContent(downloadUrl: string): Promise<string> {
  const response = await fetch(downloadUrl);
  return response.text();
}
