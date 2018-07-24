# @atomist/automation-client-ext-eventlog

An extension to an Atomist automation-client for sending events into the AtomistLogs event stream.

This stream is visible on the Atomist Dashboard at https://app.atomist.com and via GraphQL with the following query:

```
{
  AtomistLog(_orderBy: "timestamp") {
    message
    level
    category
    timestamp
    correlation_context {
      correlation_id
      automation {
        name
        version
      }
    }
  }
}
```

## Usage

1. First install the dependency in your automation-client project

```
$ npm install @atomist/automation-client-ext-eventlog
```

2. Install the support in your `atomist.config.ts`

```
import { 
    configureEventLog,
    ConsoleLogHandler,
} from "@atomist/automation-client-ext-eventlog";

export const configuration: Configuration = {
    postProcessors: [
        configureEventLog(ConsoleLogHandler),
    ],
}
```

## Support

General support questions should be discussed in the `#support`
channel on our community Slack team
at [atomist-community.slack.com][slack].

If you find a problem, please create an [issue][].

[issue]: https://github.com/atomist/automation-client-ts/issues

## Development

You will need to install [node][] to build and test this project.

### Build and Test

Command | Reason
------- | ------
`npm install` | install all the required packages
`npm run build` | lint, compile, and test
`npm run lint` | run tslint against the TypeScript
`npm run compile` | compile all TypeScript into JavaScript
`npm test` | run tests and ensure everything is working
`npm run clean` | remove stray compiled JavaScript files and build directory

### Release

To create a new release of the project, update the version in
package.json and then push a tag for the version.  The version must be
of the form `M.N.P` where `M`, `N`, and `P` are integers that form the
next appropriate [semantic version][semver] for release.  The version
in the package.json must be the same as the tag.  For example:

[semver]: http://semver.org

```
$ npm version 1.2.3
$ git tag -a -m 'The ABC release' 1.2.3
$ git push origin 1.2.3
```

The Travis CI build (see badge at the top of this page) will publish
the NPM module and automatically create a GitHub release using the tag
name for the release and the comment provided on the annotated tag as
the contents of the release notes.

---

Created by [Atomist][atomist].
Need Help?  [Join our Slack team][slack].

[atomist]: https://atomist.com/ (Atomist - Development Automation)
[slack]: https://join.atomist.com/ (Atomist Community Slack)
