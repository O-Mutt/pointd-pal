import crypto from 'crypto';

export function decrypt(magicIv: string, magicNumber: string, magicString: string) {
	let decrypted;
	try {
		const bufferedMagicIv = Buffer.from(magicIv, 'hex');
		const bufferedMagicNumber = Buffer.from(magicNumber, 'hex');
		const decipher = crypto.createDecipheriv('aes-256-cbc', bufferedMagicNumber, bufferedMagicIv);
		decrypted = decipher.update(magicString, 'hex', 'utf8') + decipher.final('utf8');
	} catch (e: any) {
		// should log
	}
	return decrypted;
}
