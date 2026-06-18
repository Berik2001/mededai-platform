export interface AppConfig {
  env: string;
  port: number;
  corsOrigins: string[];
  /** Reject plain-HTTP requests (behind a TLS-terminating proxy). */
  forceHttps: boolean;
  databaseUrl: string;
  mongodbUri: string;
  jwt: {
    accessSecret: string;
    /** Access-token lifetime, e.g. "15m". */
    accessExpiresIn: string;
    /** Refresh-token lifetime in days. */
    refreshExpiresInDays: number;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
  audit: {
    enabled: boolean;
  };
  backup: {
    enabled: boolean;
    dir: string;
    retentionDays: number;
    /** Cron expression for the scheduled pg_dump job. */
    cron: string;
  };
}

const bool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined ? fallback : value.toLowerCase() === "true";

export default (): AppConfig => {
  const env = process.env.NODE_ENV ?? "development";
  return {
    env,
    port: parseInt(process.env.API_PORT ?? "4000", 10),
    corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
    forceHttps: bool(process.env.FORCE_HTTPS, env === "production"),
    databaseUrl: process.env.DATABASE_URL ?? "",
    mongodbUri: process.env.MONGODB_URI ?? "",
    jwt: {
      accessSecret: process.env.JWT_SECRET ?? "insecure-dev-secret",
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
      refreshExpiresInDays: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS ?? "7", 10),
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY ?? "",
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    },
    audit: {
      enabled: bool(process.env.AUDIT_ENABLED, true),
    },
    backup: {
      enabled: bool(process.env.BACKUP_ENABLED, false),
      dir: process.env.BACKUP_DIR ?? "./backups",
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS ?? "7", 10),
      cron: process.env.BACKUP_CRON ?? "0 3 * * *",
    },
  };
};
