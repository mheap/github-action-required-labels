# github-action-required-labels

This action allows you to fail the build if/unless a certain combination of labels are applied to a pull request.

## Usage

This action has three required inputs; `labels`, `mode` and `count`

| Name          | Description                                                                                                 | Required | Default             |
| ------------- | ----------------------------------------------------------------------------------------------------------- | -------- | ------------------- |
| `labels`      | Comma separated list of labels to match                                                                     | true     |
| `mode`        | The mode of comparison to use. One of: exactly, minimum, maximum                                            | true     |
| `count`       | The required number of labels to match                                                                      | true     |
| `token`       | The GitHub token to use when calling the API                                                                | false    | ${{ github.token }} |
| `message`     | The message to log and to add to the PR (if add_comment is true). See the README for available placeholders | false    |
| `add_comment` | Add a comment to the PR if required labels are missing                                                      | false    | false               |
| `exit_type`   | The exit type of the action. One of: failure, success                                                       | false    |

This action calls the GitHub API to fetch labels for a PR rather than reading `event.json`. This allows the action to run as intended when an earlier step adds a label. It will use `github.token` by default, and you can set the `token` input to provide alternative authentication.

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
    permissions:
      issues: write
      pull-requests: write
    steps:
      - uses: mheap/github-action-required-labels@v3
        with:
          mode: exactly
          count: 1
          labels: "semver:patch, semver:minor, semver:major"
```

### Prevent merging if a label exists

```yaml
- uses: mheap/github-action-required-labels@v3
  with:
    mode: exactly
    count: 0
    labels: "do not merge"
```

### Post a comment when the check fails

You can choose to add a comment to the PR when the action fails. The default format is:

> Label error. Requires {{ errorString }} {{ count }} of: {{ provided }}. Found: {{ applied }}

```yaml
- uses: mheap/github-action-required-labels@v3
  with:
    mode: exactly
    count: 1
    labels: "semver:patch, semver:minor, semver:major"
    add_comment: true
```

### Customising the failure message / comment

You can also customise the message used by providing the `message` input:

```yaml
- uses: mheap/github-action-required-labels@v3
  with:
    mode: exactly
    count: 1
    labels: "semver:patch, semver:minor, semver:major"
    add_comment: true
    message: "This PR is being prevented from merging because you have added one of our blocking labels: {{ provided }}. You'll need to remove it before this PR can be merged."
```

The following tokens are available for use in custom messages:

| Token       | Value                                    |
| ----------- | ---------------------------------------- |
| mode        | One of: `exactly`, `minimum`, `maximum`  |
| count       | The value of the `count` input           |
| errorString | One of: `exactly`, `at least`, `at most` |
| provided    | The value of the `labels` input          |
| applied     | The labels that are applied to the PR    |

### Require multiple labels

```yaml
- uses: mheap/github-action-required-labels@v3
  with:
    mode: minimum
    count: 2
    labels: "community-reviewed, team-reviewed, codeowner-reviewed"
```

### Controlling failure

You can set `exit_type` to success then inspect `outputs.status` to see if the action passed or failed. This is useful when you want to perform additional actions if a label is not present, but not fail the entire build.

```yaml
- uses: mheap/github-action-required-labels@v3
  with:
    mode: minimum
    count: 2
    labels: "community-reviewed, team-reviewed, codeowner-reviewed"
    exit_type: success # Can be: success or failure (default: failure)
```

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
    permissions:
      issues: write
      pull-requests: write
    outputs:
      status: ${{ steps.check-labels.outputs.status }}
    steps:
      - id: check-labels
        uses: mheap/github-action-required-labels@v3
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
