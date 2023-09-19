import { Guid } from '../lib/types/Guid';
import { IPointdPalEntity } from './interfaces/IPointdPalEntity';

export abstract class APointdPalEntity implements IPointdPalEntity {
  id: Guid = crypto.randomUUID();
  createdAt: Date = new Date();
  createdBy?: string;
  updatedAt: Date = new Date();
  updatedBy?: string | undefined;
  deleted: boolean = false;
  deletedAt?: Date | undefined;
  deletedBy?: string | undefined;
  getCreateTableQuery(): string[] {
    throw new Error('Method not implemented.');
  }
  auditTableCreatePartial: `id SERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by TEXT,
    deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMP,
    deleted_by TEXT`;
}
