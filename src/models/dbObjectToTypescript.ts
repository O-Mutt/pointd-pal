export class DBObjectConvertible {
	getCamelToSnakeFields(): string {
		const fields = Object.keys(this)
			// this could break if the key has something like isURL
			.map((key, index) => `${key.camelToSnakeCase()} = $${index + 2}`)
			.join(', ');

		return fields;
	}
	getSnakeToCamelFields(): string {
		const fields = Object.keys(this)
			.map((key, index) => `${key.snakeToCamelCase()} = $${index + 2}`)
			.join(', ');
		return fields;
	}
}
