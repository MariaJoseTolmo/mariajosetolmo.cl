import { Global, Module } from '@nestjs/common';
import { SSMClient } from '@aws-sdk/client-ssm';
import { APP_CONFIG, type AppConfig, loadConfig } from './app-config';
import { EnvSecretsProvider } from './env-secrets.provider';
import {
  APP_SECRETS,
  SECRETS_PROVIDER,
  type SecretsProvider,
} from './secrets.port';
import { SsmSecretsProvider } from './ssm-secrets.provider';

function createSecretsProvider(config: AppConfig): SecretsProvider {
  if (config.secretsSource === 'env')
    return new EnvSecretsProvider(process.env);
  const client = new SSMClient(
    config.awsRegion ? { region: config.awsRegion } : {},
  );
  return new SsmSecretsProvider(config.ssmPrefix ?? '', (command) =>
    client.send(command),
  );
}

@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig(process.env) },
    {
      provide: SECRETS_PROVIDER,
      useFactory: createSecretsProvider,
      inject: [APP_CONFIG],
    },
    {
      provide: APP_SECRETS,
      useFactory: (provider: SecretsProvider) => provider.load(),
      inject: [SECRETS_PROVIDER],
    },
  ],
  exports: [APP_CONFIG, SECRETS_PROVIDER, APP_SECRETS],
})
export class ConfigModule {}
