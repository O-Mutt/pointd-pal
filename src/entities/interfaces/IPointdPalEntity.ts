import { Guid } from '../../lib/types/Guid';

export interface IPointdPalEntity {
  id: Guid;
  createdAt: Date;
  createdBy?: string;
  updatedAt: Date;
  updatedBy?: string;
  deleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;

  getCreateTableQuery(): string[];
}
