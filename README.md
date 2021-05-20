# Optic Changelog

This is a GitHub Action for adding changelog information to your Pull Requests using [Optic](https://github.com/opticdev/optic/).

## About Optic

Optic uses real traffic to document and test your APIs. It observes API traffic and learns API behavior. It can detect changes in your API by diffing traffic against the current specification.

## Set up Optic

Check out the [Optic repository](https://github.com/opticdev/optic/) for information how to set up Optic to document your API.

## Install the Optic Changelog GitHub Action

Here is an example of what to add to your GitHub Action workflows. This action must trigger on the `pull_request` event to post changelogs to your PRs:

```yaml
jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: opticdev/optic-changelog@<tag or commit hash>
        with:
          GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}
          OPTIC_API_KEY: ${{secrets.OPTIC_API_KEY}}
```

## Configure the GitHub Action

You can input the following values to the GitHub Action.

* `GITHUB_TOKEN` (required) - for creating PR comments
* `OPTIC_API_KEY` (required) - API key from app.useoptic.com, stored in your repository's secrets. It allows the gitbot to generate links to specs, making the changes much more visible
* `SUBSCRIBERS` (optional) - comma-separated value of GitHub usernames to include in the PR comment, which will notify the users of an API change
* `OPTIC_SPEC_PATH` (optional) - file path to the Optic spec file in the case where you move it from the normal location
