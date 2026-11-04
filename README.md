# acasa-labs.github.io

The home page for open source projects from [Acasa Labs](https://acasalabs.com), published at <https://acasa-labs.github.io>.

## How it works

`build.mjs` asks the GitHub API for the organization's public repos and writes a static site to `dist/`. Forks, archived repos, `.github` and this repo are left out.

- **New repo:** it appears in the list automatically, using its GitHub description.
- **Featured project:** add its copy to `projects.mjs`. Its version, licence and download link still come from GitHub.
- **Deploys:** GitHub Actions rebuilds on every push to `main` and once a day. If the GitHub API fails, the build stops and the live site stays as it was.

## Run it locally

You need Node 20 or later. There are no dependencies to install.

```sh
GITHUB_TOKEN=$(gh auth token) node build.mjs
python3 -m http.server 4173 --directory dist
```

The design follows `DESIGN.md` in the main Acasa Labs site.

## Licence

The code is MIT licensed. See [LICENSE](LICENSE). The Acasa Labs logo, the Lectern icon and the font files in `src/assets` are not covered by that licence.
