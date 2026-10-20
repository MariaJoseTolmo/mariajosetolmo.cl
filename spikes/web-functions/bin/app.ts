import { App } from 'aws-cdk-lib';
import { SpikeCodeStack } from '../lib/code-stack';
import { SpikeWebStack } from '../lib/web-stack';

const app = new App();

// Account comes from the environment (never committed); unset = account-agnostic synth.
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' };

const codeStack = new SpikeCodeStack(app, 'SpikeCodeStack', { env });
const webStack = new SpikeWebStack(app, 'SpikeWebStack', {
  env,
  codeBucket: codeStack.bucket,
  codeKey: app.node.getContext('codeKey'),
  codeVersion: app.node.getContext('codeVersion'),
  alertEmail: app.node.getContext('alertEmail'),
});
// Destroy order: web stack first, otherwise the revision ends up permanently Failed.
webStack.addStackDependency(codeStack);
