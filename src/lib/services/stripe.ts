import { Stripe } from "stripe";

require('dotenv').config();

export class StripeService {
  stripe: Stripe;
  webhookSecret: string;
  constructor() {
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2020-08-27' });
  }

  handleEvent(body, sig) {
    return this.stripe.webhooks.constructEvent(body, sig, this.webhookSecret)
  }

  async createCustomer(teamId, teamName): Promise<Stripe.Customer> {
    const customer = await this.stripe.customers.create({
      name: teamId,
      description: `Slack bot installed by ${teamName} in workspace ${teamId}`
    });
    return customer;
  }
}

