#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { WebappStack } from './stacks/webapp-stack';
import config from '../config.json';

const { account, domain, region, nsConfigured = false } = config;

const app = new App();

new WebappStack(app, 'myapp', {
  domain,
  nsConfigured,
  env: {
    account,
    region,
  },
});
