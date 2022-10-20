# github-action-required-labels

This action allows you to fail the build if/unless a certain combination of labels are applied to a pull request.

## Usage

This action has three inputs:

### `labels`

This is a list of comma separated labels to match on.

```
labels: 'label-one, another:label, bananas'
```

### `mode`

One of: `exactly`, `minimum`, `maximum`

### `count`

The number of labels to apply `mode` to

## Examples

### Complete example

```yaml
name: Pull Request Labels
on:
  pull_request:
    types: [opened, labeled, unlabeled, synchronize]
jobs:
  label:
    runs-on: ubuntu-latest
    steps:
      - uses: mheap/github-action-required-labels@v2
        with:
          mode: exactly
          count: 1
          labels: "semver:patch, semver:minor, semver:major"
```

By default this actions reads `event.json`, which will not detect when a label is added in an earlier step.
To force an API call, set the `GITHUB_TOKEN` environment variable like so:

```yaml
- uses: mheap/github-action-required-labels@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    mode: exactly
    count: 1
    labels: "semver:patch, semver:minor, semver:major"
```

### Prevent merging if a label exists

```yaml
- uses: mheap/github-action-required-labels@v2
  with:
    mode: exactly
    count: 0
    labels: "do not merge"
```

### Post a comment when the check fails

```yaml
- uses: mheap/github-action-required-labels@v2
  with:
    mode: exactly
    count: 1
    labels: "semver:patch, semver:minor, semver:major"
    add_comment: true
```

### Require multiple labels

```yaml
- uses: mheap/github-action-required-labels@v2
  with:
    mode: minimum
    count: 2
    labels: "community-reviewed, team-reviewed, codeowner-reviewed"
```

### Exit with a neutral result rather than failure

```yaml
- uses: mheap/github-action-required-labels@v2
  with:
    mode: minimum
    count: 2
    labels: "community-reviewed, team-reviewed, codeowner-reviewed"
    exit_type: success # Can be: success or failure (default: failure)
```

You can set `exit_type` to success then inspect `outputs.status` to see if the action passed or failed. This is useful when you want to perform additional actions if a label is not present, but not fail the entire build.

If the action passed, `outputs.status` will be `success`. If it failed, `outputs.status` will be `failure`.

Here is a complete workflow example for this use case:

```yaml
name: Pull Request Labels
on:
  pull_request:
    types: [opened, labeled, unlabeled, synchronize]
jobs:
  label:
    runs-on: ubuntu-latest
    outputs:
      status: ${{ steps.check-labels.outputs.status }}
    steps:
      - id: check-labels
        uses: mheap/github-action-required-labels@v2
        with:
          mode: exactly
          count: 1
          labels: "semver:patch, semver:minor, semver:major"
          exit_type: success
  do-other:
    runs-on: ubuntu-latest
    needs: label
    steps:
      - run: echo SUCCESS
        if: needs.label.outputs.status == 'success'
      - run: echo FAILURE && exit 1
        if: needs.label.outputs.status == 'failure'
```
