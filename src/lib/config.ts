import convict from 'convict';
import { version } from '../package.json';

export enum ApplicationEnvironment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  REVIEW = 'review',
  STAGE = 'stage',
  TEST = 'test',
}

export enum StartupType {
  SERVER = 'server',
  CACHE_WORKER = 'cache',
  PROVISIONING_WORKER = 'provisioning',
}

export interface ConfigurationSchema {
  serviceName: string;
  serviceVersion: string;
  defaultDatabaseName: string;
  slack: {
    clientId: string;
    clientSecret: string;
    signingSecret: string;
    stateSecret: string;
  };
  http?: {
    host?: string;
    port?: string;
  };
  environment?: ApplicationEnvironment;
  logger: {
    console?: string;
    errorReporterUrl?: string;
    serviceName?: string;
  };
  postgres: {
    connectionString: string;
    queryTimeout?: string;
    maxConnectionPool?: string;
    rejectUnauthorized: boolean;
  };
}

export const load: () => ConfigurationSchema = () => {
  const configuration = convict<ConfigurationSchema>({
    serviceName: {
      format: String,
      env: 'SERVICE_NAME',
      default: 'status page',
    },
    serviceVersion: {
      format: String,
      env: 'SERVICE_VERSION',
      default: 'v0.0.0',
    },
    defaultDatabaseName: {
      format: String,
      env: 'DEFAULT_DB_NAME',
      default: 'pointd_pal',
    },
    slack: {
      clientId: {
        format: String,
        env: 'SLACK_CLIENT_ID',
        default: '',
      },
      clientSecret: {
        format: String,
        env: 'SLACK_CLIENT_SECRET',
        default: '',
      },
      signingSecret: {
        format: String,
        env: 'SLACK_SIGNING_SECRET',
        default: '',
      },
      stateSecret: {
        format: String,
        env: 'SLACK_STATE_SECRET',
        default: '',
      },
    },
    http: {
      host: {
        format: String,
        env: 'HOST',
        default: '0.0.0.0',
      },
      port: {
        format: Number,
        env: 'PORT',
        default: 3001,
      },
    },
    environment: {
      doc: 'The application environment.',
      format: [
        ApplicationEnvironment.DEVELOPMENT,
        ApplicationEnvironment.PRODUCTION,
        ApplicationEnvironment.REVIEW,
        ApplicationEnvironment.STAGE,
        ApplicationEnvironment.TEST,
      ],
      default: ApplicationEnvironment.PRODUCTION,
      env: 'NODE_ENV',
    },
    postgres: {
      connectionString: {
        format: String,
        doc: 'Support Center Postgres instance',
        env: 'PGHOST',
        sensitive: true,
        default: null,
      },
      queryTimeout: {
        format: Number,
        doc: 'Postgres query timeout',
        env: 'PG_QUERY_TIMEOUT',
        sensitive: false,
        default: 20000,
      },
      maxConnectionPool: {
        format: Number,
        doc: 'Postgres max connection pool',
        env: 'PG_MAX_CONNECTION_POOL',
        sensitive: false,
        default: 10,
      },
      rejectUnauthorized: {
        format: Boolean,
        doc: 'Postgres reject unauthorized requests',
        env: 'PG_REJECT_UNAUTHORIZED',
        sensitive: false,
        default: true,
      },
    },
  });
  configuration.validate({ allowed: 'strict' });
  return configuration;
};

export type Configuration = convict.Config<ConfigurationSchema>;
