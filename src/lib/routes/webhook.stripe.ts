import { CustomRoute } from '@slack/bolt/dist/receivers/custom-routes';
import { IncomingMessage, ServerResponse } from 'http';

export const stripeEndpoint: CustomRoute = {
	path: '/stripe-hook',
	method: ['POST'],
	handler: (req: IncomingMessage, res: ServerResponse) => {
		let body;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment
		req.on('data', (chunk) => (body ? (body += chunk) : (body = chunk)));
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		req.on('end', async () => {
			await handleStripeEvent(body, req, res);
		});
	},
};

// eslint-disable-next-line @typescript-eslint/require-await
async function handleStripeEvent(body: unknown, req: IncomingMessage, res: ServerResponse) {
	const _sig = req.headers['stripe-signature'] as string | string[];

	let _type;
	let _value;
	try {
		// const stripe = new StripeService();
		// ({
		// 	type,
		// 	data: { object: value },
		// } = stripe.constructEvent(body, sig));
		// Handle the event
		// let customer: Stripe.Customer;
		// let subscription: Stripe.Subscription;
		// switch (type) {
		// 	case 'customer.created':
		// 		customer = value as Stripe.Customer;
		// 		await stripe.mapCustomerToInstallation(customer);
		// 		// Then define and call a function to handle the event customer.created
		// 		break;
		// 	case 'customer.deleted':
		// 		customer = value as Stripe.Customer;
		// 		await stripe.deleteCustomerSubscription(customer);
		// 		// Then define and call a function to handle the event customer.deleted
		// 		break;
		// 	/* case 'customer.updated':
		//     customer = value as Stripe.Customer;
		//     // Then define and call a function to handle the event customer.updated
		//     break; */
		// 	case 'customer.subscription.created':
		// 		subscription = value as Stripe.Subscription;
		// 		await stripe.updateSubscription(subscription);
		// 		// Then define and call a function to handle the event customer.subscription.created
		// 		break;
		// 	case 'customer.subscription.deleted':
		// 		subscription = value as Stripe.Subscription;
		// 		await stripe.deleteCustomerSubscription(undefined, subscription);
		// 		// Then define and call a function to handle the event customer.subscription.deleted
		// 		break;
		// 	/* case 'customer.subscription.trial_will_end':
		//     subscription = value as Stripe.Subscription;
		//     // Then define and call a function to handle the event customer.subscription.trial_will_end
		//     break; */
		// 	case 'customer.subscription.updated':
		// 		subscription = value as Stripe.Subscription;
		// 		await stripe.updateSubscription(subscription);
		// 		// Then define and call a function to handle the event customer.subscription.updated
		// 		break;
		// 	// ... handle other event types
		// 	default:
		// 		logger.info(`Unhandled event type ${type}`);
		// }

		// Return a 200 response to acknowledge receipt of the event
		res.writeHead(200);
		res.end();
		return;
	} catch (err: unknown) {
		res.writeHead(400);
		res.write(`Webhook Error: ${(err as Error).message}`);
		res.end();
		return;
	}
}
