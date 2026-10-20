import { Stack, StackProps } from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { ENDPOINT_NAME, FUNCTION_NAME } from './names';

export interface SpikeWebStackProps extends StackProps {
  codeBucket: s3.IBucket;
  codeKey: string;
  codeVersion: string;
  alertEmail: string;
}

export class SpikeWebStack extends Stack {
  constructor(scope: Construct, id: string, props: SpikeWebStackProps) {
    super(scope, id, props);

    const role = new iam.Role(this, 'ExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    const fn = new lambda.CfnWebFunction(this, 'WebFunction', { functionName: FUNCTION_NAME });

    // Revisions are immutable: any change (code, config) replaces the resource.
    const revision = new lambda.CfnWebFunctionRevision(this, 'Revision', {
      functionName: FUNCTION_NAME,
      buildConfig: {
        runtimeConfig: { runtime: 'nodejs24.x' },
        codeConfig: {
          s3Object: { bucket: props.codeBucket.bucketName, key: props.codeKey, versionId: props.codeVersion },
        },
      },
      // maxConcurrencyPerEnvironment left at its default (64).
      serviceConfig: { executionRoleArn: role.roleArn },
    });
    revision.addResourceDependency(fn);

    const endpoint = new lambda.CfnWebFunctionEndpoint(this, 'Endpoint', {
      functionName: FUNCTION_NAME,
      endpointName: ENDPOINT_NAME,
      endpointType: 'HomeRegion',
      authType: 'IamAuth',
      scalingConfig: { maxEnvironments: 2 },
      throttleConfig: { rateLimit: 100 },
      revisionWeights: [{ revisionId: revision.attrRevisionId, weight: 100 }],
    });

    // OAC for a Web Function origin: always-amz-auth is the only supported signing behavior.
    const oac = new cloudfront.CfnOriginAccessControl(this, 'Oac', {
      originAccessControlConfig: {
        name: `${FUNCTION_NAME}-oac`,
        originAccessControlOriginType: 'lambda',
        signingBehavior: cloudfront.SigningBehavior.ALWAYS_AMZ_AUTH,
        signingProtocol: 'sigv4',
      },
    });

    // Must NOT forward Host: the endpoint rejects the distribution's domain name.
    const originRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'OriginRequestPolicy', {
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
        'CloudFront-Viewer-Address',
        'Origin',
        'Content-Type',
        'Accept',
      ),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: new origins.HttpOrigin(endpoint.attrDomainName, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          originAccessControlId: oac.attrId,
        }),
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });

    // Leaf resource, kept separate from the function to avoid a dependency cycle
    // (function -> distribution -> endpoint -> function). Native path first (Q8).
    const functionArn = this.formatArn({ service: 'lambda', resource: 'web-function', resourceName: FUNCTION_NAME });
    const policy = new lambda.CfnResourcePolicy(this, 'CloudFrontPolicy', {
      resourceArn: functionArn,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'AllowCloudFrontOACAccess',
            Effect: 'Allow',
            Principal: { Service: 'cloudfront.amazonaws.com' },
            Action: 'lambda:InvokeWebFunctionEndpoint',
            Resource: endpoint.attrEndpointArn,
            Condition: { StringEquals: { 'aws:SourceArn': distribution.distributionArn } },
          },
        ],
      },
    });
    policy.addResourceDependency(fn);

    // Alerts only. No Budgets Actions and no shutdown Lambda (manual runbook in README).
    const email = [{ subscriptionType: 'EMAIL', address: props.alertEmail }];
    const actual = [5, 10, 15, 20].map((threshold) => ({
      notification: {
        notificationType: 'ACTUAL',
        comparisonOperator: 'GREATER_THAN',
        thresholdType: 'ABSOLUTE_VALUE',
        threshold,
      },
      subscribers: email,
    }));
    new budgets.CfnBudget(this, 'Budget', {
      budget: {
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: 20, unit: 'USD' },
      },
      notificationsWithSubscribers: [
        ...actual,
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            thresholdType: 'ABSOLUTE_VALUE',
            threshold: 20,
          },
          subscribers: email,
        },
      ],
    });
  }
}
