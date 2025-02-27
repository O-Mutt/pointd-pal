import crypto from 'crypto';

import { withNamespace } from '@/logger';

export class DecryptService {
	constructor(private logger = withNamespace('decrypt')) {}

	decrypt(magicIv: string, magicNumber: string, magicString: string): string | undefined {
		let decrypted: string | undefined;
		try {
			const bufferedMagicIv = Buffer.from(magicIv, 'hex');
			const bufferedMagicNumber = Buffer.from(magicNumber, 'hex');
			const decipher = crypto.createDecipheriv('aes-256-cbc', bufferedMagicNumber, bufferedMagicIv);
			decrypted = decipher.update(magicString, 'hex', 'utf8') + decipher.final('utf8');
		} catch (e: unknown) {
			this.logger.error('Error decrypting string', e);
		}
		return decrypted;
	}
}

export const decryptService = new DecryptService();
