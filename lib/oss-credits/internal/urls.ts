/** Turn the many forms of package.json `repository` / `homepage` into a clean https URL. */
export function normalizeProjectUrl(
  raw: string | undefined | null
): string | null {
  if (!raw) return null;
  let url = raw.trim();
  if (!url) return null;
  const shorthand = /^(github|gitlab|bitbucket):(.+)$/.exec(url);
  if (shorthand) {
    const host = {
      github: "github.com",
      gitlab: "gitlab.com",
      bitbucket: "bitbucket.org",
    }[shorthand[1] as "github" | "gitlab" | "bitbucket"];
    url = `https://${host}/${shorthand[2]}`;
  } else if (/^[\w.-]+\/[\w.-]+$/.test(url)) {
    url = `https://github.com/${url}`;
  }
  url = url
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^ssh:\/\/git@/, "https://")
    .replace(/^git@([^:]+):/, "https://$1/")
    .replace(/^http:\/\//, "https://")
    .replace(/\.git(#.*)?$/, "")
    .replace(/#.*$/, "")
    .replace(/\/+$/, "");
  return /^https:\/\/[^\s/]+\/?\S*$/.test(url) ? url : null;
}

export function npmPackageUrl(name: string): string {
  return `https://www.npmjs.com/package/${name}`;
}
