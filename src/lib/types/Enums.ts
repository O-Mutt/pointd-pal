export enum EnabledSettings {
	ENABLED = 'Enabled',
	DISABLED = 'Disabled',
}

export enum PromptSettings {
	ALWAYS = 'Always',
	PROMPT = 'Prompt',
	NEVER = 'Never',
}

export enum ReadyState {
	DISCONNECTED = 0,
	CONNECTED = 1,
	CONNECTING = 2,
	DISCONNECTING = 3,
}

export enum ConfirmOrCancel {
	CONFIRM = 'Confirm',
	CANCEL = 'Cancel',
}

export enum DirectionEnum {
	PLUS = '++',
	MINUS = '--',
}

export enum SubscriptionStatus {
	ACTIVE = 'active',
	TRIAL = 'trialing',
	CANCELED = 'canceled',
	INCOMPLETE = 'incomplete',
	INCOMPLETE_EXPIRED = 'expired',
	PAST_DUE = 'past_due',
	UNPAID = 'unpaid',
}
