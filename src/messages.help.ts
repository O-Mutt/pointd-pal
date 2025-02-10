import axios from 'axios';
import { Blocks, Md, Message } from 'slack-block-builder';

import {
	type AllMiddlewareArgs,
	App,
	directMention,
	type SlackEventMiddlewareArgs,
	type StringIndexed,
} from '@slack/bolt';
import type { ChatPostMessageArguments } from '@slack/web-api';

import * as pjson from '../package.json';
import config from '@config';
import { helpRegexp, howMuchArePtsWorthRegexp, versionRegexp } from './lib/messageMatchers';

export function register(app: App): void {
	app.message(helpRegexp, directMention, respondWithHelpGuidance);

	app.message(versionRegexp, directMention, async ({ say }: SlackEventMiddlewareArgs<'message'>) => {
		await say(`PointdPal Version: _${pjson.version}_`);
	});

	app.message(howMuchArePtsWorthRegexp, tellHowMuchPointsAreWorth);
}

async function respondWithHelpGuidance({
	client,
	message,
	logger,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	const helpMessage = ''
		.concat('`< name > ++[<reason>]` - Increment score for a name (for a reason)\n')
		.concat('`< name > --[<reason>]` - Decrement score for a name (for a reason)\n')
		.concat('`{ name1, name2, name3 } ++[<reason>]` - Increment score for all names (for a reason)\n')
		.concat('`{ name1, name2, name3 } --[<reason>]` - Decrement score for all names (for a reason) \n')
		.concat('`{ name1, name2, name3 } --[<reason>]` - Decrement score for all names (for a reason) \n')
		.concat(`\`@Pointd Pal score <name>\` - Display the score for a name and some of the reasons\n`)
		.concat(`\`@Pointd Pal top <amount>\` - Display the top scoring <amount>\n`)
		.concat(`\`@Pointd Pal erase <name> [<reason>]\` - Remove the score for a name (for a reason) \n`)
		.concat(`\`@Pointd Pal level me up\` - Level up your account for some additional PointdPaliness \n`)
		.concat('`how much are <point_type> points worth` - Shows how much <point_type> points are worth\n');

	const theMessage = Message({ channel: message.channel, text: 'Help menu for Pointd Pal' })
		.blocks(
			Blocks.Header({ text: `Need help with Pointd Pal?` }),
			Blocks.Section({ text: `_Commands_:` }),
			Blocks.Section({ text: helpMessage }),
			Blocks.Section({
				text: `For further help please visit ${Md.link(config.get('helpUrl'), 'Help Page')}`,
			}),
		)
		.asUser();

	try {
		await client.chat.postMessage(theMessage.buildToObject() as ChatPostMessageArguments);
	} catch (e: unknown) {
		// @ts-expect-error loud noise because of responses
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		logger.error('error', e?.data?.response_metadata?.message, theMessage.printPreviewUrl());
	}
}

async function tellHowMuchPointsAreWorth({
	payload,
	logger,
	message,
	context,
	say,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<'message'> & StringIndexed) {
	logger.error(message, context, payload);
	try {
		const ethRes = await axios({
			url: 'https://api.coinbase.com/v2/exchange-rates?currency=ETH',
		});

		const btcRes = await axios({
			url: 'https://api.coinbase.com/v2/exchange-rates?currency=BTC',
		});

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		const ethInUsd = ethRes.data.eth.data.rates.USD;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		const btcInUsd = btcRes.data.btc.data.rates.USD;
		await say(
			`A Bitcoin is worth $${btcInUsd} USD right now, Ethereum is $${ethInUsd} USD, and ${Md.bold(
				'PointdPal points are worth nothing',
			)}!`,
		);
		return;
	} catch (e: unknown) {
		logger.error('Error with how much points worth -_-', e);
		await say(
			"Seems like we are having trouble getting some data... Don't worry, though, your Pointd Pal points are still worth nothing!",
		);
		return;
	}
}
