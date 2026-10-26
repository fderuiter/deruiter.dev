# AWS infrastructure

The only AWS resources this project runs are the two always-free data stores
in [ADR 0070](../../adr/0070-always-free-aws-data-stores.md): an Aurora DSQL
cluster and a DynamoDB table. Both were created through the Vercel
Marketplace, which also gives production builds a read role.

`github-actions-role.json` is the one piece the Marketplace does not create:
a role that GitHub Actions on `main` assumes through OIDC to write to the
cluster and the table. No access keys are stored anywhere.

## What the role may do

| Resource       | Actions                                                        |
| -------------- | -------------------------------------------------------------- |
| DSQL cluster   | `dsql:DbConnectAdmin` (load the gold layer)                    |
| DynamoDB table | `dynamodb:PutItem`, `dynamodb:Query`, `dynamodb:DescribeTable` |

Only workflows running on `main` of `fderuiter/deruiter.dev` can assume it.
Pull requests, forks and other branches cannot.
`__tests__/infra-aws-role.test.ts` keeps these limits from drifting.

## Deploying it (owner, once)

1. Find the two ARNs. In Vercel, open **Storage**, choose the DSQL cluster,
   then **Open in AWS**, and copy the cluster ARN
   (`arn:aws:dsql:REGION:ACCOUNT:cluster/ID`). Do the same for the DynamoDB
   table (`arn:aws:dynamodb:REGION:ACCOUNT:table/NAME`).
2. In the AWS console, switch to the same region, open **CloudFormation**,
   choose **Create stack** and then **With new resources**, and upload
   `github-actions-role.json`.
3. Name the stack `deruiter-dev-github-actions`, paste the two ARNs, and
   leave `CreateOidcProvider` as `true` unless the account already has the
   `token.actions.githubusercontent.com` identity provider.
4. Acknowledge that the stack creates IAM resources with a custom name, and
   create it.
5. Copy the `RoleArn` output. In GitHub, open the repository's **Settings**,
   **Secrets and variables**, **Actions**, **Variables**, and add
   `AWS_GITHUB_ROLE_ARN` with that value. It is an identifier, not a secret.

Deleting the stack removes the role and the identity provider; the data
stores are untouched.
