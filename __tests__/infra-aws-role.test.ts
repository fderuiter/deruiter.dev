// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Pins the limits of the GitHub Actions role in infra/aws (ADR 0070): only
 * `main` of this repository may assume it, and it may touch only the DSQL
 * cluster and the DynamoDB table it is given.
 */

interface Statement {
  Sid?: string;
  Effect: string;
  Action: string | string[];
  Resource?: unknown;
  Principal?: unknown;
  Condition?: Record<string, Record<string, string | string[]>>;
}

const templatePath = path.resolve(
  process.cwd(),
  "infra/aws/github-actions-role.json"
);
const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
const role = template.Resources.GitHubActionsRole.Properties;
const trust: Statement[] = role.AssumeRolePolicyDocument.Statement;
const permissions: Statement[] = role.Policies.flatMap(
  (policy: { PolicyDocument: { Statement: Statement[] } }) =>
    policy.PolicyDocument.Statement
);
const actionsOf = (statement: Statement) =>
  Array.isArray(statement.Action) ? statement.Action : [statement.Action];

describe("infra/aws GitHub Actions role", () => {
  it("is a CloudFormation template with the two ARNs as parameters", () => {
    expect(template.AWSTemplateFormatVersion).toBe("2010-09-09");
    expect(Object.keys(template.Parameters)).toEqual(
      expect.arrayContaining(["DsqlClusterArn", "DynamoDbTableArn"])
    );
  });

  it("can be assumed only by GitHub Actions on main of this repository", () => {
    expect(trust).toHaveLength(1);
    const [statement] = trust;
    expect(statement.Effect).toBe("Allow");
    expect(actionsOf(statement)).toEqual(["sts:AssumeRoleWithWebIdentity"]);
    expect(statement.Condition?.StringEquals).toEqual({
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub":
        "repo:fderuiter/deruiter.dev:ref:refs/heads/main",
    });
    expect(statement.Condition).not.toHaveProperty("StringLike");
  });

  it("grants only the listed actions, each on its own resource", () => {
    const granted = Object.fromEntries(
      permissions.map((statement) => [
        actionsOf(statement).join(","),
        statement.Resource,
      ])
    );
    expect(granted).toEqual({
      "dsql:DbConnectAdmin": { Ref: "DsqlClusterArn" },
      "dynamodb:PutItem,dynamodb:Query,dynamodb:DescribeTable": {
        Ref: "DynamoDbTableArn",
      },
      "cloudwatch:GetMetricStatistics": "*",
    });
    for (const statement of permissions) {
      expect(statement.Effect).toBe("Allow");
      // CloudWatch metric reads take no resource; every write is scoped.
      if (actionsOf(statement).every((a) => a.startsWith("cloudwatch:Get"))) {
        continue;
      }
      expect(JSON.stringify(statement)).not.toContain("*");
    }
  });

  it("derives the DSQL endpoint from the cluster ARN", () => {
    const resolve = (node: unknown, arn: string): unknown => {
      if (Array.isArray(node)) return node.map((n) => resolve(n, arn));
      if (node === null || typeof node !== "object") return node;
      const [fn, args] = Object.entries(node)[0] as [string, unknown[]];
      const a = resolve(args, arn) as unknown[];
      switch (fn) {
        case "Ref":
          return arn;
        case "Fn::Split":
          return (a[1] as string).split(a[0] as string);
        case "Fn::Select":
          return (a[1] as string[])[a[0] as number];
        case "Fn::Join":
          return (a[1] as string[]).join(a[0] as string);
        default:
          throw new Error(`Unexpected ${fn}`);
      }
    };
    expect(
      resolve(
        template.Outputs.DsqlEndpoint.Value,
        "arn:aws:dsql:us-east-1:123456789012:cluster/abc123def456"
      )
    ).toBe("abc123def456.dsql.us-east-1.on.aws");
  });

  it("rejects ARNs that are not a single cluster or table", () => {
    const cluster = new RegExp(
      template.Parameters.DsqlClusterArn.AllowedPattern
    );
    const table = new RegExp(
      template.Parameters.DynamoDbTableArn.AllowedPattern
    );
    expect(
      cluster.test("arn:aws:dsql:us-east-1:123456789012:cluster/abc123def456")
    ).toBe(true);
    expect(cluster.test("arn:aws:dsql:us-east-1:123456789012:cluster/*")).toBe(
      false
    );
    expect(
      table.test("arn:aws:dynamodb:us-east-1:123456789012:table/data-runs")
    ).toBe(true);
    expect(table.test("arn:aws:dynamodb:us-east-1:123456789012:table/*")).toBe(
      false
    );
  });
});
