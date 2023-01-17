import { Stack, StackProps, RemovalPolicy, CfnOutput, Fn } from 'aws-cdk-lib';
import { Bucket, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import {
  OriginAccessIdentity,
  CloudFrontWebDistribution,
  ViewerCertificate,
  SecurityPolicyProtocol,
  SSLMethod,
} from 'aws-cdk-lib/aws-cloudfront';

import { Construct } from 'constructs';
import { CertificateValidation, DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { ARecord, RecordTarget, HostedZone } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';

interface WebappStackProps extends StackProps {
  domain: string;
  nsConfigured: boolean;
}

export class WebappStack extends Stack {
  constructor(scope: Construct, id: string, props: WebappStackProps) {
    super(scope, id, props);

    // Creates a bucket that will hold the HTML and asset files that make up the web application
    const bucket = new Bucket(this, 'WebappHostingBucket', {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      blockPublicAccess: new BlockPublicAccess({ restrictPublicBuckets: false }),
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Creates an origin access identity (OAI) that allows the CloudFront CDN to access the S3 bucket and serve the files inside it
    const oai = new OriginAccessIdentity(this, 'WebappCloudFrontOriginAccessIdentity');
    bucket.grantRead(oai.grantPrincipal);

    // Creates a hosted zone that holds the domain that we want to use for our web application
    const hostedZone = new HostedZone(this, 'HostedZone', { zoneName: props.domain });

    // Adds the Route 53 name servers for our domain as outputs to the stack
    // Once the stack is deployed, you need to point your domain to these name servers
    if (hostedZone.hostedZoneNameServers) {
      new CfnOutput(this, 'NameServers', { value: Fn.join(', ', hostedZone.hostedZoneNameServers) });
    }

    // These resources can only be created once DNS has been configured and propagated for the domain
    if (props.nsConfigured) {
      // Creates an ACM managed certificate that allows us to enable HTTPS for the web application
      const certificate: DnsValidatedCertificate | null = new DnsValidatedCertificate(this, 'Certificate', {
        domainName: props.domain,
        subjectAlternativeNames: [props.domain, `www.${props.domain}`],
        validation: CertificateValidation.fromDns(hostedZone),
        region: 'us-east-1',
        hostedZone: hostedZone,
        cleanupRoute53Records: true,
      });

      // Creates a CloudFront distribution that acts as a CDN for our web application.
      // The CloudFront distribution points to our S3 bucket as an origin and uses our ACM certificate
      const distribution = new CloudFrontWebDistribution(this, 'WebappDistribution', {
        viewerCertificate: ViewerCertificate.fromAcmCertificate(certificate, {
          aliases: [props.domain, `www.${props.domain}`],
          securityPolicy: SecurityPolicyProtocol.TLS_V1_2_2021,
          sslMethod: SSLMethod.SNI,
        }),
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: bucket,
              originAccessIdentity: oai,
            },
            behaviors: [{ isDefaultBehavior: true }],
          },
        ],
        errorConfigurations: [
          {
            errorCode: 404,
            errorCachingMinTtl: 300,
            responseCode: 200,
            responsePagePath: '/index.html',
          },
        ],
      });

      bucket.grantRead(oai.grantPrincipal);

      // Finally, an A-record is created that points the domain to the CloudFront distribution that serves our web application
      new ARecord(this, 'WebappARecord', {
        target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
        zone: hostedZone,
        recordName: `${props.domain}`,
      });
    }
  }
}
