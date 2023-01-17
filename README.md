# webapp-cdk

Infrastructure defined using CDK for deploying a web application to S3 behind CloudFront CDN and a Route 53 configured custom domain.

# How to deploy

- Run `yarn`
- Add your configuration to `config.json` - leave `nsConfigured` as `false`
- Run `yarn deploy`
- Wait for the stack to be deployed
- Configure the name servers of your domain with the name servers in the stack output from the AWS console
- Wait for the change to propagate
- Update `config.json` with `"nsConfigured": true`
- Run `yarn deploy`
- Done!
