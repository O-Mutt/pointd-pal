import { Stripe } from "stripe";
import { Installation } from "../models/installation";

require('dotenv').config();

export class StripeService {
  stripe: Stripe;
  webhookSecret: string;
  baseTierPricing: string;
  trialPeriodDays: number;
  constructor() {
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2020-08-27' });
    this.baseTierPricing = process.env.STRIPE_PRICING_ID as string;
    this.trialPeriodDays = (process.env.STRIPE_TRIAL_DAYS || 30) as number;
  }

  constructEvent(body, sig): Stripe.Event {
    return this.stripe.webhooks.constructEvent(body, sig, this.webhookSecret)
  }

  async createCustomer(teamId: string, teamName: string, email: string): Promise<Stripe.Customer> {
    const customer = await this.stripe.customers.create({
      name: teamId,
      description: `Slack bot installed by ${teamName} in workspace ${teamId}`,
      email: email
    });
    return customer;
  }

  async createTrialAndSubscription(customer: Stripe.Customer): Promise<void> {
    const subscription = await this.stripe.subscriptions.create({
      customer: customer.id,
      items: [
        {
          price: this.baseTierPricing
        }
      ],
      trial_period_days: this.trialPeriodDays
    });
    const install = await Installation.findOneAndUpdate({ customerId: customer.id }, { $set: { subscriptionId: subscription.id, subscriptionStatus: subscription.status } });
  }

  async mapCustomerToInstallation(customer: Stripe.Customer): Promise<void> {
    if (customer.name) {
      const install = await Installation.findOne({ teamId: customer.name || '' });
      if (!install) {
        await Installation.create({
          teamId: customer.name,
          customerId: customer?.id
        });
        console.log("New installation created, we will have to wait for the customer to actually install the bot on slack though.");
      }
    }
  }

  async deleteCustomerSubscription(customer?: Stripe.Customer, subscription?: Stripe.Subscription): Promise<void> {
    let lookupQuery: { [key: string]: any } = {};
    if (customer?.id || subscription?.customer) {
      lookupQuery.customerId = customer?.id || subscription?.customer;
    }
    if (customer?.name) {
      lookupQuery.teamId = customer.name;
    }


    const install = await Installation.findOne(lookupQuery).exec();

    if (!install) {
      console.error(`delete customer subscription failed ${lookupQuery}`);
      return;
    }

    try {
      const sub = await this.stripe.subscriptions.update(install.subscriptionId, {
        cancel_at_period_end: true
      });
    } catch (e: any | unknown) {

    }
    try {
      await Installation.findOneAndUpdate(lookupQuery, { $unset: { subscriptionId: 1, subscriptionStatus: 1 } }).exec();
    } catch (e: any | unknown) {
      console.error(`There was an deleting the customerSubscription ${lookupQuery}`)
    }

  }

  async updateSubscription(subscription: Stripe.Subscription): Promise<void> {
    const lookup: { [key: string]: any } = {};
    if (typeof subscription.customer === 'string') {
      lookup.customerId = subscription.customer;
    } else {
      lookup.teamId = (<Stripe.Customer>subscription.customer).name;
      lookup.customerId = (<Stripe.Customer>subscription.customer).id;
    }
    const install = await Installation.findOneAndUpdate(lookup, { $set: { subscriptionId: subscription.id, subscriptionStatus: subscription.status } });
    console.log(`Updating installation for customer ${subscription.customer} new subscription ${subscription.id} status ${subscription.status}`);
  }
}