import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { exec } from "child_process";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import { join, resolve } from "path";
import { promisify } from "util";
import type { BackupInfo, BackupSettings } from "@med/shared";
import type { AppConfig } from "../config/configuration";

const execAsync = promisify(exec);
const JOB_NAME = "pg-backup";

/**
 * Scheduled PostgreSQL backups via `pg_dump` (custom/compressed format).
 *
 * The cron expression and enablement are config-driven, so the job is
 * registered dynamically rather than with a static `@Cron()` decorator.
 * `pg_dump` must be available on the host/container PATH.
 */
@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);
  private readonly cfg: AppConfig["backup"];
  private readonly databaseUrl: string;

  constructor(
    private readonly scheduler: SchedulerRegistry,
    config: ConfigService<AppConfig, true>,
  ) {
    this.cfg = config.get("backup", { infer: true });
    this.databaseUrl = config.get("databaseUrl", { infer: true });
  }

  onModuleInit(): void {
    if (!this.cfg.enabled) {
      this.logger.log("Scheduled backups disabled (set BACKUP_ENABLED=true to enable).");
      return;
    }
    const job = new CronJob(this.cfg.cron, () => {
      void this.runBackup();
    });
    this.scheduler.addCronJob(JOB_NAME, job as unknown as CronJob);
    job.start();
    this.logger.log(`Scheduled pg_dump backups with cron "${this.cfg.cron}" → ${this.cfg.dir}`);
  }

  /** Run a single backup now. Returns the path to the created dump file. */
  async runBackup(): Promise<string | null> {
    if (!this.databaseUrl) {
      this.logger.error("DATABASE_URL is not set; skipping backup.");
      return null;
    }

    const dir = resolve(this.cfg.dir);
    await mkdir(dir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = join(dir, `backup-${stamp}.dump`);

    // Prisma URLs carry a `?schema=` param that libpq/pg_dump rejects; move it to --schema.
    const { dbname, schema } = this.parseConnection();
    const schemaArg = schema ? ` --schema="${schema}"` : "";

    try {
      // --format=custom is compressed and restorable selectively via pg_restore.
      await execAsync(
        `pg_dump --dbname="${dbname}"${schemaArg} --format=custom --no-owner --file="${file}"`,
        { maxBuffer: 1024 * 1024 * 64 },
      );
      this.logger.log(`Backup written: ${file}`);
      await this.pruneOldBackups(dir);
      return file;
    } catch (err) {
      this.logger.error(`Backup failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Current backup configuration (for the admin panel). */
  settings(): BackupSettings {
    return {
      enabled: this.cfg.enabled,
      cron: this.cfg.cron,
      dir: resolve(this.cfg.dir),
      retentionDays: this.cfg.retentionDays,
    };
  }

  /** List existing dump files, newest first. */
  async listBackups(): Promise<BackupInfo[]> {
    const dir = resolve(this.cfg.dir);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return []; // directory not created yet
    }
    const infos: BackupInfo[] = [];
    for (const name of entries) {
      if (!name.startsWith("backup-") || !name.endsWith(".dump")) continue;
      const info = await stat(join(dir, name));
      infos.push({ filename: name, sizeBytes: info.size, createdAt: info.mtime.toISOString() });
    }
    return infos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Delete a single dump file (filename only — no path traversal). */
  async deleteBackup(filename: string): Promise<void> {
    if (!/^backup-[\w.-]+\.dump$/.test(filename)) {
      throw new BadRequestException("Invalid backup filename");
    }
    const full = join(resolve(this.cfg.dir), filename);
    try {
      await unlink(full);
    } catch {
      throw new NotFoundException("Backup not found");
    }
    this.logger.log(`Deleted backup: ${filename}`);
  }

  /** Split the connection string into a libpq-safe URI and an optional schema. */
  private parseConnection(): { dbname: string; schema?: string } {
    try {
      const url = new URL(this.databaseUrl);
      const schema = url.searchParams.get("schema") ?? undefined;
      url.searchParams.delete("schema");
      return { dbname: url.toString(), schema };
    } catch {
      return { dbname: this.databaseUrl };
    }
  }

  /** Delete dump files older than the configured retention window. */
  private async pruneOldBackups(dir: string): Promise<void> {
    const cutoff = Date.now() - this.cfg.retentionDays * 24 * 60 * 60 * 1000;
    const entries = await readdir(dir);
    for (const name of entries) {
      if (!name.startsWith("backup-") || !name.endsWith(".dump")) continue;
      const full = join(dir, name);
      const info = await stat(full);
      if (info.mtimeMs < cutoff) {
        await unlink(full);
        this.logger.log(`Pruned old backup: ${name}`);
      }
    }
  }
}
