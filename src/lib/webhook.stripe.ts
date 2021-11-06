import { CustomRoute } from "@slack/bolt/dist/receivers/custom-routes";
import { IncomingMessage, ServerResponse } from "http";
import { StripeService } from "./services/stripe";

export const stripeEndpoint: CustomRoute = {
  path: '/stripe-hook',
  method: ['POST'],
  handler: (req: IncomingMessage, res: ServerResponse) => {
    let body;

    req.on('data', (chunk) => body += chunk);
    req.on('end', async () => {
      console.log(body)
      await handleStripeEvent(body, req, res)
    })
  }
};

async function handleStripeEvent(body: any, req: IncomingMessage, res: ServerResponse) {
  const sig = req.headers['stripe-signature'] as string | string[];

  let event;
  try {
    const stripe = new StripeService();
    event = stripe.handleEvent(body, sig)
    let subscriptionSchedule;
    // Handle the event
    switch (event.type) {
      case 'subscription_schedule.aborted':
        subscriptionSchedule = event.data.object;
        console.log(subscriptionSchedule)
        // Then define and call a function to handle the event subscription_schedule.aborted
        break;
      case 'subscription_schedule.canceled':
        subscriptionSchedule = event.data.object;
        console.log(subscriptionSchedule)

        // Then define and call a function to handle the event subscription_schedule.canceled
        break;
      case 'subscription_schedule.created':
        subscriptionSchedule = event.data.object;
        console.log(subscriptionSchedule)

        // Then define and call a function to handle the event subscription_schedule.created
        break;
      // ... handle other event types
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.writeHead(200);
  } catch (err: any | unknown) {
    res.writeHead(400);
    res.write(`Webhook Error: ${err.message}`);
    return;
  }
}