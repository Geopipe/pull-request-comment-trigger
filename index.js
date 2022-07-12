#!/usr/bin/env node

const core = require("@actions/core");
const { context, GitHub } = require("@actions/github");

async function run() {
    const trigger = core.getInput("trigger", { required: true });

    const reaction = core.getInput("reaction");
    const { GITHUB_TOKEN } = process.env;
    if (reaction && !GITHUB_TOKEN) {
        core.setFailed('If "reaction" is supplied, GITHUB_TOKEN is required');
        return;
    } else if (context.eventName !== "issue_comment" && context.eventName !== "pull_request") {
        core.setFailed("eventName must be issue_comment or pull_request");
        return;
    }

    const body =
        (context.eventName === "issue_comment"
        // For comments on pull requests
            ? context.payload.comment.body
            // For the initial pull request description
            : context.payload.pull_request.body) || '';
    core.setOutput('comment_body', body);

    const client = new GitHub(GITHUB_TOKEN);

    if (context.eventName === "issue_comment") {
        if (context.payload.issue.pull_request) {
            const pull_url = context.payload.issue.pull_request;
            const pull_number_index = pull_url.lastIndexOf('/')
            if(-1 === pull_number_index) {
                core.setFailed("Invalid pull request URL extracted from issue_comment")
                return;
            } else {
                const pull_number = parseInt(pull_url.substring(1 + pull_number_index));
                core.setOutput("pull_request", await client.pulls.get({
                    owner,
                    repo,
                    pull_number,
                }));
            }
        } else {
            // not a pull-request comment, aborting
            core.setOutput("triggered", "false");
            return;
        }
    } else {
        core.setOutput("pull_request", context.payload.pull_request);
    }

    const { owner, repo } = context.repo;


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
