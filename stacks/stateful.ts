import { CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  AccessLogField,
  AccessLogFormat,
  AuthorizationType,
  CfnAccount,
  CfnRestApi,
  Cors,
  GatewayResponse,
  LogGroupLogDestination,
  MethodLoggingLevel,
  ResponseType,
  RestApi,
  UsagePlan,
} from 'aws-cdk-lib/aws-apigateway';
import { AnyPrincipal, ManagedPolicy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

import { verboseLog } from '../lib/verboseLog';
import { AppStackProps } from '../models/cloudResources';

export class StatefulStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const { project, stage, stack, isStagingEnv } = props;
    const removalPolicy = isStagingEnv ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    const apiLogGroup = new LogGroup(this, `${project}-${stack}-ApiLogGroup-${stage}`, {
      logGroupName: `${project}-${stack}-ApiLogGroup-${stage}`,
      removalPolicy,
    });

    /**
     * Quotas for rest apis
     * https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html#api-gateway-execution-service-limits-table
     */
    const restApi = new RestApi(this, `${project}-api-${stage}`, {
      restApiName: `${project}-api-${stage}`,
      description: `The api for ${project} - ${stage}`,
      cloudWatchRole: false,
      policy: new PolicyDocument({
        assignSids: true,
        statements: [
          new PolicyStatement({
            actions: [
              'execute-api:Invoke', // used so anyone can invoke an api over the internet
            ],
            principals: [new AnyPrincipal()],
            resources: ['*'],
          }),
        ],
      }),
      deployOptions: {
        dataTraceEnabled: stage !== 'prod',
        stageName: stage,
        loggingLevel: stage === 'prod' ? MethodLoggingLevel.OFF : MethodLoggingLevel.INFO,
        accessLogDestination: new LogGroupLogDestination(apiLogGroup),
        accessLogFormat: AccessLogFormat.custom(
          JSON.stringify({
            requestId: AccessLogField.contextRequestId(),
            method: AccessLogField.contextHttpMethod(),
            errorMessage: AccessLogField.contextErrorMessage(),
            validation: AccessLogField.contextErrorValidationErrorString(),
            ipAddress: AccessLogField.contextIdentitySourceIp(),
            integrationError: '$context.integrationErrorMessage',
            authorizeError: '$context.authorize.error',
            authenticateError: '$context.authenticate.error',
          }),
        ),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowHeaders: ['*'],
        allowCredentials: true,
        allowMethods: Cors.ALL_METHODS,
      },
      defaultMethodOptions: {
        authorizationType: AuthorizationType.NONE,
        methodResponses: [
          {
            statusCode: '200',
            responseModels: {
              'application/json': {
                modelId: 'Empty',
              },
            },
          },
        ],
      },
    });

    restApi.applyRemovalPolicy(RemovalPolicy.DESTROY);

    const cloudWatchRole = new Role(this, `${project}-${stack}-apiCloudWatchRole-${stage}`, {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs')],
    });

    const apiAccount = new CfnAccount(this, `${project}-${stack}-account-${stage}`, {
      cloudWatchRoleArn: cloudWatchRole.roleArn,
    });

    apiAccount.addDependency(restApi.node.defaultChild as CfnRestApi);

    new UsagePlan(this, `${project}-${stack}-apiUsagePlan-${stage}`, {
      name: `${project}-${stack}-apiUsagePlan-${stage}`,
      description: 'The usage plan for the API key',
      apiStages: [
        {
          api: restApi,
          stage: restApi.deploymentStage,
        },
      ],
    });

    new StringParameter(this, `${project}-baseApiIdParam-${stage}`, {
      parameterName: `/${project}/${stack}/id/${stage}`,
      stringValue: restApi.restApiId,
    });

    new StringParameter(this, `${project}-rootResourceIdParam-${stage}`, {
      parameterName: `/${project}/${stack}/rootResourceId/${stage}`,
      stringValue: restApi.root.resourceId,
    });

    new GatewayResponse(this, `${project}-${stack}-unauthorizedResponse-${stage}`, {
      restApi,
      type: ResponseType.UNAUTHORIZED,
      statusCode: '401',
      templates: {
        'application/json':
          '{\nsuccess: false,\nreason: "NotAuthorized",\nerror: "The request requires user authentication or, if the request included authorization credentials, authorization has been refused for those credentials.",\nstatusCode: 401\n}',
      },
    });

    new GatewayResponse(this, `${project}-${stack}-forbiddenResponse-${stage}`, {
      restApi,
      type: ResponseType.ACCESS_DENIED,
      statusCode: '403',
      templates: {
        'application/json':
          '{\nsuccess: false,\nreason: "AccessDenied",\nerror: "The request requires user authentication or, if the request included authorization credentials, authorization has been refused for those credentials.",\nstatusCode: 403\n}',
      },
    });

    new GatewayResponse(this, `${project}-${stack}-notFoundResponse-${stage}`, {
      restApi,
      type: ResponseType.RESOURCE_NOT_FOUND,
      statusCode: '404',
      templates: {
        'application/json':
          '{\nsuccess: false,\nreason: "NotFound",\nerror: "The requested resource could not be found. This error can be due to a temporary or permanent condition.",\nstatusCode: 404\n}',
      },
    });

    // deployApi.ts script is dependent on reading this logical id.
    new CfnOutput(this, `${project}-apiIdOutput-${stage}`, { value: restApi.restApiId });
    new CfnOutput(this, `${project}-apiUrl-${stage}`, { value: restApi.url });

    /**
     * Custom domain name for api
     * waf acl for api
     * waf acl for cloudfront
     */
    // if (isStagingEnv) {
    //   const certArn = `arn:${Aws.PARTITION}:acm:${Aws.REGION}:${Aws.ACCOUNT_ID}:certificate/${acmCertificateId}`;
    //   const existingCertificate = Certificate.fromCertificateArn(this, `${project}-certificate-${stage}`, certArn);

    //   const apiCustomDomain = restApi.addDomainName(`${project}-apiDomain-${stage}`, {
    //     certificate: existingCertificate,
    //     domainName: apiDomainName,
    //     securityPolicy: SecurityPolicy.TLS_1_2,
    //     endpointType: EndpointType.EDGE,
    //   });

    //   apiCustomDomain.applyRemovalPolicy(RemovalPolicy.DESTROY);

    //   const zone = HostedZone.fromLookup(this, `${project}-${stack}-hostedZoneLookup-${stage}`, {
    //     domainName: hostedZoneName,
    //   });

    //   const restARecord = new ARecord(this, `${project}-${stack}-ARecord-${stage}`, {
    //     zone,
    //     target: RecordTarget.fromAlias(new ApiGatewayDomain(restApi.domainName!)),
    //     recordName: apiDomainName,
    //   });

    //   restARecord.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // const wafAclApi = new CfnWebACL(this, `${project}-${stack}-wafAclApi-${stage}`, {
    //   defaultAction: {
    //     allow: {},
    //   },
    //   scope: 'REGIONAL',
    //   visibilityConfig: {
    //     cloudWatchMetricsEnabled: true,
    //     metricName: `${project}-${stack}-wafAclApi-${stage}`,
    //     sampledRequestsEnabled: true,
    //   },
    //   name: `${project}-${stack}-wafAclApi-${stage}`,
    //   rules: [
    //     {
    //       name: 'CRSRule',
    //       priority: 0,
    //       statement: {
    //         managedRuleGroupStatement: {
    //           name: 'AWSManagedRulesCommonRuleSet',
    //           vendorName: 'AWS',
    //           excludedRules: [
    //             {
    //               name: 'SizeRestrictions_BODY',
    //             },
    //           ],
    //         },
    //       },
    //       visibilityConfig: {
    //         cloudWatchMetricsEnabled: true,
    //         metricName: `${project}-${stack}-wafAclApi-${stage}-CRS`,
    //         sampledRequestsEnabled: true,
    //       },
    //       overrideAction: {
    //         none: {},
    //       },
    //     },
    //     {
    //       name: 'AmazonIpReputationList',
    //       priority: 1,
    //       statement: {
    //         managedRuleGroupStatement: {
    //           name: 'AWSManagedRulesAmazonIpReputationList',
    //           vendorName: 'AWS',
    //         },
    //       },
    //       visibilityConfig: {
    //         cloudWatchMetricsEnabled: true,
    //         metricName: `${project}-${stack}-wafAclApi-${stage}-AmazonIpReputationList`,
    //         sampledRequestsEnabled: true,
    //       },
    //       overrideAction: {
    //         none: {},
    //       },
    //     },
    //     {
    //       name: 'AnonymousIpList',
    //       priority: 2,
    //       statement: {
    //         managedRuleGroupStatement: {
    //           name: 'AWSManagedRulesAnonymousIpList',
    //           vendorName: 'AWS',
    //         },
    //       },
    //       visibilityConfig: {
    //         cloudWatchMetricsEnabled: true,
    //         metricName: `${project}-${stack}-wafAclApi-${stage}-AnonymousIpList`,
    //         sampledRequestsEnabled: true,
    //       },
    //       overrideAction: {
    //         none: {},
    //       },
    //     },
    //     {
    //       name: 'rate-limiting',
    //       priority: 3,
    //       action: {
    //         block: {},
    //       },
    //       statement: {
    //         rateBasedStatement: {
    //           aggregateKeyType: 'IP',
    //           limit: 1000,
    //         },
    //       },
    //       visibilityConfig: {
    //         cloudWatchMetricsEnabled: true,
    //         metricName: `${project}-${stack}-wafAclApi-${stage}-rate-limiting`,
    //         sampledRequestsEnabled: true,
    //       },
    //     },
    //   ],
    // });

    // new CfnWebACLAssociation(this, `${project}-${stack}-webAclAssociation-${stage}`, {
    //   resourceArn: restApi.deploymentStage.stageArn,
    //   webAclArn: wafAclApi.attrArn,
    // });

    // new StringParameter(this, `${project}-${stack}-wafAclApiArnParam-${stage}`, {
    //   parameterName: `/${project}/${stack}/wafAclApiArn/${stage}`,
    //   stringValue: wafAclApi.attrArn,
    // });

    // const wafAclCloudfront = new CfnWebACL(this, `${project}-${stack}-wafAclCloudfront-${stage}`, {
    //   defaultAction: {
    //     allow: {},
    //   },
    //   scope: 'CLOUDFRONT',
    //   visibilityConfig: {
    //     cloudWatchMetricsEnabled: true,
    //     metricName: `${project}-${stack}-wafAclCloudfront-${stage}`,
    //     sampledRequestsEnabled: true,
    //   },
    //   name: `${project}-${stack}-wafAclCloudfront-${stage}`,
    //   rules: [
    //     {
    //       name: 'CRSRule',
    //       priority: 0,
    //       statement: {
    //         managedRuleGroupStatement: {
    //           name: 'AWSManagedRulesCommonRuleSet',
    //           vendorName: 'AWS',
    //           excludedRules: [
    //             {
    //               name: 'SizeRestrictions_BODY',
    //             },
    //           ],
    //         },
    //       },
    //       visibilityConfig: {
    //         cloudWatchMetricsEnabled: true,
    //         metricName: `${project}-${stack}-wafAclCloudfront-${stage}-CRS`,
    //         sampledRequestsEnabled: true,
    //       },
    //       overrideAction: {
    //         none: {},
    //       },
    //     },
    //     {
    //       name: 'AmazonIpReputationList',
    //       priority: 1,
    //       statement: {
    //         managedRuleGroupStatement: {
    //           name: 'AWSManagedRulesAmazonIpReputationList',
    //           vendorName: 'AWS',
    //         },
    //       },
    //       visibilityConfig: {
    //         cloudWatchMetricsEnabled: true,
    //         metricName: `${project}-${stack}-wafAclCloudfront-${stage}-AmazonIpReputationList`,
    //         sampledRequestsEnabled: true,
    //       },
    //       overrideAction: {
    //         none: {},
    //       },
    //     },
    //     {
    //       name: 'AnonymousIpList',
    //       priority: 2,
    //       statement: {
    //         managedRuleGroupStatement: {
    //           name: 'AWSManagedRulesAnonymousIpList',
    //           vendorName: 'AWS',
    //         },
    //       },
    //       visibilityConfig: {
    //         cloudWatchMetricsEnabled: true,
    //         metricName: `${project}-${stack}-wafAclCloudfront-${stage}-AnonymousIpList`,
    //         sampledRequestsEnabled: true,
    //       },
    //       overrideAction: {
    //         none: {},
    //       },
    //     },
    //     {
    //       name: 'rate-limiting',
    //       priority: 3,
    //       action: {
    //         block: {},
    //       },
    //       statement: {
    //         rateBasedStatement: {
    //           aggregateKeyType: 'IP',
    //           limit: 1000,
    //         },
    //       },
    //       visibilityConfig: {
    //         cloudWatchMetricsEnabled: true,
    //         metricName: `${project}-${stack}-wafAclCloudfront-${stage}-rate-limiting`,
    //         sampledRequestsEnabled: true,
    //       },
    //     },
    //   ],
    // });

    // new StringParameter(this, `${project}-${stack}-wafAclCloudfrontArnParam-${stage}`, {
    //   parameterName: `/${project}/${stack}/wafAclCloudfrontArn/${stage}`,
    //   stringValue: wafAclCloudfront.attrArn,
    // });
    // }

    verboseLog(`Stack complete: ${this.stackName}`);
  }
}
