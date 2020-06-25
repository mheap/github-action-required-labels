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
      - uses: mheap/github-action-required-labels@v1
        with:
          mode: exactly
          count: 1
          labels: "semver:patch, semver:minor, semver:major"
```

### Prevent merging if a label exists

```yaml
- uses: mheap/github-action-required-labels@v1
  with:
    mode: exactly
    count: 0
    labels: "do not merge"
```

### Require multiple labels

```yaml
- uses: mheap/github-action-required-labels@v1
  with:
    mode: minimum
    count: 2
    labels: "community-reviewed, team-reviewed, codeowner-reviewed"
```
