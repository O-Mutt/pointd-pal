import { CustomRoute } from '@slack/bolt/dist/receivers/custom-routes';
import { IncomingMessage, ServerResponse } from 'http';
import { Stripe } from 'stripe';
import { StripeService } from '../services/stripe';

export const stripeEndpoint: CustomRoute = {
  path: '/stripe-hook',
  method: ['POST'],
  handler: (req: IncomingMessage, res: ServerResponse) => {
    let body;
    req.on('data', (chunk) => (body ? (body += chunk) : (body = chunk)));
    req.on('end', async () => {
      await handleStripeEvent(body, req, res);
    });
  },
};

async function handleStripeEvent(body: any, req: IncomingMessage, res: ServerResponse) {
  const sig = req.headers['stripe-signature'] as string | string[];

  let type;
  let value;
  try {
    const stripe = new StripeService();
    ({
      type,
      data: { object: value },
    } = stripe.constructEvent(body, sig));
    // Handle the event
    let customer: Stripe.Customer;
    let subscription: Stripe.Subscription;
    switch (type) {
      case 'customer.created':
        customer = value as Stripe.Customer;
        await stripe.mapCustomerToInstallation(customer);
        // Then define and call a function to handle the event customer.created
        break;
      case 'customer.deleted':
        customer = value as Stripe.Customer;
        await stripe.deleteCustomerSubscription(customer);
        // Then define and call a function to handle the event customer.deleted
        break;
      /* case 'customer.updated':
        customer = value as Stripe.Customer;
        // Then define and call a function to handle the event customer.updated
        break; */
      case 'customer.subscription.created':
        subscription = value as Stripe.Subscription;
        await stripe.updateSubscription(subscription);
        // Then define and call a function to handle the event customer.subscription.created
        break;
      case 'customer.subscription.deleted':
        subscription = value as Stripe.Subscription;
        await stripe.deleteCustomerSubscription(undefined, subscription);
        // Then define and call a function to handle the event customer.subscription.deleted
        break;
      /* case 'customer.subscription.trial_will_end':
        subscription = value as Stripe.Subscription;
        // Then define and call a function to handle the event customer.subscription.trial_will_end
        break; */
      case 'customer.subscription.updated':
        subscription = value as Stripe.Subscription;
        await stripe.updateSubscription(subscription);
        // Then define and call a function to handle the event customer.subscription.updated
        break;
      // ... handle other event types
      default:
        console.log(`Unhandled event type ${type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.writeHead(200);
    res.end();
    return;
  } catch (err: any | unknown) {
    res.writeHead(400);
    res.write(`Webhook Error: ${err.message}`);
    res.end();
    return;
  }
}
