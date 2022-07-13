#!/usr/bin/env node

const core = require("@actions/core");
// Context is populated by environment variables
// cf. https://github.com/actions/toolkit/blob/2b97eb3192ed27ad81a555e87f3f9de61c11a213/packages/github/src/context.ts#L28-L53
const { context, GitHub } = require("@actions/github");

async function run() {
    // testing note: set by environment variable INPUT_TRIGGER
    const trigger = core.getInput("trigger", { required: true });
    // testing note: set by environment variable INPUT_REACTION
    const reaction = core.getInput("reaction");
    // testing note: set by environment variable INPUT_FAIL_IF_NOT_MERGEABLE
    const failUnmergeable = core.getInput("fail_if_not_mergeable")
    const { GITHUB_TOKEN } = process.env;
    if (reaction && !GITHUB_TOKEN) {
        core.setFailed('If "reaction" is supplied, GITHUB_TOKEN is required');
        return;
    } else if (context.eventName !== "issue_comment" && context.eventName !== "pull_request" && context.eventName !== "pull_request_review_comment") {
        core.setFailed("eventName must be issue_comment or pull_request or pull_request_review_comment");
        return;
    }

    const body =
        ((context.eventName === "issue_comment" || context.eventName === "pull_request_review_comment")
        // For comments on pull requests
            ? context.payload.comment.body
            // For the initial pull request description
            : context.payload.pull_request.body) || '';
    core.setOutput('comment_body', body);

    const client = new GitHub(GITHUB_TOKEN);
    const { owner, repo } = context.repo;


    if (context.eventName === "issue_comment") {
        if (context.payload.issue.pull_request) {
            const pull_url = context.payload.issue.pull_request.url;
            const pull_number_index = pull_url.lastIndexOf('/')
            if(-1 === pull_number_index) {
                core.setFailed("Invalid pull request URL extracted from issue_comment")
                return;
            } else {
                const pull_number = parseInt(pull_url.substring(1 + pull_number_index));
                context.payload.pull_request = await client.pulls.get({
                    owner,
                    repo,
                    pull_number,
                });
            }
        } else {
            // not a pull-request comment, aborting
            core.setOutput("triggered", "false");
            return;
        }
    }

    if(failUnmergeable && context.payload.pull_request.mergeable != true) {
        core.setFailed("The pull request was not in a mergeable state");
        return;
    } else {
        core.setOutput("pull_request", context.payload.pull_request);
    }
    

    const prefixOnly = core.getInput("prefix_only") === 'true';
    if ((prefixOnly && !body.startsWith(trigger)) || !body.includes(trigger)) {
        core.setOutput("triggered", "false");
        return;
    }

    core.setOutput("triggered", "true");
    
    if (!reaction) {
        return;
    }

    if (context.eventName === "issue_comment") {
        await client.reactions.createForIssueComment({
            owner,
            repo,
            comment_id: context.payload.comment.id,
            content: reaction
        });
    } else {
        await client.reactions.createForIssue({
            owner,
            repo,
            issue_number: context.payload.pull_request.number,
            content: reaction
        });
    }
}

run().catch(err => {
    console.error(err);
    core.setFailed("Unexpected error");
});
